from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import current_user
from ..crypto import encrypt_key
from ..db import get_db
from ..models import User
from ..schemas import SetApiKeyRequest

router = APIRouter()


@router.put("/api/me/anthropic-key")
def set_anthropic_key(body: SetApiKeyRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not body.api_key.startswith("sk-"):
        raise HTTPException(status_code=400, detail="Invalid API key format")
    user.encrypted_anthropic_key = encrypt_key(body.api_key)
    db.commit()
    return {"ok": True}


@router.delete("/api/me/anthropic-key")
def delete_anthropic_key(user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.encrypted_anthropic_key = None
    db.commit()
    return {"ok": True}
