import secrets
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..auth import (
    current_user, exchange_code_for_token, fetch_github_user,
    generate_state, get_github_auth_url, upsert_user,
)
from ..config import settings
from ..db import get_db
from ..models import User, Workspace, WorkspaceMember
from ..schemas import CSRFToken, UserOut

router = APIRouter()


@router.get("/api/auth/github/start")
def github_start(request: Request):
    state = generate_state()
    request.session["oauth_state"] = state
    return RedirectResponse(get_github_auth_url(state))


@router.get("/api/auth/github/callback")
def github_callback(request: Request, code: str, state: str, db: Session = Depends(get_db)):
    stored_state = request.session.pop("oauth_state", None)
    if not stored_state or stored_state != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")

    try:
        token = exchange_code_for_token(code)
        github_user = fetch_github_user(token)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    user = upsert_user(db, github_user)

    # Create workspace on first sign-up. Idempotent: skips if one already exists.
    if not db.query(Workspace).filter_by(owner_id=user.id).first():
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
        db.commit()

    request.session["user_id"] = user.id
    request.session["csrf_token"] = secrets.token_urlsafe(32)

    return RedirectResponse(f"{settings.frontend_origin}/")


@router.post("/api/auth/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/api/me", response_model=UserOut)
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    from ..models import UserLLMCredential
    has_cred = db.query(UserLLMCredential).filter_by(user_id=user.id).count() > 0
    has_api_key = user.encrypted_anthropic_key is not None or has_cred
    return UserOut(
        id=user.id,
        github_username=user.github_username,
        email=user.email,
        avatar_url=user.avatar_url,
        has_api_key=has_api_key,
        llm_provider=user.llm_provider or "anthropic",
        created_at=user.created_at,
    )


@router.get("/api/csrf-token", response_model=CSRFToken)
def csrf_token(request: Request):
    token = request.session.get("csrf_token")
    if not token:
        token = secrets.token_urlsafe(32)
        request.session["csrf_token"] = token
    return CSRFToken(csrf_token=token)
