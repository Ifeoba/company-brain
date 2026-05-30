from __future__ import annotations

import json
import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..llm_client import call_llm
from ..models import Brain, BrainFile, BrainRelationship, User
from ..readiness import compute_readiness
from ..schemas import (
    BrainRelationshipCreate, BrainRelationshipOut,
    RelationshipSuggestion, WorkspaceNodeOut,
)

router = APIRouter()

REL_TYPES = {"depends-on", "uses", "related-to", "feeds-into"}


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _rel_out(r: BrainRelationship) -> BrainRelationshipOut:
    return BrainRelationshipOut(
        id=r.id,
        from_slug=r.from_brain.slug,
        from_name=r.from_brain.name,
        to_slug=r.to_brain.slug,
        to_name=r.to_brain.name,
        rel_type=r.rel_type,
        created_at=r.created_at,
    )


def _readiness(db: Session, brain: Brain) -> int:
    files = db.query(BrainFile).filter_by(brain_id=brain.id).all()
    file_map = {f.filename: f.content for f in files if f.content}
    return compute_readiness(file_map).score


@router.get("/api/brains/{slug}/relationships", response_model=list[BrainRelationshipOut])
def list_relationships(
    slug: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    rels = db.query(BrainRelationship).filter_by(from_brain_id=brain.id).all()
    return [_rel_out(r) for r in rels]


@router.post("/api/brains/{slug}/relationships", response_model=BrainRelationshipOut)
def add_relationship(
    slug: str,
    body: BrainRelationshipCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    if body.rel_type not in REL_TYPES:
        raise HTTPException(status_code=400, detail=f"rel_type must be one of: {', '.join(sorted(REL_TYPES))}")

    to_brain = db.query(Brain).filter_by(slug=body.to_slug, owner_id=user.id).first()
    if not to_brain:
        raise HTTPException(status_code=404, detail="Target brain not found")
    if to_brain.id == brain.id:
        raise HTTPException(status_code=400, detail="Cannot link a brain to itself")

    existing = db.query(BrainRelationship).filter_by(
        from_brain_id=brain.id,
        to_brain_id=to_brain.id,
        rel_type=body.rel_type,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="This relationship already exists")

    rel = BrainRelationship(
        from_brain_id=brain.id,
        to_brain_id=to_brain.id,
        rel_type=body.rel_type,
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return _rel_out(rel)


@router.delete("/api/brains/{slug}/relationships/{rel_id}")
def remove_relationship(
    slug: str,
    rel_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    rel = db.query(BrainRelationship).filter_by(id=rel_id, from_brain_id=brain.id).first()
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
    db.delete(rel)
    db.commit()
    return {"ok": True}


@router.get("/api/workspace/map", response_model=list[WorkspaceNodeOut])
def workspace_map(user: User = Depends(current_user), db: Session = Depends(get_db)):
    brains = db.query(Brain).filter_by(owner_id=user.id).order_by(Brain.created_at).all()
    result = []
    for brain in brains:
        score = _readiness(db, brain)
        status = "ready" if score >= 90 else "in-formation"
        rels = db.query(BrainRelationship).filter_by(from_brain_id=brain.id).all()
        result.append(WorkspaceNodeOut(
            id=brain.id,
            slug=brain.slug,
            name=brain.name,
            readiness_score=score,
            status=status,
            relationships=[_rel_out(r) for r in rels],
        ))
    return result


@router.post("/api/workspace/discover-relationships", response_model=list[RelationshipSuggestion])
def discover_relationships(user: User = Depends(current_user), db: Session = Depends(get_db)):
    brains = db.query(Brain).filter_by(owner_id=user.id).order_by(Brain.created_at).all()
    if len(brains) < 2:
        return []

    brain_ids = [b.id for b in brains]
    brain_by_slug = {b.slug: b for b in brains}

    existing = db.query(BrainRelationship).filter(
        BrainRelationship.from_brain_id.in_(brain_ids)
    ).all()
    existing_triples = {(r.from_brain.slug, r.to_brain.slug, r.rel_type) for r in existing}

    # Build a compact content summary per brain (overview first, then other files)
    sections = []
    for brain in brains:
        files = db.query(BrainFile).filter_by(brain_id=brain.id).all()
        file_map = {f.filename: f.content for f in files if f.content}
        overview = file_map.get("overview.md", "")
        # Use overview if available, otherwise combine first 300 chars of each file
        if overview:
            snippet = overview[:600]
        else:
            snippet = " | ".join(
                f"{fn}: {c[:120]}" for fn, c in list(file_map.items())[:3]
            )
        if not snippet:
            snippet = "(no content yet)"
        sections.append(f"Brain slug: {brain.slug}\nBrain name: {brain.name}\n{snippet}")

    brains_text = "\n\n---\n\n".join(sections)

    raw = call_llm(
        user,
        (
            "You analyse knowledge-base documents to find relationships between systems and services. "
            "Return ONLY a valid JSON array — no prose, no fences. "
            'Each item must have: {"from_slug":"…","to_slug":"…","rel_type":"…","reason":"…"}. '
            "rel_type must be exactly one of: depends-on, uses, related-to, feeds-into. "
            "Only suggest relationships clearly supported by the content. "
            "Return [] if nothing is clear."
        ),
        [{
            "role": "user",
            "content": (
                f"Find relationships between these brains:\n\n{brains_text}\n\n"
                "Return a JSON array of suggested relationships."
            ),
        }],
        max_tokens=1024,
    )
    raw = raw.strip()
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return []
    try:
        raw_suggestions = json.loads(match.group())
    except Exception:
        return []

    result = []
    seen = set()
    for s in raw_suggestions:
        fs = s.get("from_slug", "")
        ts = s.get("to_slug", "")
        rt = s.get("rel_type", "")
        reason = s.get("reason", "")
        if not (fs and ts and rt):
            continue
        if fs not in brain_by_slug or ts not in brain_by_slug:
            continue
        if fs == ts:
            continue
        if rt not in REL_TYPES:
            continue
        if (fs, ts, rt) in existing_triples:
            continue
        key = (fs, ts, rt)
        if key in seen:
            continue
        seen.add(key)
        result.append(RelationshipSuggestion(
            from_slug=fs,
            from_name=brain_by_slug[fs].name,
            to_slug=ts,
            to_name=brain_by_slug[ts].name,
            rel_type=rt,
            reason=reason,
        ))
    return result
