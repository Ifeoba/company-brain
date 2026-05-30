"""
Trigger management and webhook ingest.

Week 2: webhook + manual triggers.
Weeks 3+: email, schedule, database triggers.
"""
import hashlib
import hmac
import json
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, Run, Trigger, User
from ..schemas import TriggerCreate

router = APIRouter()

_VALID_KINDS = {"webhook", "email", "schedule", "database", "manual"}


def _get_brain_authed(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _trigger_out(t: Trigger, include_secret: bool = False) -> dict:
    return {
        "id": t.id,
        "kind": t.kind,
        "name": t.name,
        "is_active": t.is_active,
        "last_fired_at": t.last_fired_at.isoformat() if t.last_fired_at else None,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "cron_expression": t.cron_expression,
        "inbound_email": t.inbound_email,
        "secret": t.secret if include_secret else None,
        "webhook_url": "/api/webhook/{}".format(t.id) if t.kind == "webhook" else None,
    }


@router.get("/api/brains/{slug}/triggers", response_model=list)
def list_triggers(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain_authed(db, slug, user)
    rows = (
        db.query(Trigger)
        .filter_by(brain_id=brain.id)
        .order_by(Trigger.created_at.desc())
        .all()
    )
    return [_trigger_out(t) for t in rows]


@router.post("/api/brains/{slug}/triggers")
def create_trigger(
    slug: str,
    body: TriggerCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if body.kind not in _VALID_KINDS:
        raise HTTPException(
            status_code=400,
            detail="Invalid kind. Must be one of: {}".format(", ".join(sorted(_VALID_KINDS))),
        )
    brain = _get_brain_authed(db, slug, user)

    trigger = Trigger(
        workspace_id=brain.workspace_id,
        brain_id=brain.id,
        kind=body.kind,
        name=body.name.strip(),
        config=json.dumps(body.config or {}),
        is_active=True,
        created_at=datetime.utcnow(),
    )

    if body.kind == "webhook":
        trigger.secret = secrets.token_hex(32)
    elif body.kind == "schedule":
        if not body.cron_expression:
            raise HTTPException(status_code=400, detail="cron_expression required for schedule triggers")
        trigger.cron_expression = body.cron_expression

    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    # Secret is returned exactly once, on creation. Subsequent reads omit it.
    return _trigger_out(trigger, include_secret=True)


@router.patch("/api/brains/{slug}/triggers/{trigger_id}")
def update_trigger(
    slug: str,
    trigger_id: str,
    body: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain_authed(db, slug, user)
    trigger = db.query(Trigger).filter_by(id=trigger_id, brain_id=brain.id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")

    if "name" in body:
        trigger.name = str(body["name"]).strip()
    if "is_active" in body:
        trigger.is_active = bool(body["is_active"])

    db.commit()
    return _trigger_out(trigger)


@router.delete("/api/brains/{slug}/triggers/{trigger_id}", status_code=204)
def delete_trigger(
    slug: str,
    trigger_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain_authed(db, slug, user)
    trigger = db.query(Trigger).filter_by(id=trigger_id, brain_id=brain.id).first()
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found")
    db.delete(trigger)
    db.commit()


@router.post("/api/webhook/{trigger_id}")
async def ingest_webhook(
    trigger_id: str,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
    x_signature: Optional[str] = Header(None, alias="X-Signature"),
    x_cb_signature: Optional[str] = Header(None, alias="X-CB-Signature"),
):
    """
    Public inbound endpoint — external systems POST here to trigger a brain run.

    Auth: HMAC-SHA256 via X-Signature: sha256=<hex> (same scheme as GitHub webhooks).
    Idempotency: sha256 of the payload body is used as a dedup key; re-posting the
    same payload returns the existing run rather than creating a duplicate.
    """
    trigger = (
        db.query(Trigger)
        .filter_by(id=trigger_id, kind="webhook", is_active=True)
        .first()
    )
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found or inactive")

    payload = await request.body()

    # Verify HMAC-SHA256 when a secret is configured
    sig = x_signature or x_cb_signature
    if trigger.secret:
        if not sig:
            raise HTTPException(status_code=401, detail="Missing X-Signature header (expected: sha256=<hex>)")
        expected_hex = hmac.digest(trigger.secret.encode(), payload, "sha256").hex()
        expected = "sha256=" + expected_hex
        if not hmac.compare_digest(expected, sig):
            raise HTTPException(status_code=401, detail="Invalid signature")

    # Idempotency: same payload → same run
    dedup_key = hashlib.sha256(payload).hexdigest()
    existing = db.query(Run).filter_by(trigger_id=trigger.id, dedup_key=dedup_key).first()
    if existing:
        return {"run_id": existing.id, "status": existing.status, "duplicate": True}

    # Build case text from JSON payload (pretty-printed) or raw bytes
    try:
        parsed = json.loads(payload.decode("utf-8"))
        case_text = json.dumps(parsed, indent=2)
    except Exception:
        case_text = payload.decode("utf-8", errors="replace")

    brain = db.query(Brain).filter_by(id=trigger.brain_id).first()
    if not brain:
        raise HTTPException(status_code=500, detail="Brain not found")

    owner = db.query(User).filter_by(id=brain.owner_id).first()
    if not owner or not owner.encrypted_anthropic_key:
        raise HTTPException(status_code=400, detail="Brain owner has no API key configured")

    run = Run(
        brain_id=trigger.brain_id,
        user_id=owner.id,
        workspace_id=trigger.workspace_id,
        trigger_id=trigger.id,
        case_text=case_text,
        dedup_key=dedup_key,
        status="queued",
        model_used="",
        created_at=datetime.utcnow(),
    )
    db.add(run)
    trigger.last_fired_at = datetime.utcnow()
    db.commit()
    db.refresh(run)

    try:
        from ..tasks import execute_run_task
        execute_run_task.delay(run.id)
    except Exception:
        from ..tasks import execute_run
        background.add_task(execute_run, run.id)

    return {"run_id": run.id, "status": "queued", "duplicate": False}
