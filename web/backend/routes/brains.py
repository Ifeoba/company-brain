import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, BrainFile, InterviewState, User
from ..readiness import STANDARD_FILES, compute_readiness
from ..schemas import (
    BrainCreate, BrainDetail, BrainSummary, FileSummary,
    FileContent, FileUpdate, ReadinessOut,
)

router = APIRouter()

PLACEHOLDER = "REPLACE WITH"


def _slug_valid(slug: str) -> bool:
    return bool(re.match(r"^[a-z0-9][a-z0-9-]{0,126}[a-z0-9]$", slug))


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _brain_file_map(db: Session, brain: Brain) -> dict[str, str]:
    files = db.query(BrainFile).filter_by(brain_id=brain.id).all()
    return {f.filename: f.content for f in files if f.content}


def _readiness_score(db: Session, brain: Brain) -> int:
    return compute_readiness(_brain_file_map(db, brain)).score


def _status(score: int, updated_at: datetime) -> str:
    if score >= 90:
        return "ready"
    if score == 0:
        return "in-formation"
    return "in-formation"


def _brain_summary(db: Session, brain: Brain) -> BrainSummary:
    score = _readiness_score(db, brain)
    return BrainSummary(
        id=brain.id,
        slug=brain.slug,
        name=brain.name,
        readiness_score=score,
        updated_at=brain.updated_at,
        status=_status(score, brain.updated_at),
    )


@router.get("/api/brains", response_model=list[BrainSummary])
def list_brains(user: User = Depends(current_user), db: Session = Depends(get_db)):
    brains = db.query(Brain).filter_by(owner_id=user.id).order_by(Brain.updated_at.desc()).all()
    return [_brain_summary(db, b) for b in brains]


@router.post("/api/brains", response_model=BrainDetail)
def create_brain(body: BrainCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    slug = body.slug or re.sub(r"[^a-z0-9]+", "-", body.name.lower()).strip("-")
    if not _slug_valid(slug):
        raise HTTPException(status_code=400, detail=f"Invalid slug: {slug}")

    existing = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Brain '{slug}' already exists")

    brain = Brain(slug=slug, name=body.name, owner_id=user.id, updated_at=datetime.utcnow())
    db.add(brain)
    db.flush()

    state = InterviewState(brain_id=brain.id, current_step=1, current_question_index=0, answers_json="{}", updated_at=datetime.utcnow())
    db.add(state)
    db.commit()
    db.refresh(brain)

    return BrainDetail(
        id=brain.id, slug=brain.slug, name=brain.name,
        readiness_score=0, updated_at=brain.updated_at,
        status="in-formation", created_at=brain.created_at,
        owner_id=brain.owner_id,
    )


@router.get("/api/brains/{slug}", response_model=BrainDetail)
def get_brain(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    score = _readiness_score(db, brain)
    return BrainDetail(
        id=brain.id, slug=brain.slug, name=brain.name,
        readiness_score=score, updated_at=brain.updated_at,
        status=_status(score, brain.updated_at),
        created_at=brain.created_at, owner_id=brain.owner_id,
    )


@router.delete("/api/brains/{slug}")
def delete_brain(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    db.delete(brain)
    db.commit()
    return {"ok": True}


@router.get("/api/brains/{slug}/readiness", response_model=ReadinessOut)
def get_readiness(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    return compute_readiness(_brain_file_map(db, brain))


@router.get("/api/brains/{slug}/files", response_model=list[FileSummary])
def list_files(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    files = {f.filename: f for f in db.query(BrainFile).filter_by(brain_id=brain.id).all()}
    result = []
    for filename in STANDARD_FILES:
        bf = files.get(filename)
        result.append(FileSummary(
            filename=filename,
            has_content=bool(bf and bf.content and bf.content.strip()),
            placeholder_count=bf.content.count(PLACEHOLDER) if bf and bf.content else 0,
            updated_at=bf.updated_at if bf else None,
        ))
    return result


@router.get("/api/brains/{slug}/files/{filename}", response_model=FileContent)
def get_file(slug: str, filename: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    bf = db.query(BrainFile).filter_by(brain_id=brain.id, filename=filename).first()
    if not bf:
        raise HTTPException(status_code=404, detail="File not found")
    return FileContent(filename=filename, content=bf.content or "", updated_at=bf.updated_at)


@router.put("/api/brains/{slug}/files/{filename}", response_model=FileContent)
def update_file(slug: str, filename: str, body: FileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    bf = db.query(BrainFile).filter_by(brain_id=brain.id, filename=filename).first()
    now = datetime.utcnow()
    if bf:
        bf.content = body.content
        bf.updated_at = now
    else:
        bf = BrainFile(brain_id=brain.id, filename=filename, content=body.content, updated_at=now)
        db.add(bf)
    brain.updated_at = now
    db.commit()
    db.refresh(bf)
    return FileContent(filename=filename, content=bf.content, updated_at=bf.updated_at)
