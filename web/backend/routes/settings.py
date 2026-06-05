from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..crypto import encrypt_key
from ..db import get_db
from ..llm_client import PROVIDERS, test_credential
from ..models import User, UserLLMCredential
from ..schemas import (
    LLMCredentialOut, ProviderInfo, SaveLLMCredentialRequest,
    SetApiKeyRequest, TestCredentialRequest,
)

router = APIRouter()


@router.get("/api/me/providers", response_model=list[ProviderInfo])
def list_providers():
    return [
        ProviderInfo(id=pid, name=p["name"], key_hint=p["key_hint"], key_url=p["key_url"])
        for pid, p in PROVIDERS.items()
    ]


# ── Per-provider credential management ───────────────────────────────────────

@router.get("/api/me/llm-credentials", response_model=list[LLMCredentialOut])
def list_llm_credentials(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.query(UserLLMCredential).filter_by(user_id=user.id).all()


@router.post("/api/me/llm-credentials", response_model=LLMCredentialOut)
def save_llm_credential(
    body: SaveLLMCredentialRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if body.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider: {}".format(body.provider))

    encrypted = encrypt_key(body.api_key.encode())

    cred = db.query(UserLLMCredential).filter_by(user_id=user.id, provider=body.provider).first()
    if cred:
        cred.encrypted_api_key = encrypted
        cred.label = body.label
    else:
        cred = UserLLMCredential(
            user_id=user.id,
            provider=body.provider,
            encrypted_api_key=encrypted,
            label=body.label,
            is_active=False,
        )
        db.add(cred)
    db.flush()
    db.commit()
    db.refresh(cred)
    return cred


@router.delete("/api/me/llm-credentials/{provider}")
def delete_llm_credential(
    provider: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    cred = db.query(UserLLMCredential).filter_by(user_id=user.id, provider=provider).first()
    if not cred:
        raise HTTPException(status_code=404, detail="No credential for provider: {}".format(provider))
    db.delete(cred)
    # If deleting the active provider, fall back to anthropic
    if user.llm_provider == provider:
        user.llm_provider = "anthropic"
        user.encrypted_anthropic_key = None
    db.commit()
    return {"ok": True}


@router.post("/api/me/llm-credentials/{provider}/test")
def test_llm_credential(
    provider: str,
    body: TestCredentialRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider: {}".format(provider))

    if body.api_key:
        # Test an unsaved key
        return test_credential(body.api_key, provider)

    # Test the saved credential
    from ..crypto import decrypt_key
    cred = db.query(UserLLMCredential).filter_by(user_id=user.id, provider=provider).first()
    if not cred:
        # Fallback: legacy field for anthropic
        if provider == "anthropic" and user.encrypted_anthropic_key:
            api_key = decrypt_key(user.encrypted_anthropic_key).decode()
        else:
            raise HTTPException(status_code=404, detail="No credential saved for {}".format(provider))
    else:
        api_key = decrypt_key(cred.encrypted_api_key).decode()

    return test_credential(api_key, provider)


@router.post("/api/me/llm-credentials/{provider}/activate")
def activate_llm_credential(
    provider: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider: {}".format(provider))

    cred = db.query(UserLLMCredential).filter_by(user_id=user.id, provider=provider).first()
    has_legacy = provider == "anthropic" and user.encrypted_anthropic_key
    if not cred and not has_legacy:
        raise HTTPException(
            status_code=400,
            detail="No credential saved for {}. Save a key first.".format(provider),
        )

    # Deactivate all, activate selected
    for c in db.query(UserLLMCredential).filter_by(user_id=user.id).all():
        c.is_active = c.provider == provider
    if cred:
        cred.is_active = True

    user.llm_provider = provider
    db.commit()
    return {"ok": True, "provider": provider}


# ── Legacy endpoints (kept for backwards compatibility) ───────────────────────

@router.put("/api/me/api-key")
def set_api_key(
    body: SetApiKeyRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if body.provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider: {}".format(body.provider))

    encrypted = encrypt_key(body.api_key.encode())

    # Write to UserLLMCredential
    cred = db.query(UserLLMCredential).filter_by(user_id=user.id, provider=body.provider).first()
    if cred:
        cred.encrypted_api_key = encrypted
        cred.is_active = True
    else:
        cred = UserLLMCredential(
            user_id=user.id,
            provider=body.provider,
            encrypted_api_key=encrypted,
            is_active=True,
        )
        db.add(cred)

    # Deactivate other credentials
    for c in db.query(UserLLMCredential).filter_by(user_id=user.id).all():
        if c.provider != body.provider:
            c.is_active = False

    # Keep legacy field for anthropic for backward compat
    if body.provider == "anthropic":
        user.encrypted_anthropic_key = encrypted
    user.llm_provider = body.provider
    db.commit()
    return {"ok": True}


@router.delete("/api/me/api-key")
def delete_api_key(user: User = Depends(current_user), db: Session = Depends(get_db)):
    cred = db.query(UserLLMCredential).filter_by(
        user_id=user.id, provider=user.llm_provider
    ).first()
    if cred:
        db.delete(cred)
    user.encrypted_anthropic_key = None
    db.commit()
    return {"ok": True}


@router.put("/api/me/anthropic-key")
def set_anthropic_key_legacy(
    body: SetApiKeyRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    return set_api_key(body, user, db)


@router.delete("/api/me/anthropic-key")
def delete_anthropic_key_legacy(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return delete_api_key(user, db)
