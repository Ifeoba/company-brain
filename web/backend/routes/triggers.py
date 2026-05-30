"""
Trigger management and ingest endpoints.

Week 2: webhook + manual triggers.
Week 3: email triggers (inbound webhook), schedule triggers (cron + Celery beat).
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
from ..config import settings
from ..db import get_db
from ..models import Brain, Run, Trigger, User
from ..schemas import TriggerCreate

router = APIRouter()

_VALID_KINDS = {"webhook", "email", "schedule", "database", "manual"}


def _validate_cron(expr: str) -> None:
    try:
        from croniter import croniter
        if not croniter.is_valid(expr):
            raise ValueError
    except ImportError:
        pass  # croniter not installed in lightweight dev env; skip validation
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid cron expression: '{}'".format(expr))


def _inbound_email_address(brain_slug: str, trigger_id: str) -> str:
    return "{}-{}@{}".format(brain_slug, trigger_id[:8], settings.inbound_email_domain)


def _get_brain_authed(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _trigger_out(t: Trigger, include_secret: bool = False, brain_slug: Optional[str] = None) -> dict:
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
    return [_trigger_out(t, brain_slug=brain.slug) for t in rows]


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
        _validate_cron(body.cron_expression)
        trigger.cron_expression = body.cron_expression

    elif body.kind == "email":
        # Assign after we get the id — do a partial commit first
        db.add(trigger)
        db.flush()
        trigger.inbound_email = _inbound_email_address(brain.slug, trigger.id)

    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    return _trigger_out(trigger, include_secret=True, brain_slug=brain.slug)


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
    if "cron_expression" in body and trigger.kind == "schedule":
        _validate_cron(str(body["cron_expression"]))
        trigger.cron_expression = str(body["cron_expression"])

    db.commit()
    return _trigger_out(trigger, brain_slug=brain.slug)


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


# ── Webhook ingest ─────────────────────────────────────────────────────────────

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
    Idempotency: sha256 of the payload body is used as a dedup key.
    """
    trigger = (
        db.query(Trigger)
        .filter_by(id=trigger_id, kind="webhook", is_active=True)
        .first()
    )
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found or inactive")

    payload = await request.body()

    sig = x_signature or x_cb_signature
    if trigger.secret:
        if not sig:
            raise HTTPException(status_code=401, detail="Missing X-Signature header (expected: sha256=<hex>)")
        expected = "sha256=" + hmac.digest(trigger.secret.encode(), payload, "sha256").hex()
        if not hmac.compare_digest(expected, sig):
            raise HTTPException(status_code=401, detail="Invalid signature")

    dedup_key = hashlib.sha256(payload).hexdigest()
    existing = db.query(Run).filter_by(trigger_id=trigger.id, dedup_key=dedup_key).first()
    if existing:
        return {"run_id": existing.id, "status": existing.status, "duplicate": True}

    try:
        parsed = json.loads(payload.decode("utf-8"))
        case_text = json.dumps(parsed, indent=2)
    except Exception:
        case_text = payload.decode("utf-8", errors="replace")

    return _fire_trigger(db, background, trigger, case_text, dedup_key=dedup_key)


# ── Email ingest ───────────────────────────────────────────────────────────────

@router.post("/api/inbound-email/{trigger_id}")
async def ingest_inbound_email(
    trigger_id: str,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Inbound email webhook — called by Resend or Postmark when an email arrives
    at the trigger's inbound_email address.

    Supports both Resend and Postmark payload formats (auto-detected).
    No signature check here — secure via unique trigger_id in URL.
    """
    trigger = (
        db.query(Trigger)
        .filter_by(id=trigger_id, kind="email", is_active=True)
        .first()
    )
    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger not found or inactive")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Resend: { from, to, subject, text, html }
    # Postmark: { From, To, Subject, TextBody, HtmlBody }
    sender = body.get("from") or body.get("From", "unknown sender")
    subject = body.get("subject") or body.get("Subject", "(no subject)")
    text = body.get("text") or body.get("TextBody") or body.get("html") or body.get("HtmlBody", "")

    case_text = "From: {}\nSubject: {}\n\n{}".format(sender, subject, text.strip())
    dedup_key = hashlib.sha256(case_text.encode()).hexdigest()

    existing = db.query(Run).filter_by(trigger_id=trigger.id, dedup_key=dedup_key).first()
    if existing:
        return {"run_id": existing.id, "status": existing.status, "duplicate": True}

    return _fire_trigger(db, background, trigger, case_text, dedup_key=dedup_key)


# ── Shared fire helper ─────────────────────────────────────────────────────────

def _fire_trigger(
    db: Session,
    background: BackgroundTasks,
    trigger: Trigger,
    case_text: str,
    dedup_key: Optional[str] = None,
) -> dict:
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
