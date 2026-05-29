from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..crypto import encrypt_key
from ..db import get_db
from ..llm_client import PROVIDERS
from ..models import User
from ..schemas import ProviderInfo, SetApiKeyRequest

router = APIRouter()


@router.get("/api/me/providers", response_model=list[ProviderInfo])
def list_providers():
    return [
        ProviderInfo(id=pid, name=p["name"], key_hint=p["key_hint"], key_url=p["key_url"])
        for pid, p in PROVIDERS.items()
    ]


@router.put("/api/me/api-key")
def set_api_key(body: SetApiKeyRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider: {body.provider}")
    user.encrypted_anthropic_key = encrypt_key(body.api_key)
    user.llm_provider = body.provider
    db.commit()
    return {"ok": True}


@router.delete("/api/me/api-key")
def delete_api_key(user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.encrypted_anthropic_key = None
    db.commit()
    return {"ok": True}


# Legacy endpoints — kept for backwards compatibility
@router.put("/api/me/anthropic-key")
def set_anthropic_key_legacy(body: SetApiKeyRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.encrypted_anthropic_key = encrypt_key(body.api_key)
    user.llm_provider = body.provider if body.provider in PROVIDERS else "anthropic"
    db.commit()
    return {"ok": True}


@router.delete("/api/me/anthropic-key")
def delete_anthropic_key_legacy(user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.encrypted_anthropic_key = None
    db.commit()
    return {"ok": True}
