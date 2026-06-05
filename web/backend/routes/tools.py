"""
Tool management: workspace tool library and brain-level tool attachment.
"""
from __future__ import annotations

import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, BrainTool, Tool, User, Workspace
from ..schemas import ToolCreate
from ..tool_executors import BUILTIN_CATALOG

router = APIRouter()


def _get_workspace(db: Session, user: User) -> Workspace:
    ws = db.query(Workspace).filter_by(owner_id=user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


def _tool_out(tool: Tool) -> dict:
    return {
        "id": tool.id,
        "name": tool.name,
        "description": tool.description,
        "category": tool.category,
        "risk": tool.risk,
        "config": json.loads(tool.config or "{}"),
        "is_active": tool.is_active,
        "created_at": tool.created_at.isoformat() if tool.created_at else None,
    }


# ── Catalog ───────────────────────────────────────────────────────────────────

@router.get("/api/tools/builtins")
def list_builtins():
    """Return the catalog of built-in tool templates."""
    return BUILTIN_CATALOG


# ── Workspace tool library ────────────────────────────────────────────────────

@router.get("/api/workspace/tools")
def list_workspace_tools(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    ws = _get_workspace(db, user)
    tools = db.query(Tool).filter_by(workspace_id=ws.id).order_by(Tool.created_at).all()
    return [_tool_out(t) for t in tools]


@router.post("/api/workspace/tools", status_code=201)
def create_tool(
    body: ToolCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    ws = _get_workspace(db, user)
    tool = Tool(
        workspace_id=ws.id,
        name=body.name,
        description=body.description,
        category=body.category,
        risk=body.risk,
        config=json.dumps(body.config),
        created_at=datetime.utcnow(),
    )
    db.add(tool)
    db.commit()
    db.refresh(tool)
    return _tool_out(tool)


@router.patch("/api/workspace/tools/{tool_id}")
def update_tool(
    tool_id: str,
    body: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    ws = _get_workspace(db, user)
    tool = db.query(Tool).filter_by(id=tool_id, workspace_id=ws.id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    if "description" in body:
        tool.description = str(body["description"])
    if "is_active" in body:
        tool.is_active = bool(body["is_active"])
    if "config" in body:
        tool.config = json.dumps(body["config"])
    db.commit()
    return _tool_out(tool)


@router.delete("/api/workspace/tools/{tool_id}", status_code=204)
def delete_tool(
    tool_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    ws = _get_workspace(db, user)
    tool = db.query(Tool).filter_by(id=tool_id, workspace_id=ws.id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found")
    db.query(BrainTool).filter_by(tool_id=tool.id).delete()
    db.delete(tool)
    db.commit()


# ── Brain ↔ tool attachment ───────────────────────────────────────────────────

@router.get("/api/brains/{slug}/tools")
def list_brain_tools(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    bts = db.query(BrainTool).filter_by(brain_id=brain.id).all()
    return [_tool_out(bt.tool) for bt in bts]


@router.post("/api/brains/{slug}/tools/{tool_id}", status_code=201)
def attach_tool(
    slug: str,
    tool_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    ws = _get_workspace(db, user)
    tool = db.query(Tool).filter_by(id=tool_id, workspace_id=ws.id).first()
    if not tool:
        raise HTTPException(status_code=404, detail="Tool not found in workspace")
    if not db.query(BrainTool).filter_by(brain_id=brain.id, tool_id=tool.id).first():
        db.add(BrainTool(brain_id=brain.id, tool_id=tool.id))
        db.commit()
    return _tool_out(tool)


@router.delete("/api/brains/{slug}/tools/{tool_id}", status_code=204)
def detach_tool(
    slug: str,
    tool_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    bt = db.query(BrainTool).filter_by(brain_id=brain.id, tool_id=tool_id).first()
    if bt:
        db.delete(bt)
        db.commit()
