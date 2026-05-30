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


def execute_run(run_id: str, workspace_id: Optional[str] = None) -> None:
    """
    Core run logic. Called directly from BackgroundTasks or from the Celery task.
    Emits SSE events on status transitions.
    """
    from .models import Run, User

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

            if provider == "anthropic":
                import anthropic
                from .crypto import decrypt_key
                api_key = decrypt_key(user.encrypted_anthropic_key)
                client = anthropic.Anthropic(api_key=api_key)
                resp = client.messages.create(
                    model=model,
                    max_tokens=2048,
                    system=system,
                    messages=[{"role": "user", "content": "CASE:\n\n{}".format(run.case_text)}],
                )
                decision = resp.content[0].text
                run.tokens_in = resp.usage.input_tokens
                run.tokens_out = resp.usage.output_tokens
            else:
                from .llm_client import call_llm
                decision = call_llm(
                    user, system,
                    [{"role": "user", "content": "CASE:\n\n{}".format(run.case_text)}],
                    max_tokens=2048,
                )
                run.tokens_in = 0
                run.tokens_out = 0

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
            run.status = "failed"
            run.error_text = str(exc)
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


# ── Maintainer ─────────────────────────────────────────────────────────────────

@celery_app.task(name="backend.tasks.run_maintainer_for_brain")
def run_maintainer_for_brain(brain_id: str) -> None:
    """Analyze one brain and create MaintainerSuggestion rows. Week 7 implementation."""
    pass


@celery_app.task(name="backend.tasks.run_maintainer_for_all")
def run_maintainer_for_all() -> None:
    """Daily beat task: run the maintainer for every active brain."""
    from .models import Brain
    with session_scope() as db:
        brain_ids = [b.id for b in db.query(Brain.id).all()]
    for brain_id in brain_ids:
        run_maintainer_for_brain.delay(brain_id)
