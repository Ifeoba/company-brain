import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, DateTime, ForeignKey,
    UniqueConstraint, LargeBinary,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    github_id = Column(String(64), unique=True, nullable=False)
    github_username = Column(String(128), nullable=False)
    email = Column(String(256), nullable=False)
    avatar_url = Column(String(512), default="")
    encrypted_anthropic_key = Column(LargeBinary, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    brains = relationship("Brain", back_populates="owner", cascade="all, delete-orphan")


class Brain(Base):
    __tablename__ = "brains"

    id = Column(String(36), primary_key=True, default=_uuid)
    slug = Column(String(128), nullable=False)
    name = Column(String(256), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("owner_id", "slug", name="uq_brain_owner_slug"),)

    owner = relationship("User", back_populates="brains")
    files = relationship("BrainFile", back_populates="brain", cascade="all, delete-orphan")
    interview_state = relationship("InterviewState", back_populates="brain", uselist=False, cascade="all, delete-orphan")
    collaborators = relationship("Collaborator", back_populates="brain", cascade="all, delete-orphan")
    expert_questions = relationship("ExpertQuestion", back_populates="brain", cascade="all, delete-orphan")


class BrainFile(Base):
    __tablename__ = "brain_files"

    id = Column(String(36), primary_key=True, default=_uuid)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    filename = Column(String(128), nullable=False)
    content = Column(Text, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("brain_id", "filename", name="uq_brainfile_brain_filename"),)

    brain = relationship("Brain", back_populates="files")


class InterviewState(Base):
    __tablename__ = "interview_states"

    id = Column(String(36), primary_key=True, default=_uuid)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False, unique=True)
    current_step = Column(Integer, default=1)
    current_question_index = Column(Integer, default=0)
    answers_json = Column(Text, default="{}")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    brain = relationship("Brain", back_populates="interview_state")


class Collaborator(Base):
    __tablename__ = "collaborators"

    id = Column(String(36), primary_key=True, default=_uuid)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    name = Column(String(256), nullable=False)
    email = Column(String(256), nullable=False)
    initials = Column(String(2), nullable=False)
    color_seed = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    brain = relationship("Brain", back_populates="collaborators")
    questions = relationship("ExpertQuestion", back_populates="collaborator")


class ExpertQuestion(Base):
    __tablename__ = "expert_questions"

    id = Column(String(36), primary_key=True, default=_uuid)
    token = Column(String(32), unique=True, nullable=False)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    asker_user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    collaborator_id = Column(String(36), ForeignKey("collaborators.id"), nullable=False)
    step_number = Column(Integer, nullable=False)
    question_key = Column(String(128), nullable=False)
    question_text = Column(Text, nullable=False)
    context_text = Column(Text, default="")
    status = Column(String(16), default="pending")  # pending | answered | expired
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    brain = relationship("Brain", back_populates="expert_questions")
    asker = relationship("User")
    collaborator = relationship("Collaborator", back_populates="questions")
    answer = relationship("ExpertAnswer", back_populates="question", uselist=False, cascade="all, delete-orphan")


class ExpertAnswer(Base):
    __tablename__ = "expert_answers"

    id = Column(String(36), primary_key=True, default=_uuid)
    expert_question_id = Column(String(36), ForeignKey("expert_questions.id"), nullable=False, unique=True)
    answer_text = Column(Text, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)

    question = relationship("ExpertQuestion", back_populates="answer")
