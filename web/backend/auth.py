import secrets
from datetime import datetime
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User

GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"


def get_github_auth_url(state: str) -> str:
    params = {
        "client_id": settings.github_client_id,
        "redirect_uri": settings.github_redirect_uri,
        "scope": "read:user user:email",
        "state": state,
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{GITHUB_AUTH_URL}?{query}"


def exchange_code_for_token(code: str) -> str:
    resp = httpx.post(
        GITHUB_TOKEN_URL,
        data={
            "client_id": settings.github_client_id,
            "client_secret": settings.github_client_secret,
            "code": code,
            "redirect_uri": settings.github_redirect_uri,
        },
        headers={"Accept": "application/json"},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    token = data.get("access_token")
    if not token:
        raise ValueError(f"GitHub OAuth error: {data.get('error_description', data)}")
    return token


def fetch_github_user(token: str) -> dict:
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    user_resp = httpx.get(GITHUB_USER_URL, headers=headers, timeout=10)
    user_resp.raise_for_status()
    user = user_resp.json()

    if not user.get("email"):
        emails_resp = httpx.get(GITHUB_EMAILS_URL, headers=headers, timeout=10)
        if emails_resp.status_code == 200:
            primary = next(
                (e["email"] for e in emails_resp.json() if e.get("primary") and e.get("verified")),
                None,
            )
            user["email"] = primary or ""
    return user


def upsert_user(db: Session, github_user: dict) -> User:
    github_id = str(github_user["id"])
    user = db.query(User).filter_by(github_id=github_id).first()
    if user:
        user.github_username = github_user.get("login", "")
        user.email = github_user.get("email") or ""
        user.avatar_url = github_user.get("avatar_url", "")
    else:
        user = User(
            github_id=github_id,
            github_username=github_user.get("login", ""),
            email=github_user.get("email") or "",
            avatar_url=github_user.get("avatar_url", ""),
            created_at=datetime.utcnow(),
        )
        db.add(user)
    db.commit()
    db.refresh(user)
    return user


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def optional_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    user_id = request.session.get("user_id")
    if not user_id:
        return None
    return db.query(User).filter_by(id=user_id).first()


def generate_state() -> str:
    return secrets.token_urlsafe(32)
