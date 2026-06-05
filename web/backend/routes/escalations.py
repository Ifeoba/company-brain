"""
Workspace escalation queue — surfaces escalate-risk tool calls for team review.
"""
from __future__ import annotations
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import AuditLog, Brain, Escalation, Run, Tool, ToolCall, User, Workspace

router = APIRouter()


def _get_workspace(db: Session, user: User) -> Workspace:
    ws = db.query(Workspace).filter_by(owner_id=user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


def _esc_out(esc: Escalation) -> dict:
    """Serialize one escalation with linked run/brain/tool call info."""
    run = esc.run
    brain = run.brain if run else None
    tc = esc.tool_call
    tool = tc.tool if tc else None

    args = {}
    if tc:
        try:
            args = json.loads(tc.arguments or "{}")
        except Exception:
            pass

    return {
        "id": esc.id,
        "status": esc.status,
        "reason": esc.reason,
        "guardrail_cited": esc.guardrail_cited,
        "resolution": esc.resolution,
        "created_at": esc.created_at.isoformat() if esc.created_at else None,
        "resolved_at": esc.resolved_at.isoformat() if esc.resolved_at else None,
        "run_id": esc.run_id,
        "run_case_snippet": (run.case_text or "")[:120] if run else "",
        "brain_slug": brain.slug if brain else "",
        "brain_name": brain.name if brain else "",
        "tool_call": {
            "id": tc.id,
            "tool_name": tool.name if tool else "unknown",
            "arguments": args,
            "status": tc.status,
        } if tc else None,
    }


@router.get("/api/workspace/escalations")
def list_escalations(
    status: Optional[str] = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Return all escalations for this workspace. Pass ?status=pending to filter."""
    ws = _get_workspace(db, user)
    q = db.query(Escalation).filter_by(workspace_id=ws.id)
    if status:
        q = q.filter_by(status=status)
    escs = q.order_by(Escalation.created_at.desc()).limit(100).all()
    return [_esc_out(e) for e in escs]


@router.post("/api/workspace/escalations/{esc_id}/resolve")
def resolve_escalation(
    esc_id: str,
    body: dict,
    background: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """
    Resolve an escalation. body must include:
      verdict: "approved" | "denied"
      resolution: optional notes string
    Also updates the linked ToolCall and triggers run resume if all calls decided.
    """
    ws = _get_workspace(db, user)
    esc = db.query(Escalation).filter_by(id=esc_id, workspace_id=ws.id).first()
    if not esc:
        raise HTTPException(status_code=404, detail="Escalation not found")
    if esc.status == "resolved":
        raise HTTPException(status_code=409, detail="Already resolved")

    verdict = body.get("verdict")
    if verdict not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="verdict must be 'approved' or 'denied'")

    resolution = body.get("resolution", "")

    # Mark escalation resolved
    esc.status = "resolved"
    esc.resolution = resolution
    esc.resolved_at = datetime.utcnow()
    esc.assigned_to_user_id = user.id

    # Update the linked tool call
    tc = esc.tool_call
    if tc and tc.status == "pending_approval":
        tc.status = verdict  # "approved" or "denied"
        tc.approver_user_id = user.id
        tc.decided_at = datetime.utcnow()

    # Write audit entry
    db.add(AuditLog(
        workspace_id=ws.id,
        actor_id=user.id,
        action="escalation.{}".format(verdict),
        resource_type="escalation",
        resource_id=esc.id,
        details_json=json.dumps({"resolution": resolution, "run_id": esc.run_id}),
        occurred_at=datetime.utcnow(),
    ))
    db.commit()

    # Resume the run if all tool calls are now decided
    if tc:
        run = db.query(Run).filter_by(id=tc.run_id).first()
        if run:
            pending = db.query(ToolCall).filter_by(run_id=run.id, status="pending_approval").count()
            if pending == 0:
                try:
                    from ..tasks import resume_run_task
                    resume_run_task.delay(run.id)
                except Exception:
                    from ..tasks import resume_run
                    background.add_task(resume_run, run.id)

    return {"ok": True, "verdict": verdict}
