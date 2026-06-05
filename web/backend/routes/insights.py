"""
Workspace-level maintainer feed — cross-brain suggestions + recent audit activity.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from collections import Counter
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import AuditLog, Brain, BrainFile, MaintainerSuggestion, User, Workspace

router = APIRouter()

PATTERN_LABELS = {
    "recurring_escalation": "Recurring escalation",
    "repeated_corrections": "Repeated corrections",
    "drifting_eval": "Drifting accuracy",
    "quiet_brain": "Unused brain",
    "silent_corrections": "Silent corrections",
    "untouched_brain": "Untouched brain",
}


def _get_workspace(db: Session, user: User) -> Workspace:
    ws = db.query(Workspace).filter_by(owner_id=user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


def _suggestion_out(s: MaintainerSuggestion, brain_slug: str, brain_name: str) -> dict:
    return {
        "id": s.id,
        "brain_slug": brain_slug,
        "brain_name": brain_name,
        "pattern_type": s.pattern_type,
        "finding": s.finding,
        "proposed_diff": s.proposed_diff,
        "target_file": s.target_file,
        "status": s.status,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "resolved_at": s.resolved_at.isoformat() if s.resolved_at else None,
    }


@router.get("/api/workspace/insights")
def get_workspace_insights(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    ws = _get_workspace(db, user)

    # Bulk-fetch all brains for this workspace
    brains = db.query(Brain).filter_by(owner_id=user.id).all()
    brain_ids = [b.id for b in brains]
    brain_by_id = {b.id: b for b in brains}

    if not brain_ids:
        return {
            "pending_count": 0,
            "brains_with_pending": 0,
            "accepted_this_week": 0,
            "dismissed_this_week": 0,
            "pattern_summary": [],
            "suggestions": [],
            "recent_activity": [],
        }

    week_ago = datetime.utcnow() - timedelta(days=7)

    # All pending suggestions across workspace
    pending_suggestions = (
        db.query(MaintainerSuggestion)
        .filter(
            MaintainerSuggestion.brain_id.in_(brain_ids),
            MaintainerSuggestion.status == "pending",
        )
        .order_by(MaintainerSuggestion.created_at.desc())
        .all()
    )

    # Accepted/dismissed this week
    accepted_this_week = (
        db.query(MaintainerSuggestion)
        .filter(
            MaintainerSuggestion.brain_id.in_(brain_ids),
            MaintainerSuggestion.status == "accepted",
            MaintainerSuggestion.resolved_at >= week_ago,
        )
        .count()
    )
    dismissed_this_week = (
        db.query(MaintainerSuggestion)
        .filter(
            MaintainerSuggestion.brain_id.in_(brain_ids),
            MaintainerSuggestion.status == "dismissed",
            MaintainerSuggestion.resolved_at >= week_ago,
        )
        .count()
    )

    # Pattern breakdown
    pattern_counts = Counter(s.pattern_type for s in pending_suggestions)
    pattern_summary = [
        {
            "pattern_type": pt,
            "label": PATTERN_LABELS.get(pt, pt),
            "count": count,
        }
        for pt, count in pattern_counts.most_common()
    ]

    # Brains with at least one pending suggestion
    brains_with_pending = len({s.brain_id for s in pending_suggestions})

    # Recent workspace audit log (last 20 entries)
    recent_activity = (
        db.query(AuditLog)
        .filter_by(workspace_id=ws.id)
        .order_by(AuditLog.occurred_at.desc())
        .limit(20)
        .all()
    )

    suggestions_out = []
    for s in pending_suggestions:
        b = brain_by_id.get(s.brain_id)
        if b:
            suggestions_out.append(_suggestion_out(s, b.slug, b.name))

    activity_out = [
        {
            "id": e.id,
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
            "actor_id": e.actor_id,
        }
        for e in recent_activity
    ]

    return {
        "pending_count": len(pending_suggestions),
        "brains_with_pending": brains_with_pending,
        "accepted_this_week": accepted_this_week,
        "dismissed_this_week": dismissed_this_week,
        "pattern_summary": pattern_summary,
        "suggestions": suggestions_out,
        "recent_activity": activity_out,
    }


# ── Must be registered before /{suggestion_id} routes ──────────────────────────

@router.post("/api/workspace/insights/trigger-all")
def trigger_all_maintainer(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Queue maintainer analysis for every brain in the workspace."""
    brains = db.query(Brain).filter_by(owner_id=user.id).all()
    queued = 0
    for brain in brains:
        try:
            from ..tasks import run_maintainer_for_brain
            run_maintainer_for_brain.delay(brain.id)
            queued += 1
        except Exception:
            from ..tasks import run_maintainer_for_brain
            run_maintainer_for_brain(brain.id)
            queued += 1
    return {"ok": True, "queued": queued}


@router.post("/api/workspace/insights/{suggestion_id}/accept")
def accept_workspace_suggestion(
    suggestion_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Accept a suggestion from the workspace feed — applies the diff to the target brain file."""
    suggestion = (
        db.query(MaintainerSuggestion)
        .join(Brain, Brain.id == MaintainerSuggestion.brain_id)
        .filter(
            MaintainerSuggestion.id == suggestion_id,
            MaintainerSuggestion.status == "pending",
            Brain.owner_id == user.id,
        )
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    brain = db.query(Brain).filter_by(id=suggestion.brain_id).first()

    proposed = (suggestion.proposed_diff or "").strip()
    prefix = "APPEND TO {}:".format(suggestion.target_file)
    content_to_add = proposed[len(prefix):].strip() if proposed.startswith(prefix) else proposed

    if content_to_add and suggestion.target_file:
        bf = db.query(BrainFile).filter_by(brain_id=brain.id, filename=suggestion.target_file).first()
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
    return {"ok": True}


@router.post("/api/workspace/insights/{suggestion_id}/dismiss")
def dismiss_workspace_suggestion(
    suggestion_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    suggestion = (
        db.query(MaintainerSuggestion)
        .join(Brain, Brain.id == MaintainerSuggestion.brain_id)
        .filter(
            MaintainerSuggestion.id == suggestion_id,
            MaintainerSuggestion.status == "pending",
            Brain.owner_id == user.id,
        )
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion.status = "dismissed"
    suggestion.resolved_at = datetime.utcnow()
    db.commit()
    return {"ok": True}
