from __future__ import annotations

import json
import re
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..llm_client import call_llm
from ..models import Brain, BrainFile, BrainUpdate, BrainUpdateLink, User
from ..schemas import (
    BrainUpdateLinkOut, BrainUpdateOut, PublicBrainUpdateOut, SubmitUpdateRequest,
)

router = APIRouter()


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


# ── Auth-required endpoints ────────────────────────────────────────────────────

@router.post("/api/brains/{slug}/update-link", response_model=BrainUpdateLinkOut)
def get_or_create_update_link(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    link = db.query(BrainUpdateLink).filter_by(brain_id=brain.id).first()
    if not link:
        link = BrainUpdateLink(brain_id=brain.id, token=secrets.token_urlsafe(16))
        db.add(link)
        db.commit()
        db.refresh(link)
    return BrainUpdateLinkOut(token=link.token)


@router.get("/api/brains/{slug}/updates", response_model=list[BrainUpdateOut])
def list_updates(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    link = db.query(BrainUpdateLink).filter_by(brain_id=brain.id).first()
    if not link:
        return []
    return (
        db.query(BrainUpdate)
        .filter_by(link_id=link.id)
        .order_by(BrainUpdate.created_at.desc())
        .all()
    )


@router.post("/api/brains/{slug}/updates/{update_id}/integrate")
def integrate_update(
    slug: str,
    update_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    link = db.query(BrainUpdateLink).filter_by(brain_id=brain.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="No update link for this brain")
    update = db.query(BrainUpdate).filter_by(id=update_id, link_id=link.id).first()
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")

    files = db.query(BrainFile).filter_by(brain_id=brain.id).all()
    if not files:
        raise HTTPException(status_code=400, detail="No brain files to integrate into yet")

    files_index = "\n".join(
        f"- {f.filename}: {f.content[:300]}{'…' if len(f.content) > 300 else ''}"
        for f in files
    )
    raw = call_llm(
        user,
        "You select which brain knowledge-base files should be updated with new information. Respond with ONLY a JSON array of filename strings, e.g. [\"overview.md\"].",
        [{
            "role": "user",
            "content": (
                f"New knowledge update:\n"
                f"Topic: {update.topic or 'General'}\n"
                f"Content: {update.content}\n\n"
                f"Available files:\n{files_index}\n\n"
                f"Which filenames should be updated?"
            ),
        }],
        max_tokens=256,
    )
    match = re.search(r"\[.*?\]", raw, re.DOTALL)
    try:
        target_names = json.loads(match.group()) if match else []
    except Exception:
        target_names = []
    if not target_names:
        target_names = [files[0].filename]

    updated = []
    now = datetime.utcnow()
    for bf in files:
        if bf.filename not in target_names:
            continue
        bf.content = call_llm(
            user,
            (
                "You update a knowledge-base file to naturally incorporate new domain expert knowledge. "
                "Return ONLY the updated file content — no commentary, no fences."
            ),
            [{
                "role": "user",
                "content": (
                    f"Current content of {bf.filename}:\n\n{bf.content}\n\n"
                    f"---\n\nNew knowledge to incorporate:\n"
                    f"Topic: {update.topic or 'General'}\n"
                    f"From: {update.contributor_name}\n\n"
                    f"{update.content}\n\n"
                    f"Return the updated file content."
                ),
            }],
            max_tokens=4096,
        )
        bf.updated_at = now
        updated.append(bf.filename)

    update.status = "integrated"
    brain.updated_at = now
    db.commit()

    return {"ok": True, "updated_files": updated}


@router.post("/api/brains/{slug}/updates/{update_id}/dismiss")
def dismiss_update(
    slug: str,
    update_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    link = db.query(BrainUpdateLink).filter_by(brain_id=brain.id).first()
    if not link:
        raise HTTPException(status_code=404, detail="No update link for this brain")
    update = db.query(BrainUpdate).filter_by(id=update_id, link_id=link.id).first()
    if not update:
        raise HTTPException(status_code=404, detail="Update not found")
    update.status = "dismissed"
    db.commit()
    return {"ok": True}


# ── Public endpoints (no auth) ─────────────────────────────────────────────────

@router.get("/api/update/{token}", response_model=PublicBrainUpdateOut)
def get_update_page(token: str, db: Session = Depends(get_db)):
    link = db.query(BrainUpdateLink).filter_by(token=token).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    brain = db.query(Brain).filter_by(id=link.brain_id).first()
    owner = db.query(User).filter_by(id=brain.owner_id).first() if brain else None
    return PublicBrainUpdateOut(
        brain_name=brain.name if brain else "",
        asker_name=owner.github_username if owner else "",
    )


@router.post("/api/update/{token}")
def submit_update(token: str, body: SubmitUpdateRequest, db: Session = Depends(get_db)):
    link = db.query(BrainUpdateLink).filter_by(token=token).first()
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    update = BrainUpdate(
        link_id=link.id,
        contributor_name=body.contributor_name,
        contributor_email=body.contributor_email,
        topic=body.topic,
        content=body.content,
        status="pending",
        created_at=datetime.utcnow(),
    )
    db.add(update)
    db.commit()
    return {"ok": True}
