"""
Vault module for workspace-scoped encrypted secrets.

Rules:
  - Plaintext never crosses the API boundary.
  - Decryption happens only inside Celery tasks (or BackgroundTasks in dev).
  - Every read is logged to AuditLog.

For v2: swap _store/_retrieve to HashiCorp Vault / AWS Secrets Manager
by replacing the two private functions below. The public API stays the same.
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from .crypto import decrypt_key, encrypt_key
from .models import VaultSecret, AuditLog


def store_secret(
    db: Session,
    workspace_id: str,
    name: str,
    plaintext: str,
    created_by_user_id: str,
) -> VaultSecret:
    """Encrypt and upsert a secret. Returns the record (encrypted, no plaintext)."""
    encrypted = encrypt_key(plaintext.encode())
    secret = db.query(VaultSecret).filter_by(workspace_id=workspace_id, name=name).first()
    if secret:
        secret.encrypted_value = encrypted
        secret.updated_at = datetime.utcnow()
    else:
        secret = VaultSecret(
            workspace_id=workspace_id,
            name=name,
            encrypted_value=encrypted,
            created_by_user_id=created_by_user_id,
        )
        db.add(secret)
    db.flush()

    _audit(db, workspace_id, created_by_user_id, "secret.write", "vault_secret", secret.id)
    return secret


def get_plaintext(
    db: Session,
    workspace_id: str,
    secret_name: str,
    accessing_task_id: Optional[str] = None,
) -> Optional[str]:
    """
    Decrypt and return a secret's plaintext value.
    Must only be called from Celery tasks or BackgroundTasks, not API handlers.
    """
    secret = db.query(VaultSecret).filter_by(workspace_id=workspace_id, name=secret_name).first()
    if not secret:
        return None

    plaintext = decrypt_key(secret.encrypted_value).decode()

    _audit(
        db, workspace_id, None, "secret.read", "vault_secret", secret.id,
        {"task_id": accessing_task_id, "secret_name": secret_name},
    )
    return plaintext


def delete_secret(db: Session, workspace_id: str, name: str, actor_id: str) -> bool:
    secret = db.query(VaultSecret).filter_by(workspace_id=workspace_id, name=name).first()
    if not secret:
        return False
    _audit(db, workspace_id, actor_id, "secret.delete", "vault_secret", secret.id)
    db.delete(secret)
    db.flush()
    return True


def _audit(
    db: Session,
    workspace_id: str,
    actor_id: Optional[str],
    action: str,
    resource_type: str,
    resource_id: str,
    details: Optional[dict] = None,
) -> None:
    db.add(AuditLog(
        workspace_id=workspace_id,
        actor_id=actor_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details_json=json.dumps(details or {}),
        occurred_at=datetime.utcnow(),
    ))
