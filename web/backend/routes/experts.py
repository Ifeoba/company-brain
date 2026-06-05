import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..email_sender import send_expert_question_email
from ..models import Brain, Collaborator, ExpertAnswer, ExpertQuestion, User
from ..schemas import (
    AskExpertRequest, CollaboratorCreate, CollaboratorOut,
    ExpertAnswerRequest, ExpertQuestionOut, PublicQuestionOut,
)

router = APIRouter()

AVATAR_COLORS = [
    "#7cf29c", "#f2c47c", "#7cb8f2", "#f27c9a",
    "#c47cf2", "#f2e57c", "#7cf2e5", "#f29c7c",
]


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _initials(name: str) -> str:
    parts = name.strip().split()
    if len(parts) >= 2:
        return (parts[0][0] + parts[-1][0]).upper()
    return name[:2].upper() if name else "??"


def _color_seed(email: str) -> int:
    return hash(email) % len(AVATAR_COLORS)


def _question_out(q: ExpertQuestion) -> ExpertQuestionOut:
    return ExpertQuestionOut(
        id=q.id,
        token=q.token,
        collaborator_id=q.collaborator_id,
        collaborator_name=q.collaborator.name if q.collaborator else "",
        step_number=q.step_number,
        question_key=q.question_key,
        question_text=q.question_text,
        context_text=q.context_text or "",
        status=q.status,
        created_at=q.created_at,
        expires_at=q.expires_at,
        answer_text=q.answer.answer_text if q.answer else None,
    )


# ── Collaborators ─────────────────────────────────────────────────────────────

@router.get("/api/brains/{slug}/collaborators", response_model=list[CollaboratorOut])
def list_collaborators(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    return db.query(Collaborator).filter_by(brain_id=brain.id).order_by(Collaborator.created_at).all()


@router.post("/api/brains/{slug}/collaborators", response_model=CollaboratorOut)
def add_collaborator(slug: str, body: CollaboratorCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    c = Collaborator(
        brain_id=brain.id,
        name=body.name,
        email=body.email,
        initials=_initials(body.name),
        color_seed=_color_seed(body.email),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/api/brains/{slug}/collaborators/{collab_id}")
def delete_collaborator(slug: str, collab_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    c = db.query(Collaborator).filter_by(id=collab_id, brain_id=brain.id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    db.delete(c)
    db.commit()
    return {"ok": True}


# ── Ask expert ────────────────────────────────────────────────────────────────

@router.post("/api/brains/{slug}/ask-expert", response_model=ExpertQuestionOut)
def ask_expert(
    slug: str,
    body: AskExpertRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    brain = _get_brain(db, slug, user)
    collab = db.query(Collaborator).filter_by(id=body.collaborator_id, brain_id=brain.id).first()
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    token = secrets.token_urlsafe(16)
    now = datetime.utcnow()
    q = ExpertQuestion(
        token=token,
        brain_id=brain.id,
        asker_user_id=user.id,
        collaborator_id=collab.id,
        step_number=body.step,
        question_key=body.question_key,
        question_text=body.question_text,
        context_text=body.context_text,
        status="pending",
        created_at=now,
        expires_at=now + timedelta(days=30),
    )
    db.add(q)
    db.commit()
    db.refresh(q)

    base_url = str(request.base_url).rstrip("/")
    expert_link = f"{base_url.replace('8000', '5173')}/q/{token}"

    background_tasks.add_task(
        send_expert_question_email,
        to_email=collab.email,
        to_name=collab.name,
        asker_name=user.github_username,
        brain_name=brain.name,
        question_text=body.question_text,
        context_text=body.context_text,
        expert_link=expert_link,
    )

    db.refresh(q)
    return _question_out(q)


@router.get("/api/brains/{slug}/expert-questions", response_model=list[ExpertQuestionOut])
def list_expert_questions(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    questions = (
        db.query(ExpertQuestion)
        .filter_by(brain_id=brain.id)
        .order_by(ExpertQuestion.created_at.desc())
        .all()
    )
    return [_question_out(q) for q in questions]


# ── Public expert endpoints (no auth) ─────────────────────────────────────────

@router.get("/api/expert/{token}", response_model=PublicQuestionOut)
def get_expert_question(token: str, db: Session = Depends(get_db)):
    q = db.query(ExpertQuestion).filter_by(token=token).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found or link expired")

    now = datetime.utcnow()
    if q.expires_at < now and q.status == "pending":
        q.status = "expired"
        db.commit()

    brain = db.query(Brain).filter_by(id=q.brain_id).first()
    asker = db.query(User).filter_by(id=q.asker_user_id).first()

    return PublicQuestionOut(
        brain_name=brain.name if brain else "",
        asker_name=asker.github_username if asker else "",
        recipient_name=q.collaborator.name if q.collaborator else "",
        question_text=q.question_text,
        context_text=q.context_text or "",
        already_answered=q.status == "answered",
        existing_answer=q.answer.answer_text if q.answer else None,
    )


@router.post("/api/expert/{token}/answer")
def submit_expert_answer(token: str, body: ExpertAnswerRequest, db: Session = Depends(get_db)):
    q = db.query(ExpertQuestion).filter_by(token=token).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    if q.status == "expired":
        raise HTTPException(status_code=410, detail="This link has expired")

    if q.answer:
        q.answer.answer_text = body.answer_text
        q.answer.submitted_at = datetime.utcnow()
    else:
        answer = ExpertAnswer(
            expert_question_id=q.id,
            answer_text=body.answer_text,
            submitted_at=datetime.utcnow(),
        )
        db.add(answer)

    q.status = "answered"
    db.commit()
    return {"ok": True}
