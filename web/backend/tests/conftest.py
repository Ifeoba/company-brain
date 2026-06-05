import os
os.environ.setdefault("SESSION_SECRET", "test-secret-key-for-tests-only")
os.environ.setdefault("FERNET_KEY", "wOIzgsHoeBer6hUuxaDXJBgCYpJvMHjWBOzgOVX2g0Y=")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("GITHUB_CLIENT_ID", "test")
os.environ.setdefault("GITHUB_CLIENT_SECRET", "test")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app import create_app
from backend.auth import current_user
from backend.db import get_db
from backend.models import Base, User


@pytest.fixture(scope="function")
def db_engine():
    # StaticPool forces a single shared connection so all operations —
    # metadata.create_all, session queries — see the same in-memory DB.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def db_session(db_engine):
    Session = sessionmaker(bind=db_engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture(scope="function")
def client(db_session):
    app = create_app()

    def override_db():
        yield db_session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c


@pytest.fixture
def authed_client(client, db_session):
    user = User(
        github_id="12345",
        github_username="testuser",
        email="test@example.com",
        avatar_url="https://example.com/avatar.png",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    app = client.app

    def override_current_user():
        return user

    app.dependency_overrides[current_user] = override_current_user
    client._user = user
    return client
