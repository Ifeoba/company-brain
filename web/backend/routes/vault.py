"""
Vault API — workspace-scoped encrypted secret management.

Secret values are write-only from the API perspective: they go in,
get encrypted, and never come back out through these endpoints.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import User, VaultSecret, Workspace
from ..schemas import VaultSecretSet
from .. import vault as vault_module

router = APIRouter()


def _get_workspace(db: Session, user: User) -> Workspace:
    ws = db.query(Workspace).filter_by(owner_id=user.id).first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


@router.get("/api/workspace/vault")
def list_secrets(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Return secret names and timestamps — never the values."""
    ws = _get_workspace(db, user)
    secrets = (
        db.query(VaultSecret)
        .filter_by(workspace_id=ws.id)
        .order_by(VaultSecret.name)
        .all()
    )
    return [
        {"name": s.name, "updated_at": s.updated_at.isoformat() if s.updated_at else None}
        for s in secrets
    ]


@router.post("/api/workspace/vault", status_code=201)
def set_secret(
    body: VaultSecretSet,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Store or overwrite a secret. Names are upper-cased automatically."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Secret name cannot be empty")
    if not body.value:
        raise HTTPException(status_code=400, detail="Secret value cannot be empty")
    ws = _get_workspace(db, user)
    name = body.name.strip().upper()
    vault_module.store_secret(db, ws.id, name, body.value, user.id)
    db.commit()
    return {"name": name, "status": "stored"}


@router.delete("/api/workspace/vault/{name}", status_code=204)
def delete_secret(
    name: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    ws = _get_workspace(db, user)
    deleted = vault_module.delete_secret(db, ws.id, name.upper(), user.id)
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Secret not found")
