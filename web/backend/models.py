import uuid
from datetime import datetime
from sqlalchemy import (
    Boolean, Column, String, Text, Integer, DateTime, ForeignKey,
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
    llm_provider = Column(String(32), default="anthropic", server_default="anthropic")
    created_at = Column(DateTime, default=datetime.utcnow)

    brains = relationship("Brain", back_populates="owner", cascade="all, delete-orphan")


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(36), primary_key=True, default=_uuid)
    name = Column(String(256), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    vault_secrets = relationship("VaultSecret", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"

    id = Column(String(36), primary_key=True, default=_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    role = Column(String(16), nullable=False, default="viewer")  # owner|admin|reviewer|viewer
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_member"),)

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User")


class VaultSecret(Base):
    """Encrypted secrets per workspace. Plaintext never leaves the Celery worker."""
    __tablename__ = "vault_secrets"

    id = Column(String(36), primary_key=True, default=_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(128), nullable=False)  # e.g. "slack_token", "anthropic_key"
    encrypted_value = Column(LargeBinary, nullable=False)
    created_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("workspace_id", "name", name="uq_vault_secret"),)

    workspace = relationship("Workspace", back_populates="vault_secrets")
    created_by = relationship("User", foreign_keys=[created_by_user_id])


class Brain(Base):
    __tablename__ = "brains"

    id = Column(String(36), primary_key=True, default=_uuid)
    slug = Column(String(128), nullable=False)
    name = Column(String(256), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (UniqueConstraint("owner_id", "slug", name="uq_brain_owner_slug"),)

    owner = relationship("User", back_populates="brains")
    workspace = relationship("Workspace")
    files = relationship("BrainFile", back_populates="brain", cascade="all, delete-orphan")
    interview_state = relationship("InterviewState", back_populates="brain", uselist=False, cascade="all, delete-orphan")
    collaborators = relationship("Collaborator", back_populates="brain", cascade="all, delete-orphan")
    expert_questions = relationship("ExpertQuestion", back_populates="brain", cascade="all, delete-orphan")
    update_link = relationship("BrainUpdateLink", back_populates="brain", uselist=False, cascade="all, delete-orphan")


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


class BrainUpdateLink(Base):
    __tablename__ = "brain_update_links"

    id = Column(String(36), primary_key=True, default=_uuid)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False, unique=True)
    token = Column(String(32), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    brain = relationship("Brain", back_populates="update_link")
    updates = relationship("BrainUpdate", back_populates="link", cascade="all, delete-orphan")


class BrainUpdate(Base):
    __tablename__ = "brain_updates"

    id = Column(String(36), primary_key=True, default=_uuid)
    link_id = Column(String(36), ForeignKey("brain_update_links.id"), nullable=False)
    contributor_name = Column(String(256), nullable=False)
    contributor_email = Column(String(256), default="")
    topic = Column(String(256), default="")
    content = Column(Text, nullable=False)
    status = Column(String(16), default="pending")  # pending | integrated | dismissed
    created_at = Column(DateTime, default=datetime.utcnow)

    link = relationship("BrainUpdateLink", back_populates="updates")


class BrainRelationship(Base):
    __tablename__ = "brain_relationships"

    id = Column(String(36), primary_key=True, default=_uuid)
    from_brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    to_brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    rel_type = Column(String(32), nullable=False)  # depends-on | uses | related-to | feeds-into
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (UniqueConstraint("from_brain_id", "to_brain_id", "rel_type", name="uq_brain_rel"),)

    from_brain = relationship("Brain", foreign_keys=[from_brain_id])
    to_brain = relationship("Brain", foreign_keys=[to_brain_id])


# ── Triggers ──────────────────────────────────────────────────────────────────

class Trigger(Base):
    __tablename__ = "triggers"

    id = Column(String(36), primary_key=True, default=_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    kind = Column(String(16), nullable=False)  # webhook|email|schedule|database|manual
    name = Column(String(256), nullable=False)
    config = Column(Text, default="{}")  # JSON
    secret = Column(String(64), nullable=True)
    inbound_email = Column(String(256), nullable=True)
    cron_expression = Column(String(64), nullable=True)
    is_active = Column(Boolean, default=True)
    last_fired_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace")
    brain = relationship("Brain")
    runs = relationship("Run", back_populates="trigger")


# ── Tools ─────────────────────────────────────────────────────────────────────

class Tool(Base):
    __tablename__ = "tools"

    id = Column(String(36), primary_key=True, default=_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    name = Column(String(64), nullable=False)  # e.g. "send_slack_message"
    description = Column(Text, default="")
    category = Column(String(32), nullable=False)  # messaging|database|email|webhook|http
    risk = Column(String(16), nullable=False)  # safe|confirm|escalate
    config = Column(Text, default="{}")  # JSON, references vault secret names
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace")
    brain_tools = relationship("BrainTool", back_populates="tool")


class BrainTool(Base):
    __tablename__ = "brain_tools"

    id = Column(String(36), primary_key=True, default=_uuid)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    tool_id = Column(String(36), ForeignKey("tools.id"), nullable=False)

    __table_args__ = (UniqueConstraint("brain_id", "tool_id", name="uq_brain_tool"),)

    brain = relationship("Brain")
    tool = relationship("Tool", back_populates="brain_tools")


# ── Runtime (Tier 3) ──────────────────────────────────────────────────────────

class Run(Base):
    __tablename__ = "runs"

    id = Column(String(36), primary_key=True, default=_uuid)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=True)
    trigger_id = Column(String(36), ForeignKey("triggers.id"), nullable=True)
    case_text = Column(Text, nullable=False)
    case_filename = Column(String(256), nullable=True)
    dedup_key = Column(String(128), nullable=True)  # idempotency key per trigger
    decision_text = Column(Text, nullable=True)
    cited_rules = Column(Text, default="[]")  # JSON array of strings
    model_used = Column(String(128), nullable=False, default="")
    tokens_in = Column(Integer, default=0)
    tokens_out = Column(Integer, default=0)
    status = Column(String(20), default="pending")  # pending|queued|running|awaiting_approval|completed|failed
    error_text = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    brain = relationship("Brain")
    user = relationship("User")
    workspace = relationship("Workspace")
    trigger = relationship("Trigger", back_populates="runs")
    review = relationship("Review", back_populates="run", uselist=False, cascade="all, delete-orphan")
    tool_calls = relationship("ToolCall", back_populates="run", cascade="all, delete-orphan")
    escalations = relationship("Escalation", back_populates="run", cascade="all, delete-orphan")
    steps = relationship("RunStep", back_populates="run", cascade="all, delete-orphan", order_by="RunStep.step_index")


class ToolCall(Base):
    __tablename__ = "tool_calls"

    id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=False)
    tool_id = Column(String(36), ForeignKey("tools.id"), nullable=False)
    arguments = Column(Text, default="{}")  # JSON
    status = Column(String(20), nullable=False, default="pending_approval")  # pending_approval|approved|executed|failed|denied
    result = Column(Text, nullable=True)  # JSON
    error = Column(Text, nullable=True)
    approver_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    requested_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)

    run = relationship("Run", back_populates="tool_calls")
    tool = relationship("Tool")
    approver = relationship("User", foreign_keys=[approver_user_id])
    escalation = relationship("Escalation", back_populates="tool_call", uselist=False)


class Escalation(Base):
    __tablename__ = "escalations"

    id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=False)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    reason = Column(Text, nullable=False)
    guardrail_cited = Column(String(256), nullable=True)
    tool_call_id = Column(String(36), ForeignKey("tool_calls.id"), nullable=True)
    assigned_to_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(16), nullable=False, default="pending")  # pending|resolved
    resolution = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    run = relationship("Run", back_populates="escalations")
    workspace = relationship("Workspace")
    tool_call = relationship("ToolCall", back_populates="escalation")
    assigned_to = relationship("User", foreign_keys=[assigned_to_user_id])


class Review(Base):
    __tablename__ = "reviews"

    id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=False, unique=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    verdict = Column(String(16), nullable=False)  # approved | corrected | rejected
    notes = Column(Text, default="")
    corrected_decision = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("Run", back_populates="review")
    user = relationship("User")
    generated_eval = relationship("GeneratedEval", back_populates="review", uselist=False, cascade="all, delete-orphan")


# ── Run trace ─────────────────────────────────────────────────────────────────

class RunStep(Base):
    __tablename__ = "run_steps"

    id = Column(String(36), primary_key=True, default=_uuid)
    run_id = Column(String(36), ForeignKey("runs.id"), nullable=False)
    step_index = Column(Integer, nullable=False)
    kind = Column(String(32), nullable=False)
    # thinking|tool_call|approval_requested|approval_granted|tool_executed|tool_failed|guardrail_blocked|final_decision
    content = Column(Text, nullable=True)
    metadata_json = Column(Text, default="{}")
    occurred_at = Column(DateTime, default=datetime.utcnow)

    run = relationship("Run", back_populates="steps")


class GeneratedEval(Base):
    __tablename__ = "generated_evals"

    id = Column(String(36), primary_key=True, default=_uuid)
    review_id = Column(String(36), ForeignKey("reviews.id"), nullable=False, unique=True)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=True)
    case_text = Column(Text, nullable=False)
    expected_outcome = Column(Text, nullable=False)
    difficulty = Column(String(32), default="edge")
    source = Column(String(64), default="production correction")
    written_back = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    review = relationship("Review", back_populates="generated_eval")
    brain = relationship("Brain")


# ── Maintainer ────────────────────────────────────────────────────────────────

class MaintainerSuggestion(Base):
    __tablename__ = "maintainer_suggestions"

    id = Column(String(36), primary_key=True, default=_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    brain_id = Column(String(36), ForeignKey("brains.id"), nullable=False)
    pattern_type = Column(String(64), nullable=False)  # recurring_escalation|drifting_eval|silent_corrections|untouched_brain|quiet_brain
    finding = Column(Text, nullable=False)
    proposed_diff = Column(Text, nullable=True)
    target_file = Column(String(128), nullable=True)
    status = Column(String(16), nullable=False, default="pending")  # pending|accepted|dismissed
    accepted_by_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    workspace = relationship("Workspace")
    brain = relationship("Brain")
    accepted_by = relationship("User", foreign_keys=[accepted_by_user_id])


# ── Audit ─────────────────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=_uuid)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=True)
    actor_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    action = Column(String(64), nullable=False)
    resource_type = Column(String(64), nullable=False)
    resource_id = Column(String(36), nullable=True)
    details_json = Column(Text, default="{}")
    occurred_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace")
    actor = relationship("User")
