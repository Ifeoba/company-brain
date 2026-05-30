import json
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..llm_client import call_llm
from ..models import Brain, BrainFile, InterviewState, User
from ..schemas import (
    AnswerRequest, GenerateRequest, GenerateResponse,
    InterviewProgress, InterviewStateOut, QuestionOut, StepOut,
)

router = APIRouter()

# parents[3] is /app in Docker (WORKDIR /app/web) and the repo root in dev —
# both locations have spec/templates and the installed builder package.
TEMPLATES_DIR = Path(__file__).resolve().parents[3] / "spec" / "templates"

try:
    from builder.interview.runner import _SYSTEM_PROMPT, _SYSTEM_PROMPT_JSON
    from builder.interview.steps import STEPS
except ImportError as e:
    raise RuntimeError(f"Could not import builder package: {e}. Run pip install -e . from the repo root.")


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _get_or_create_state(db: Session, brain: Brain) -> InterviewState:
    state = db.query(InterviewState).filter_by(brain_id=brain.id).first()
    if not state:
        state = InterviewState(brain_id=brain.id, current_step=1, current_question_index=0, answers_json="{}", updated_at=datetime.utcnow())
        db.add(state)
        db.commit()
        db.refresh(state)
    return state


def _steps_out() -> list[StepOut]:
    return [
        StepOut(
            number=s.number,
            name=s.name,
            files=s.files,
            json_files=s.json_files,
            questions=[QuestionOut(key=q.key, text=q.text) for q in s.questions],
        )
        for s in STEPS
    ]


@router.get("/api/brains/{slug}/interview", response_model=InterviewStateOut)
def get_interview(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    state = _get_or_create_state(db, brain)
    answers = json.loads(state.answers_json or "{}")
    return InterviewStateOut(
        current_step=state.current_step,
        current_question_index=state.current_question_index,
        answers=answers,
        steps=_steps_out(),
    )


@router.put("/api/brains/{slug}/interview", response_model=InterviewStateOut)
def update_progress(slug: str, body: InterviewProgress, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    state = _get_or_create_state(db, brain)
    state.current_step = body.current_step
    state.current_question_index = body.current_question_index
    state.updated_at = datetime.utcnow()
    db.commit()
    answers = json.loads(state.answers_json or "{}")
    return InterviewStateOut(
        current_step=state.current_step,
        current_question_index=state.current_question_index,
        answers=answers,
        steps=_steps_out(),
    )


@router.post("/api/brains/{slug}/interview/answer", response_model=InterviewStateOut)
def save_answer(slug: str, body: AnswerRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    state = _get_or_create_state(db, brain)
    answers = json.loads(state.answers_json or "{}")
    step_key = str(body.step)
    if step_key not in answers:
        answers[step_key] = {}
    answers[step_key][body.question_key] = body.answer_text
    state.answers_json = json.dumps(answers)
    state.updated_at = datetime.utcnow()
    db.commit()
    return InterviewStateOut(
        current_step=state.current_step,
        current_question_index=state.current_question_index,
        answers=answers,
        steps=_steps_out(),
    )


@router.post("/api/brains/{slug}/interview/generate", response_model=GenerateResponse)
def generate(slug: str, body: GenerateRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    state = _get_or_create_state(db, brain)
    answers = json.loads(state.answers_json or "{}")
    step_answers = answers.get(str(body.step), {})

    template_path = TEMPLATES_DIR / body.filename
    if not template_path.exists():
        raise HTTPException(status_code=404, detail=f"Template {body.filename} not found")
    template = template_path.read_text(encoding="utf-8")

    answers_text = "\n\n".join(
        f"**{k.replace('_', ' ').title()}**\n{v}"
        for k, v in step_answers.items()
        if v
    )
    if not answers_text:
        raise HTTPException(status_code=400, detail="No answers saved for this step yet. Answer the questions first.")

    json_mode = body.filename.endswith(".json")
    system = _SYSTEM_PROMPT_JSON if json_mode else _SYSTEM_PROMPT
    content = call_llm(
        user,
        system,
        [{"role": "user", "content": f"Template for {body.filename}:\n\n{template}\n\n---\nUser's answers:\n\n{answers_text}"}],
        max_tokens=4096,
    )

    now = datetime.utcnow()
    bf = db.query(BrainFile).filter_by(brain_id=brain.id, filename=body.filename).first()
    if bf:
        bf.content = content
        bf.updated_at = now
    else:
        bf = BrainFile(brain_id=brain.id, filename=body.filename, content=content, updated_at=now)
        db.add(bf)
    brain.updated_at = now
    db.commit()

    return GenerateResponse(content=content)
