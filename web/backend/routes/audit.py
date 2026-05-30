"""
Audit log API — read-only view of workspace activity.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import json

from ..auth import current_user
from ..db import get_db
from ..models import AuditLog, User, Workspace

router = APIRouter()


def _get_workspace(db: Session, user: User) -> Workspace:
    ws = db.query(Workspace).filter_by(owner_id=user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


def _safe_json(raw: str) -> dict:
    try:
        return json.loads(raw or "{}")
    except Exception:
        return {}


def _entry_out(e: AuditLog) -> dict:
    return {
        "id": e.id,
        "action": e.action,
        "resource_type": e.resource_type,
        "resource_id": e.resource_id,
        "details": _safe_json(e.details_json),
        "occurred_at": e.occurred_at.isoformat() if e.occurred_at else None,
        "actor_id": e.actor_id,
    }


def _build_query(db, ws_id, action, resource_type, from_date, to_date):
    q = db.query(AuditLog).filter_by(workspace_id=ws_id)
    if action:
        q = q.filter(AuditLog.action.ilike("%{}%".format(action)))
    if resource_type:
        q = q.filter(AuditLog.resource_type.ilike("%{}%".format(resource_type)))
    if from_date:
        try:
            q = q.filter(AuditLog.occurred_at >= datetime.fromisoformat(from_date))
        except ValueError:
            pass
    if to_date:
        try:
            q = q.filter(AuditLog.occurred_at <= datetime.fromisoformat(to_date))
        except ValueError:
            pass
    return q


# ── Legacy endpoint (keep for existing AuditLogModal) ────────────────────────

@router.get("/api/workspace/audit-log")
def get_audit_log(
    limit: int = 100,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    ws = _get_workspace(db, user)
    entries = (
        db.query(AuditLog)
        .filter_by(workspace_id=ws.id)
        .order_by(AuditLog.occurred_at.desc())
        .limit(limit)
        .all()
    )
    return [_entry_out(e) for e in entries]


# ── Enhanced filtered endpoint ────────────────────────────────────────────────

@router.get("/api/workspace/audit/export.csv")
def export_audit_csv(
    action: str = None,
    resource_type: str = None,
    from_date: str = None,
    to_date: str = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """CSV export — download all matching entries (up to 10,000)."""
    ws = _get_workspace(db, user)
    q = _build_query(db, ws.id, action, resource_type, from_date, to_date)
    entries = q.order_by(AuditLog.occurred_at.desc()).limit(10000).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "occurred_at", "action", "resource_type", "resource_id", "actor_id"])
    for e in entries:
        writer.writerow([
            e.id,
            e.occurred_at.isoformat() if e.occurred_at else "",
            e.action,
            e.resource_type,
            e.resource_id or "",
            e.actor_id or "",
        ])

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="audit-log.csv"'},
    )


@router.get("/api/workspace/audit")
def get_audit_filtered(
    action: str = None,
    resource_type: str = None,
    from_date: str = None,
    to_date: str = None,
    limit: int = 50,
    offset: int = 0,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    ws = _get_workspace(db, user)
    q = _build_query(db, ws.id, action, resource_type, from_date, to_date)
    total = q.count()
    entries = q.order_by(AuditLog.occurred_at.desc()).offset(offset).limit(limit).all()
    return {
        "entries": [_entry_out(e) for e in entries],
        "total": total,
        "limit": limit,
        "offset": offset,
    }

