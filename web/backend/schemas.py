from __future__ import annotations
from datetime import datetime
from typing import Any, Optional
from pydantic import BaseModel, field_validator
import re


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: str
    github_username: str
    email: str
    avatar_url: str
    has_api_key: bool
    llm_provider: str
    created_at: datetime

    class Config:
        from_attributes = True


class SetApiKeyRequest(BaseModel):
    provider: str
    api_key: str


class ProviderInfo(BaseModel):
    id: str
    name: str
    key_hint: str
    key_url: str


# ── Brains ────────────────────────────────────────────────────────────────────

class BrainCreate(BaseModel):
    name: str
    slug: Optional[str] = None

    @field_validator("slug", mode="before")
    @classmethod
    def auto_slug(cls, v, info):
        if v:
            return v.lower().strip()
        name = info.data.get("name", "")
        slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        return slug or "my-brain"


class BrainSummary(BaseModel):
    id: str
    slug: str
    name: str
    readiness_score: int
    updated_at: datetime
    status: str  # in-formation | ready | stale

    class Config:
        from_attributes = True


class BrainDetail(BrainSummary):
    created_at: datetime
    owner_id: str


# ── Files ─────────────────────────────────────────────────────────────────────

class FileSummary(BaseModel):
    filename: str
    has_content: bool
    placeholder_count: int
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class FileContent(BaseModel):
    filename: str
    content: str
    updated_at: Optional[datetime]


class FileUpdate(BaseModel):
    content: str


# ── Readiness ─────────────────────────────────────────────────────────────────

class FileDimension(BaseModel):
    filename: str
    exists: bool
    placeholder_count: int
    note: str


class ReadinessOut(BaseModel):
    score: int
    files: list[FileDimension]


# ── Interview ─────────────────────────────────────────────────────────────────

class QuestionOut(BaseModel):
    key: str
    text: str


class StepOut(BaseModel):
    number: int
    name: str
    files: list[str]
    json_files: list[str]
    questions: list[QuestionOut]


class InterviewStateOut(BaseModel):
    current_step: int
    current_question_index: int
    answers: dict[str, dict[str, str]]
    steps: list[StepOut]


class InterviewProgress(BaseModel):
    current_step: int
    current_question_index: int


class AnswerRequest(BaseModel):
    step: int
    question_key: str
    answer_text: str


class GenerateRequest(BaseModel):
    step: int
    filename: str


class GenerateResponse(BaseModel):
    content: str


# ── Collaborators ─────────────────────────────────────────────────────────────

class CollaboratorCreate(BaseModel):
    name: str
    email: str


class CollaboratorOut(BaseModel):
    id: str
    name: str
    email: str
    initials: str
    color_seed: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Expert questions ──────────────────────────────────────────────────────────

class AskExpertRequest(BaseModel):
    collaborator_id: str
    step: int
    question_key: str
    question_text: str
    context_text: str = ""


class ExpertQuestionOut(BaseModel):
    id: str
    token: str
    collaborator_id: str
    collaborator_name: str
    step_number: int
    question_key: str
    question_text: str
    context_text: str
    status: str
    created_at: datetime
    expires_at: datetime
    answer_text: Optional[str]

    class Config:
        from_attributes = True


class PublicQuestionOut(BaseModel):
    brain_name: str
    asker_name: str
    recipient_name: str
    question_text: str
    context_text: str
    already_answered: bool
    existing_answer: Optional[str]


class ExpertAnswerRequest(BaseModel):
    answer_text: str


# ── CSRF ──────────────────────────────────────────────────────────────────────

class CSRFToken(BaseModel):
    csrf_token: str


# ── Continuous capture (brain updates) ────────────────────────────────────────

class BrainUpdateLinkOut(BaseModel):
    token: str


class BrainUpdateOut(BaseModel):
    id: str
    contributor_name: str
    contributor_email: str
    topic: str
    content: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PublicBrainUpdateOut(BaseModel):
    brain_name: str
    asker_name: str


class SubmitUpdateRequest(BaseModel):
    contributor_name: str
    contributor_email: str = ""
    topic: str = ""
    content: str


# ── Knowledge graph (brain relationships) ─────────────────────────────────────

class BrainRelationshipCreate(BaseModel):
    to_slug: str
    rel_type: str


class BrainRelationshipOut(BaseModel):
    id: str
    from_slug: str
    from_name: str
    to_slug: str
    to_name: str
    rel_type: str
    created_at: datetime


class WorkspaceNodeOut(BaseModel):
    id: str
    slug: str
    name: str
    readiness_score: int
    status: str
    relationships: list[BrainRelationshipOut]


class RelationshipSuggestion(BaseModel):
    from_slug: str
    from_name: str
    to_slug: str
    to_name: str
    rel_type: str
    reason: str
