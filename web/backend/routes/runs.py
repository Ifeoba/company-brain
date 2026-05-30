import json
import os
from datetime import datetime, date
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, BrainFile, GeneratedEval, Review, Run, User
from ..schemas import (
    CreateReviewRequest, CreateRunRequest, EvalSyncOut,
    RunListItem, RunOut, UnsyncedCountOut,
)

router = APIRouter()

RUN_DAILY_CAP = int(os.environ.get("RUN_DAILY_CAP", "50"))

_INPUT_COST_PER_M = 3.0
_OUTPUT_COST_PER_M = 15.0


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


def _dispatch_run(run_id: str, background: BackgroundTasks) -> None:
    """Use Celery when available; fall back to FastAPI BackgroundTasks."""
    try:
        from ..tasks import execute_run_task
        execute_run_task.delay(run_id)
    except Exception:
        from ..tasks import execute_run
        background.add_task(execute_run, run_id)


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

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    runs_today = (
        db.query(Run)
        .filter(Run.user_id == user.id, Run.created_at >= today_start)
        .count()
    )
    if runs_today >= RUN_DAILY_CAP:
        raise HTTPException(
            status_code=429,
            detail="Daily run limit of {} reached. Try again tomorrow.".format(RUN_DAILY_CAP),
        )

    if not body.case_text.strip():
        raise HTTPException(status_code=400, detail="Case text cannot be empty.")

    run = Run(
        brain_id=brain.id,
        user_id=user.id,
        workspace_id=brain.workspace_id,
        case_text=body.case_text.strip(),
        case_filename=body.case_filename,
        status="queued",
        model_used="",
        created_at=datetime.utcnow(),
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    _dispatch_run(run.id, background)
    return {"run_id": run.id, "status": "queued"}


@router.get("/api/brains/{slug}/runs", response_model=list)
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


@router.get("/api/brains/{slug}/runs/{run_id}")
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
            workspace_id=run.workspace_id,
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
