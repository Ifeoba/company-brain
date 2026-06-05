"""
Maintainer service routes — brain improvement suggestions.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, BrainFile, MaintainerSuggestion, User

router = APIRouter()


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _suggestion_out(s: MaintainerSuggestion) -> dict:
    return {
        "id": s.id,
        "pattern_type": s.pattern_type,
        "finding": s.finding,
        "proposed_diff": s.proposed_diff,
        "target_file": s.target_file,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "resolved_at": s.resolved_at.isoformat() if s.resolved_at else None,
    }


PATTERN_LABELS = {
    "recurring_escalation": "Recurring escalation",
    "repeated_corrections": "Repeated corrections",
    "drifting_eval": "Drifting accuracy",
    "quiet_brain": "Unused brain",
    "silent_corrections": "Silent corrections",
    "untouched_brain": "Untouched brain",
}


@router.get("/api/brains/{slug}/suggestions")
def list_suggestions(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    suggestions = (
        db.query(MaintainerSuggestion)
        .filter_by(brain_id=brain.id, status="pending")
        .order_by(MaintainerSuggestion.created_at.desc())
        .all()
    )
    return [_suggestion_out(s) for s in suggestions]


@router.post("/api/brains/{slug}/suggestions/{suggestion_id}/accept")
def accept_suggestion(
    slug: str,
    suggestion_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """
    Accept a suggestion: append its proposed_diff to the target brain file,
    then mark it accepted.
    """
    brain = _get_brain(db, slug, user)
    suggestion = db.query(MaintainerSuggestion).filter_by(
        id=suggestion_id, brain_id=brain.id, status="pending"
    ).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    # Parse the proposed diff — expected format: "APPEND TO {filename}:\n\n{content}"
    proposed = (suggestion.proposed_diff or "").strip()
    prefix = "APPEND TO {}:".format(suggestion.target_file)
    if proposed.startswith(prefix):
        content_to_add = proposed[len(prefix):].strip()
    else:
        content_to_add = proposed  # fall back: append as-is

    if content_to_add:
        bf = db.query(BrainFile).filter_by(
            brain_id=brain.id, filename=suggestion.target_file
        ).first()
        if bf:
            bf.content = (bf.content or "").rstrip() + "\n\n" + content_to_add
            bf.updated_at = datetime.utcnow()
        else:
            bf = BrainFile(
                brain_id=brain.id,
                filename=suggestion.target_file,
                content=content_to_add,
                updated_at=datetime.utcnow(),
            )
            db.add(bf)
        brain.updated_at = datetime.utcnow()

    suggestion.status = "accepted"
    suggestion.accepted_by_user_id = user.id
    suggestion.resolved_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "target_file": suggestion.target_file}


@router.post("/api/brains/{slug}/suggestions/{suggestion_id}/dismiss")
def dismiss_suggestion(
    slug: str,
    suggestion_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    suggestion = db.query(MaintainerSuggestion).filter_by(
        id=suggestion_id, brain_id=brain.id, status="pending"
    ).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion.status = "dismissed"
    suggestion.resolved_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/api/brains/{slug}/suggestions/trigger")
def trigger_maintainer(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Manually trigger the maintainer analysis for this brain (dev/testing)."""
    brain = _get_brain(db, slug, user)
    try:
        from ..tasks import run_maintainer_for_brain
        run_maintainer_for_brain.delay(brain.id)
        queued = True
    except Exception:
        from ..tasks import run_maintainer_for_brain
        run_maintainer_for_brain(brain.id)
        queued = False
    return {"ok": True, "queued": queued}
