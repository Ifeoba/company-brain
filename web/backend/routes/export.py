import io
import zipfile
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, BrainFile, User
from ..readiness import STANDARD_FILES

router = APIRouter()


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    from fastapi import HTTPException
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


@router.get("/api/brains/{slug}/export")
def export_brain(slug: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    brain = _get_brain(db, slug, user)
    files = {f.filename: f.content for f in db.query(BrainFile).filter_by(brain_id=brain.id).all()}

    buf = io.BytesIO()
    folder = f"{brain.slug}-brain"

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename in STANDARD_FILES:
            content = files.get(filename, "")
            zf.writestr(f"{folder}/{filename}", content)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={folder}.zip"},
    )
