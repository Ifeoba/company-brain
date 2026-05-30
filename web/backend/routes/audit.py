"""
Audit log API — read-only view of workspace activity.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import json

from ..auth import current_user
from ..db import get_db
from ..models import AuditLog, User, Workspace
from fastapi import HTTPException

router = APIRouter()


def _get_workspace(db: Session, user: User) -> Workspace:
    ws = db.query(Workspace).filter_by(owner_id=user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.get("/api/workspace/audit-log")
def get_audit_log(
    limit: int = 100,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Return the most recent audit log entries for this workspace."""
    ws = _get_workspace(db, user)
    entries = (
        db.query(AuditLog)
        .filter_by(workspace_id=ws.id)
        .order_by(AuditLog.occurred_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": e.id,
            "action": e.action,
            "resource_type": e.resource_type,
            "resource_id": e.resource_id,
            "details": _safe_json(e.details_json),
            "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
            "actor_id": e.actor_id,
        }
        for e in entries
    ]


def _safe_json(raw: str) -> dict:
    try:
        return json.loads(raw or "{}")
    except Exception:
        return {}
