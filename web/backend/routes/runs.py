import json
import os
import re
from datetime import datetime, date

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db, session_scope
from ..llm_client import call_llm, PROVIDERS
from ..models import Brain, BrainFile, GeneratedEval, Review, Run, User
from ..schemas import (
    CreateReviewRequest, CreateRunRequest, EvalSyncOut,
    RunListItem, RunOut, UnsyncedCountOut,
)

router = APIRouter()

RUN_DAILY_CAP = int(os.environ.get("RUN_DAILY_CAP", "50"))

# Anthropic pricing (per million tokens, as of 2025)
_INPUT_COST_PER_M = 3.0
_OUTPUT_COST_PER_M = 15.0

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


def _cost_usd(tokens_in: int, tokens_out: int) -> float:
    return round(
        (tokens_in / 1_000_000) * _INPUT_COST_PER_M
        + (tokens_out / 1_000_000) * _OUTPUT_COST_PER_M,
        6,
    )


def _run_to_out(run: Run) -> RunOut:
    cited = []
    try:
        cited = json.loads(run.cited_rules or "[]")
    except Exception:
        pass
    return RunOut(
        id=run.id,
        brain_id=run.brain_id,
        case_text=run.case_text,
        case_filename=run.case_filename,
        decision_text=run.decision_text,
        cited_rules=cited,
        model_used=run.model_used,
        tokens_in=run.tokens_in,
        tokens_out=run.tokens_out,
        status=run.status,
        error_text=run.error_text,
        created_at=run.created_at,
        completed_at=run.completed_at,
        review=run.review,
        cost_usd=_cost_usd(run.tokens_in, run.tokens_out),
    )


def _run_to_list_item(run: Run) -> RunListItem:
    verdict = run.review.verdict if run.review else None
    return RunListItem(
        id=run.id,
        case_text=run.case_text,
        case_filename=run.case_filename,
        decision_text=run.decision_text,
        status=run.status,
        created_at=run.created_at,
        verdict=verdict,
        cost_usd=_cost_usd(run.tokens_in, run.tokens_out),
    )


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _extract_cited_rules(decision_text: str) -> list[str]:
    """Extract bullet points from the ## Rules applied section."""
    rules: list[str] = []
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


def _assemble_brain(brain_id: str, db: Session) -> str:
    files = db.query(BrainFile).filter_by(brain_id=brain_id).order_by(BrainFile.filename).all()
    skip = {"brain-readme.md", "progress.md"}
    parts = [
        f"=== {f.filename} ===\n{f.content}"
        for f in files
        if f.content and f.content.strip() and f.filename not in skip
    ]
    return "\n\n".join(parts)


def execute_run(run_id: str) -> None:
    """Background task: call the LLM and update the run record."""
    with session_scope() as db:
        run = db.query(Run).filter_by(id=run_id).first()
        if not run:
            return
        user = db.query(User).filter_by(id=run.user_id).first()
        if not user:
            run.status = "failed"
            run.error_text = "User not found"
            return

        try:
            brain_content = _assemble_brain(run.brain_id, db)
            if not brain_content.strip():
                raise ValueError("This brain has no content yet. Complete the interview first.")

            system = RUN_SYSTEM_PROMPT.format(brain=brain_content)
            provider = user.llm_provider or "anthropic"
            model = PROVIDERS.get(provider, PROVIDERS["anthropic"])["default_model"]

            # call_llm doesn't expose token counts, so call Anthropic directly
            # to capture usage. Fall back to call_llm for non-Anthropic providers.
            if provider == "anthropic":
                import anthropic
                from ..crypto import decrypt_key
                api_key = decrypt_key(user.encrypted_anthropic_key)
                client = anthropic.Anthropic(api_key=api_key)
                resp = client.messages.create(
                    model=model,
                    max_tokens=2048,
                    system=system,
                    messages=[{"role": "user", "content": f"CASE:\n\n{run.case_text}"}],
                )
                decision = resp.content[0].text
                run.tokens_in = resp.usage.input_tokens
                run.tokens_out = resp.usage.output_tokens
            else:
                decision = call_llm(
                    user, system,
                    [{"role": "user", "content": f"CASE:\n\n{run.case_text}"}],
                    max_tokens=2048,
                )
                run.tokens_in = 0
                run.tokens_out = 0

            run.decision_text = decision
            run.cited_rules = json.dumps(_extract_cited_rules(decision))
            run.model_used = model
            run.status = "completed"
            run.completed_at = datetime.utcnow()

        except Exception as exc:
            run.status = "failed"
            run.error_text = str(exc)
            run.completed_at = datetime.utcnow()


# ── IMPORTANT: register /unsynced-count BEFORE /{run_id} ─────────────────────

@router.get("/api/brains/{slug}/runs/unsynced-count", response_model=UnsyncedCountOut)
def unsynced_count(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    count = (
        db.query(GeneratedEval)
        .filter_by(brain_id=brain.id, written_back=False)
        .count()
    )
    return UnsyncedCountOut(count=count)


@router.post("/api/brains/{slug}/runs")
def create_run(
    slug: str,
    body: CreateRunRequest,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)

    if not user.encrypted_anthropic_key:
        raise HTTPException(status_code=400, detail="No API key configured. Add one in Settings.")

    # Daily cap check
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    runs_today = (
        db.query(Run)
        .filter(Run.user_id == user.id, Run.created_at >= today_start)
        .count()
    )
    if runs_today >= RUN_DAILY_CAP:
        raise HTTPException(
            status_code=429,
            detail=f"Daily run limit of {RUN_DAILY_CAP} reached. Try again tomorrow.",
        )

    if not body.case_text.strip():
        raise HTTPException(status_code=400, detail="Case text cannot be empty.")

    run = Run(
        brain_id=brain.id,
        user_id=user.id,
        case_text=body.case_text.strip(),
        case_filename=body.case_filename,
        status="pending",
        model_used="",
        created_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    background.add_task(execute_run, run.id)
    return {"run_id": run.id, "status": "pending"}


@router.get("/api/brains/{slug}/runs", response_model=list[RunListItem])
def list_runs(
    slug: str,
    limit: int = 20,
    offset: int = 0,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    runs = (
        db.query(Run)
        .filter_by(brain_id=brain.id, user_id=user.id)
        .order_by(Run.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [_run_to_list_item(r) for r in runs]


@router.get("/api/brains/{slug}/runs/{run_id}", response_model=RunOut)
def get_run(
    slug: str,
    run_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    run = db.query(Run).filter_by(id=run_id, brain_id=brain.id, user_id=user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_out(run)


@router.post("/api/runs/{run_id}/review")
def create_review(
    run_id: str,
    body: CreateReviewRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    run = db.query(Run).filter_by(id=run_id, user_id=user.id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status != "completed":
        raise HTTPException(status_code=400, detail="Can only review completed runs.")
    if run.review:
        raise HTTPException(status_code=409, detail="This run already has a review.")
    if body.verdict not in ("approved", "corrected", "rejected"):
        raise HTTPException(status_code=400, detail="verdict must be approved, corrected, or rejected")
    if body.verdict == "corrected" and not body.corrected_decision:
        raise HTTPException(status_code=400, detail="corrected_decision is required when verdict is corrected")

    review = Review(
        run_id=run.id,
        user_id=user.id,
        verdict=body.verdict,
        notes=body.notes,
        corrected_decision=body.corrected_decision,
        created_at=datetime.utcnow(),
    )
    db.add(review)
    db.flush()

    if body.verdict == "corrected":
        gen_eval = GeneratedEval(
            review_id=review.id,
            brain_id=run.brain_id,
            case_text=run.case_text,
            expected_outcome=body.corrected_decision,
            difficulty="edge",
            source="production correction",
            written_back=False,
            created_at=datetime.utcnow(),
        )
        db.add(gen_eval)

    db.commit()
    return {"ok": True, "verdict": body.verdict, "eval_created": body.verdict == "corrected"}


@router.post("/api/brains/{slug}/evals/sync", response_model=EvalSyncOut)
def sync_evals(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)

    pending = (
        db.query(GeneratedEval)
        .filter_by(brain_id=brain.id, written_back=False)
        .all()
    )
    if not pending:
        return EvalSyncOut(synced_count=0)

    # Load existing 03-evals.json
    bf = db.query(BrainFile).filter_by(brain_id=brain.id, filename="03-evals.json").first()
    try:
        existing = json.loads(bf.content) if bf and bf.content and bf.content.strip() else []
        if not isinstance(existing, list):
            existing = []
    except Exception:
        existing = []

    for ev in pending:
        existing.append({
            "case": ev.case_text,
            "expected_outcome": ev.expected_outcome,
            "difficulty": ev.difficulty,
            "source": ev.source,
        })
        ev.written_back = True

    now = datetime.utcnow()
    new_content = json.dumps(existing, indent=2)
    if bf:
        bf.content = new_content
        bf.updated_at = now
    else:
        bf = BrainFile(brain_id=brain.id, filename="03-evals.json", content=new_content, updated_at=now)
        db.add(bf)

    brain.updated_at = now
    db.commit()
    return EvalSyncOut(synced_count=len(pending))
