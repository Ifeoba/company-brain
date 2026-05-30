"""
Celery tasks for async run execution and the maintainer service.

Run the worker with:
    celery -A backend.celery_app worker --loglevel=info -Q runs,maintainer
"""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Optional

from .celery_app import celery_app
from .db import session_scope
from . import sse


# ── Run execution ──────────────────────────────────────────────────────────────

RUN_SYSTEM_PROMPT = """You are an AI agent operating inside a company brain -- a structured specification of how a specific job should be done at this company. Your job is to apply the brain's rules to a single incoming case.

THE BRAIN:

{brain}

WHEN YOU RECEIVE A CASE, RESPOND IN THIS EXACT STRUCTURE:

## Decision
One paragraph: what should happen for this case.

## Rules applied
Bulleted list. Each bullet must reference a specific rule by name or number from the decision rules or guardrails. Example: "- Rule 3 (Confidence <= 0.5 -> Quick Tag queue) applies because the CategoryEngine returned 0.42."

## Guardrails triggered
Bulleted list of guardrails that affected this decision. If a guardrail blocks autonomous action, say so explicitly: "Requires human approval before proceeding." If none apply, write "None."

## What I'd actually do next
One paragraph: the concrete next step a human operator should take, in plain language.

## Confidence
HIGH, MEDIUM, or LOW -- your honest assessment of whether the brain has enough information to handle this case."""


def _add_step(db, run_id: str, counter: list, kind: str, content: str = "", metadata: Optional[dict] = None) -> None:
    """Append a RunStep to the trace. counter is a single-element list used as a mutable int."""
    from .models import RunStep
    db.add(RunStep(
        run_id=run_id,
        step_index=counter[0],
        kind=kind,
        content=(content or "")[:2000],
        metadata_json=json.dumps(metadata or {}),
        occurred_at=datetime.utcnow(),
    ))
    db.flush()
    counter[0] += 1


def _extract_cited_rules(decision_text: str) -> list:
    rules = []
    in_section = False
    for line in decision_text.splitlines():
        if re.match(r"^##\s+Rules applied", line, re.IGNORECASE):
            in_section = True
            continue
        if in_section:
            if line.startswith("##"):
                break
            m = re.match(r"^\s*[-*]\s+(.+)", line)
            if m:
                rules.append(m.group(1).strip())
    return rules


def _assemble_brain(brain_id: str, db) -> str:
    from .models import BrainFile
    files = db.query(BrainFile).filter_by(brain_id=brain_id).order_by(BrainFile.filename).all()
    skip = {"brain-readme.md", "progress.md"}
    parts = [
        "=== {} ===\n{}".format(f.filename, f.content)
        for f in files
        if f.content and f.content.strip() and f.filename not in skip
    ]
    return "\n\n".join(parts)


def _run_with_tools_anthropic(client, model, system, case_text, tools, db, run, ws_id, step_counter=None):
    """
    Multi-turn Anthropic tool-use loop.
    Returns (decision_text, tokens_in, tokens_out, awaiting_approval).
    step_counter is a mutable [int] shared with the caller so step indices are contiguous.
    """
    from .models import ToolCall
    from .tool_executors import execute_tool, TOOL_SCHEMAS

    if step_counter is None:
        step_counter = [0]

    anthropic_tools = []
    for t in tools:
        schema = TOOL_SCHEMAS.get(t.name)
        if schema:
            anthropic_tools.append({
                "name": t.name,
                "description": schema["description"],
                "input_schema": schema["input_schema"],
            })

    messages = [{"role": "user", "content": "CASE:\n\n{}".format(case_text)}]
    total_in = total_out = 0
    final_text = ""

    for _ in range(5):  # max 5 tool rounds
        resp = client.messages.create(
            model=model,
            max_tokens=2048,
            system=system,
            messages=messages,
            tools=anthropic_tools or [],
        )
        total_in += resp.usage.input_tokens
        total_out += resp.usage.output_tokens

        text_parts = [b.text for b in resp.content if b.type == "text"]
        tool_blocks = [b for b in resp.content if b.type == "tool_use"]
        if text_parts:
            final_text = "\n".join(text_parts)
            _add_step(db, run.id, step_counter, "thinking", final_text)

        if resp.stop_reason == "end_turn" or not tool_blocks:
            break

        messages.append({"role": "assistant", "content": resp.content})

        tool_results = []
        needs_approval = False

        for block in tool_blocks:
            tool_model = next((t for t in tools if t.name == block.name), None)
            if not tool_model:
                tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": "Tool not found"})
                continue

            _add_step(db, run.id, step_counter, "tool_call",
                      "{}({})".format(block.name, json.dumps(block.input)[:300]),
                      {"tool_name": block.name, "arguments": block.input})

            tc = ToolCall(
                run_id=run.id,
                tool_id=tool_model.id,
                arguments=json.dumps(block.input),
                status="pending_approval" if tool_model.risk in ("confirm", "escalate") else "approved",
                requested_at=datetime.utcnow(),
            )
            db.add(tc)
            db.flush()

            if tool_model.risk in ("confirm", "escalate"):
                needs_approval = True
                if tool_model.risk == "escalate":
                    from .models import Escalation
                    esc = Escalation(
                        run_id=run.id,
                        workspace_id=run.workspace_id or ws_id,
                        reason="Tool '{}' requires team review before execution".format(tool_model.name),
                        guardrail_cited="escalate-risk tool",
                        tool_call_id=tc.id,
                        status="pending",
                        created_at=datetime.utcnow(),
                    )
                    db.add(esc)
                    db.flush()
                    _add_step(db, run.id, step_counter, "guardrail_blocked",
                              "Tool '{}' escalated for team review".format(tool_model.name),
                              {"tool_name": tool_model.name, "tool_call_id": tc.id})
                _add_step(db, run.id, step_counter, "approval_requested",
                          "Awaiting approval for: {}".format(tool_model.name),
                          {"tool_name": tool_model.name, "tool_call_id": tc.id})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": "Pending human approval before execution.",
                })
            else:
                try:
                    result = execute_tool(db, tc, tool_model, run.workspace_id or run.user_id)
                    tc.result = json.dumps(result)
                    tc.status = "executed"
                    tc.executed_at = datetime.utcnow()
                    result_str = json.dumps(result)
                    _add_step(db, run.id, step_counter, "tool_executed",
                              result_str[:500],
                              {"tool_name": tool_model.name, "tool_call_id": tc.id})
                except Exception as exc:
                    tc.status = "failed"
                    tc.error = str(exc)
                    tc.executed_at = datetime.utcnow()
                    result_str = "Error: {}".format(exc)
                    _add_step(db, run.id, step_counter, "tool_failed",
                              str(exc)[:500],
                              {"tool_name": tool_model.name, "tool_call_id": tc.id, "error": str(exc)})
                tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": result_str})

        db.flush()
        if needs_approval:
            return final_text or "Awaiting approval for tool actions.", total_in, total_out, True

        messages.append({"role": "user", "content": tool_results})

    return final_text, total_in, total_out, False


def execute_run(run_id: str, workspace_id: Optional[str] = None) -> None:
    """
    Core run logic. Called directly from BackgroundTasks or from the Celery task.
    Emits SSE events on status transitions.
    """
    from .models import BrainTool, Run, User

    with session_scope() as db:
        run = db.query(Run).filter_by(id=run_id).first()
        if not run:
            return
        ws_id = workspace_id or run.workspace_id or run.user_id

        run.status = "running"
        db.flush()
        sse.publish(ws_id, {"type": "run.started", "run_id": run_id})

        user = db.query(User).filter_by(id=run.user_id).first()
        if not user:
            run.status = "failed"
            run.error_text = "User not found"
            run.completed_at = datetime.utcnow()
            sse.publish(ws_id, {"type": "run.failed", "run_id": run_id, "error": run.error_text})
            return

        try:
            from .llm_client import PROVIDERS
            brain_content = _assemble_brain(run.brain_id, db)
            if not brain_content.strip():
                raise ValueError("This brain has no content yet. Complete the interview first.")

            system = RUN_SYSTEM_PROMPT.format(brain=brain_content)
            provider = user.llm_provider or "anthropic"
            model = PROVIDERS.get(provider, PROVIDERS["anthropic"])["default_model"]
            step_counter = [0]

            # Load any tools attached to this brain
            brain_tools = [
                bt.tool for bt in db.query(BrainTool).filter_by(brain_id=run.brain_id).all()
                if bt.tool.is_active
            ]

            if provider == "anthropic":
                import anthropic
                from .crypto import decrypt_key
                api_key = decrypt_key(user.encrypted_anthropic_key)
                client = anthropic.Anthropic(api_key=api_key)

                if brain_tools:
                    decision, tokens_in, tokens_out, awaiting = _run_with_tools_anthropic(
                        client, model, system, run.case_text, brain_tools, db, run, ws_id, step_counter
                    )
                    run.tokens_in = tokens_in
                    run.tokens_out = tokens_out
                    if awaiting:
                        run.decision_text = decision
                        run.status = "awaiting_approval"
                        run.completed_at = datetime.utcnow()
                        sse.publish(ws_id, {"type": "run.awaiting_approval", "run_id": run_id})
                        return
                else:
                    resp = client.messages.create(
                        model=model,
                        max_tokens=2048,
                        system=system,
                        messages=[{"role": "user", "content": "CASE:\n\n{}".format(run.case_text)}],
                    )
                    decision = resp.content[0].text
                    run.tokens_in = resp.usage.input_tokens
                    run.tokens_out = resp.usage.output_tokens
                    _add_step(db, run.id, step_counter, "thinking", decision)
            else:
                from .llm_client import call_llm
                decision = call_llm(
                    user, system,
                    [{"role": "user", "content": "CASE:\n\n{}".format(run.case_text)}],
                    max_tokens=2048,
                )
                run.tokens_in = 0
                run.tokens_out = 0
                _add_step(db, run.id, step_counter, "thinking", decision)

            _add_step(db, run.id, step_counter, "final_decision", decision)
            run.decision_text = decision
            run.cited_rules = json.dumps(_extract_cited_rules(decision))
            run.model_used = model
            run.status = "completed"
            run.completed_at = datetime.utcnow()

            sse.publish(ws_id, {
                "type": "run.completed",
                "run_id": run_id,
                "status": "completed",
            })

        except Exception as exc:
            # Detect transient errors (rate limit, connection) — commit queued status and re-raise
            # so Celery's retry mechanism picks it up.
            err_str = str(exc).lower()
            is_transient = any(k in err_str for k in ("rate_limit", "rate limit", "connection", "timeout", "overloaded"))
            if is_transient and not getattr(exc, "_already_retried", False):
                run.status = "queued"
                run.error_text = "Transient error — will retry: {}".format(str(exc)[:200])
                run.completed_at = None
                db.commit()  # commit before re-raise; session_scope rollback is a no-op after commit
                raise
            run.status = "failed"
            run.error_text = str(exc)[:500]
            run.completed_at = datetime.utcnow()
            sse.publish(ws_id, {
                "type": "run.failed",
                "run_id": run_id,
                "error": run.error_text,
            })


@celery_app.task(name="backend.tasks.execute_run_task", bind=True, max_retries=3)
def execute_run_task(self, run_id: str) -> None:
    """Celery-wrapped run execution. Retries up to 3x on unexpected failure."""
    try:
        execute_run(run_id)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


# ── Approval resume ────────────────────────────────────────────────────────────

def resume_run(run_id: str) -> None:
    """
    Resume a run that was paused awaiting tool call approval.
    Executes approved calls, notes denied ones, then asks the LLM for
    a final decision that incorporates the outcomes.
    """
    from .models import Run, Tool, ToolCall, User
    from .tool_executors import execute_tool

    with session_scope() as db:
        run = db.query(Run).filter_by(id=run_id).first()
        if not run or run.status != "awaiting_approval":
            return

        # Ensure nothing is still pending
        still_pending = db.query(ToolCall).filter_by(run_id=run.id, status="pending_approval").count()
        if still_pending:
            return

        ws_id = run.workspace_id or run.user_id
        run.status = "running"
        db.flush()
        sse.publish(ws_id, {"type": "run.started", "run_id": run_id})

        try:
            from sqlalchemy import func as _func
            from .models import RunStep
            last_idx = db.query(_func.max(RunStep.step_index)).filter(RunStep.run_id == run.id).scalar()
            step_counter = [0 if last_idx is None else last_idx + 1]

            tool_calls = db.query(ToolCall).filter_by(run_id=run.id).order_by(ToolCall.requested_at).all()
            outcomes = []

            for tc in tool_calls:
                tool = db.query(Tool).filter_by(id=tc.tool_id).first()
                tool_label = tool.description or tool.name if tool else "action"
                tool_name = tool.name if tool else "unknown"

                if tc.status == "approved":
                    try:
                        result = execute_tool(db, tc, tool, ws_id)
                        tc.result = json.dumps(result)
                        tc.status = "executed"
                        tc.executed_at = datetime.utcnow()
                        result_str = json.dumps(result)
                        outcomes.append("- {} → approved and completed (result: {})".format(
                            tool_label, result_str
                        ))
                        _add_step(db, run.id, step_counter, "approval_granted",
                                  "Approved and executed: {}".format(tool_name),
                                  {"tool_name": tool_name, "tool_call_id": tc.id, "verdict": "approved"})
                        _add_step(db, run.id, step_counter, "tool_executed",
                                  result_str[:500],
                                  {"tool_name": tool_name, "tool_call_id": tc.id})
                    except Exception as exc:
                        tc.status = "failed"
                        tc.error = str(exc)
                        tc.executed_at = datetime.utcnow()
                        outcomes.append("- {} → approved but failed: {}".format(tool_label, exc))
                        _add_step(db, run.id, step_counter, "approval_granted",
                                  "Approved but failed: {}".format(tool_name),
                                  {"tool_name": tool_name, "tool_call_id": tc.id, "verdict": "approved"})
                        _add_step(db, run.id, step_counter, "tool_failed",
                                  str(exc)[:500],
                                  {"tool_name": tool_name, "tool_call_id": tc.id, "error": str(exc)})
                elif tc.status == "denied":
                    outcomes.append("- {} → denied by the reviewer, not executed".format(tool_label))
                    _add_step(db, run.id, step_counter, "approval_granted",
                              "Denied: {}".format(tool_name),
                              {"tool_name": tool_name, "tool_call_id": tc.id, "verdict": "denied"})

            db.flush()

            user = db.query(User).filter_by(id=run.user_id).first()
            from .llm_client import PROVIDERS
            brain_content = _assemble_brain(run.brain_id, db)
            system = RUN_SYSTEM_PROMPT.format(brain=brain_content)
            provider = user.llm_provider or "anthropic"
            model = PROVIDERS.get(provider, PROVIDERS["anthropic"])["default_model"]

            resume_prompt = (
                "CASE:\n\n{case}\n\n"
                "---\n\n"
                "The following actions were requested and reviewed by a human:\n"
                "{outcomes}\n\n"
                "Please provide your complete decision, taking these outcomes into account."
            ).format(case=run.case_text, outcomes="\n".join(outcomes))

            if provider == "anthropic":
                import anthropic
                from .crypto import decrypt_key
                api_key = decrypt_key(user.encrypted_anthropic_key)
                client = anthropic.Anthropic(api_key=api_key)
                resp = client.messages.create(
                    model=model,
                    max_tokens=2048,
                    system=system,
                    messages=[{"role": "user", "content": resume_prompt}],
                )
                decision = resp.content[0].text
                run.tokens_in = (run.tokens_in or 0) + resp.usage.input_tokens
                run.tokens_out = (run.tokens_out or 0) + resp.usage.output_tokens
            else:
                from .llm_client import call_llm
                decision = call_llm(
                    user, system,
                    [{"role": "user", "content": resume_prompt}],
                    max_tokens=2048,
                )

            _add_step(db, run.id, step_counter, "final_decision", decision)
            run.decision_text = decision
            run.cited_rules = json.dumps(_extract_cited_rules(decision))
            run.model_used = model
            run.status = "completed"
            run.completed_at = datetime.utcnow()
            sse.publish(ws_id, {"type": "run.completed", "run_id": run_id, "status": "completed"})

        except Exception as exc:
            run.status = "failed"
            run.error_text = str(exc)
            run.completed_at = datetime.utcnow()
            sse.publish(ws_id, {"type": "run.failed", "run_id": run_id, "error": run.error_text})


@celery_app.task(name="backend.tasks.resume_run_task", bind=True, max_retries=3)
def resume_run_task(self, run_id: str) -> None:
    try:
        resume_run(run_id)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


# ── Schedule polling ──────────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.check_scheduled_triggers")
def check_scheduled_triggers() -> None:
    """
    Runs every minute via beat. Checks all active schedule triggers and fires
    any whose cron expression has elapsed since the last fire.
    """
    try:
        from croniter import croniter
    except ImportError:
        return  # croniter not installed — skip

    from .models import Brain, Run, Trigger, User

    now = datetime.utcnow()

    with session_scope() as db:
        triggers = (
            db.query(Trigger)
            .filter_by(kind="schedule", is_active=True)
            .all()
        )
        for trigger in triggers:
            if not trigger.cron_expression:
                continue
            try:
                # Anchor iterator to last_fired_at (or 2 min ago to catch startup)
                from datetime import timedelta
                anchor = trigger.last_fired_at or (now - timedelta(minutes=2))
                cron = croniter(trigger.cron_expression, anchor)
                next_fire = cron.get_next(datetime)
                if next_fire > now:
                    continue  # not yet due

                brain = db.query(Brain).filter_by(id=trigger.brain_id).first()
                owner = db.query(User).filter_by(id=brain.owner_id).first() if brain else None
                if not brain or not owner or not owner.encrypted_anthropic_key:
                    continue

                case_text = "Scheduled trigger: {} (fired at {})".format(
                    trigger.name, now.strftime("%Y-%m-%d %H:%M UTC")
                )
                run = Run(
                    brain_id=trigger.brain_id,
                    user_id=owner.id,
                    workspace_id=trigger.workspace_id,
                    trigger_id=trigger.id,
                    case_text=case_text,
                    status="queued",
                    model_used="",
                    created_at=now,
                )
                db.add(run)
                trigger.last_fired_at = now
                db.flush()
                execute_run_task.delay(run.id)
            except Exception:
                pass


# ── Maintainer ─────────────────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.run_maintainer_for_brain")
def run_maintainer_for_brain(brain_id: str) -> None:
    """Analyze one brain and create MaintainerSuggestion rows for detected patterns."""
    from datetime import timedelta
    from collections import Counter
    from .models import Brain, BrainTool, Escalation, MaintainerSuggestion, Review, Run, ToolCall, User

    with session_scope() as db:
        brain = db.query(Brain).filter_by(id=brain_id).first()
        if not brain:
            return

        owner = db.query(User).filter_by(id=brain.owner_id).first()
        if not owner or not owner.encrypted_anthropic_key:
            return

        now = datetime.utcnow()
        window = now - timedelta(days=30)

        recent_runs = (
            db.query(Run)
            .filter(Run.brain_id == brain_id, Run.created_at >= window)
            .all()
        )
        run_ids = [r.id for r in recent_runs]

        findings = []  # list of {pattern_type, finding, target_file}

        # ── Pattern 1: recurring escalations ──────────────────────────────
        if run_ids:
            escs = db.query(Escalation).filter(Escalation.run_id.in_(run_ids)).all()
            tool_counts: Counter = Counter()
            for e in escs:
                if e.tool_call and e.tool_call.tool:
                    tool_counts[e.tool_call.tool.name] += 1
            for tool_name, count in tool_counts.items():
                if count >= 3:
                    findings.append({
                        "pattern_type": "recurring_escalation",
                        "finding": (
                            "The '{}' action has been escalated {} times in the last 30 days. "
                            "Consider codifying when it should run automatically vs require review."
                        ).format(tool_name, count),
                        "target_file": "05-guardrails.md",
                    })

        # ── Pattern 2: repeated corrections ───────────────────────────────
        if run_ids:
            corrections = (
                db.query(Review)
                .filter(Review.run_id.in_(run_ids), Review.verdict == "corrected")
                .all()
            )
            if len(corrections) >= 3:
                snippets = [
                    (c.corrected_decision or "")[:80]
                    for c in corrections[:3]
                    if c.corrected_decision
                ]
                findings.append({
                    "pattern_type": "repeated_corrections",
                    "finding": (
                        "This brain was corrected {} times in the last 30 days. "
                        "Sample corrections: {}. The decision rules may be missing key cases."
                    ).format(len(corrections), " | ".join(snippets)),
                    "target_file": "03-decision-rules.md",
                })

        # ── Pattern 3: high rejection/correction rate ──────────────────────
        if run_ids:
            reviewed = [r for r in recent_runs if r.status == "completed" and r.review]
            if len(reviewed) >= 5:
                bad = [r for r in reviewed if r.review.verdict in ("rejected", "corrected")]
                rate = len(bad) / len(reviewed)
                if rate >= 0.4:
                    findings.append({
                        "pattern_type": "drifting_eval",
                        "finding": (
                            "{}% of reviewed decisions were corrected or rejected "
                            "({}/{} runs). The brain's rules may be drifting from reality."
                        ).format(int(rate * 100), len(bad), len(reviewed)),
                        "target_file": "03-decision-rules.md",
                    })

        # ── Pattern 4: quiet brain ─────────────────────────────────────────
        if not recent_runs:
            any_run = db.query(Run).filter_by(brain_id=brain_id).first()
            if any_run:
                findings.append({
                    "pattern_type": "quiet_brain",
                    "finding": (
                        "This brain hasn't been used in over 30 days. "
                        "It may need reviewing to ensure it still reflects current practice."
                    ),
                    "target_file": "01-service-definition.md",
                })

        if not findings:
            return

        # Deduplicate: skip pattern types that already have a pending suggestion
        existing_patterns = {
            s.pattern_type
            for s in db.query(MaintainerSuggestion)
            .filter_by(brain_id=brain_id, status="pending")
            .all()
        }
        new_findings = [f for f in findings if f["pattern_type"] not in existing_patterns]
        if not new_findings:
            return

        # Generate proposed diffs via LLM
        brain_content = _assemble_brain(brain_id, db)
        try:
            from .llm_client import PROVIDERS
            from .crypto import decrypt_key
            import anthropic as _anthropic
            api_key = decrypt_key(owner.encrypted_anthropic_key)
            client = _anthropic.Anthropic(api_key=api_key)
            provider = owner.llm_provider or "anthropic"
            model = PROVIDERS.get(provider, PROVIDERS["anthropic"])["default_model"]
        except Exception:
            return

        for f in new_findings:
            try:
                prompt = (
                    "You are a brain maintainer. Given the brain content below and a detected pattern, "
                    "propose a specific, concrete improvement.\n\n"
                    "BRAIN CONTENT (excerpt):\n{brain}\n\n"
                    "DETECTED PATTERN:\n{finding}\n\n"
                    "TARGET FILE: {target_file}\n\n"
                    "Write ONLY the specific markdown text to append to {target_file}. "
                    "Start your response with exactly: APPEND TO {target_file}:\n\n"
                    "Then write the rule, guardrail, or update to add."
                ).format(
                    brain=brain_content[:3000],
                    finding=f["finding"],
                    target_file=f["target_file"],
                )

                resp = client.messages.create(
                    model=model,
                    max_tokens=512,
                    messages=[{"role": "user", "content": prompt}],
                )
                proposed_diff = resp.content[0].text.strip()
            except Exception:
                proposed_diff = "APPEND TO {}:\n\n<!-- Maintainer: review finding: {} -->".format(
                    f["target_file"], f["finding"][:200]
                )

            db.add(MaintainerSuggestion(
                workspace_id=brain.workspace_id,
                brain_id=brain_id,
                pattern_type=f["pattern_type"],
                finding=f["finding"],
                proposed_diff=proposed_diff,
                target_file=f["target_file"],
                status="pending",
                created_at=now,
            ))

        db.commit()


@celery_app.task(name="backend.tasks.run_maintainer_for_all")
def run_maintainer_for_all() -> None:
    """Daily beat task: run the maintainer for every active brain."""
    from .models import Brain
    with session_scope() as db:
        brain_ids = [b.id for b in db.query(Brain.id).all()]
    for brain_id in brain_ids:
        run_maintainer_for_brain.delay(brain_id)
