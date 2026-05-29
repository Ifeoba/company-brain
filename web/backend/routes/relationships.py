from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, BrainFile, BrainRelationship, User
from ..readiness import compute_readiness
from ..schemas import BrainRelationshipCreate, BrainRelationshipOut, WorkspaceNodeOut

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
