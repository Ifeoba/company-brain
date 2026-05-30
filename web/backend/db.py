from __future__ import annotations
from contextlib import contextmanager
from pathlib import Path
from typing import Optional
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from .config import settings
from .models import Base


def _make_engine(url: Optional[str] = None):
    db_url = url or settings.database_url
    if db_url.startswith("sqlite"):
        if "///" in db_url:
            db_path = db_url.split("///", 1)[1]
            if db_path and not db_path.startswith(":"):
                Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        return create_engine(db_url, connect_args={"check_same_thread": False})
    return create_engine(db_url)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def _migrate(eng) -> None:
    """Additive ALTER TABLE migrations. Each block is idempotent via try/except."""
    with eng.connect() as conn:
        for stmt in [
            "ALTER TABLE users ADD COLUMN llm_provider VARCHAR(32) DEFAULT 'anthropic'",
            "ALTER TABLE brains ADD COLUMN workspace_id VARCHAR(36)",
            "ALTER TABLE runs ADD COLUMN workspace_id VARCHAR(36)",
            "ALTER TABLE runs ADD COLUMN trigger_id VARCHAR(36)",
            "ALTER TABLE runs ADD COLUMN dedup_key VARCHAR(128)",
            "ALTER TABLE generated_evals ADD COLUMN workspace_id VARCHAR(36)",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass


def _backfill_workspaces(eng) -> None:
    """
    Create one workspace per user and wire existing brains/runs into it.
    Idempotent: skips users who already have a workspace.
    """
    import uuid
    from datetime import datetime

    db = SessionLocal()
    try:
        from .models import User, Workspace, WorkspaceMember, Brain, Run

        users = db.query(User).all()
        for user in users:
            ws = db.query(Workspace).filter_by(owner_id=user.id).first()
            if not ws:
                ws = Workspace(
                    id=str(uuid.uuid4()),
                    name="{}'s workspace".format(user.github_username),
                    owner_id=user.id,
                    created_at=datetime.utcnow(),
                )
                db.add(ws)
                db.flush()

                db.add(WorkspaceMember(
                    workspace_id=ws.id,
                    user_id=user.id,
                    role="owner",
                ))
                db.flush()

            for brain in db.query(Brain).filter_by(owner_id=user.id).all():
                if not brain.workspace_id:
                    brain.workspace_id = ws.id

            runs = (
                db.query(Run)
                .join(Brain, Run.brain_id == Brain.id)
                .filter(Brain.owner_id == user.id, Run.workspace_id == None)  # noqa: E711
                .all()
            )
            for run in runs:
                run.workspace_id = ws.id

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    _migrate(engine)
    _backfill_workspaces(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope():
    """Context manager for DB sessions used in background tasks and Celery workers."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
