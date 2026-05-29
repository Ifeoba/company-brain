import io
import json
import textwrap
import zipfile
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db
from ..models import Brain, BrainFile, User
from ..readiness import STANDARD_FILES, compute_readiness

router = APIRouter()

AGENT_PY = textwrap.dedent('''\
    """
    Starter agent for this brain.

    Reads the brain folder, takes a single case as input, calls Claude with the
    brain attached as system context, and returns the decision.

    Usage:
        pip install anthropic
        export ANTHROPIC_API_KEY=sk-ant-...
        python agent.py path/to/case.txt
    """
    import sys
    import os
    from pathlib import Path
    from anthropic import Anthropic

    BRAIN_DIR = Path(__file__).parent
    BRAIN_FILES = [
        "01-service-definition.md",
        "02-how-work-happens.md",
        "02-unwritten-rules.md",
        "03-decision-rules.md",
        "04-skills.md",
        "05-guardrails.md",
    ]

    def load_brain() -> str:
        """Concatenate the brain files into a single system prompt."""
        parts = []
        for filename in BRAIN_FILES:
            path = BRAIN_DIR / filename
            if path.exists():
                parts.append(f"## {filename}\\n\\n{path.read_text()}")
        return "\\n\\n".join(parts)

    def handle_case(case_text: str) -> str:
        """Apply the brain to one case and return the decision."""
        client = Anthropic()  # reads ANTHROPIC_API_KEY from env
        brain = load_brain()

        system = (
            "You are an AI agent operating within a company brain -- a structured "
            "specification of how a specific job should be done. Follow the rules, "
            "honour the guardrails, and apply the decision logic exactly as written.\\n\\n"
            f"{brain}\\n\\n"
            "When you receive a case, do three things:\\n"
            "1. State which decision rule(s) apply, by name or number.\\n"
            "2. State the decision the brain dictates.\\n"
            "3. Flag any guardrail that requires human approval before action."
        )

        response = client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001"),
            max_tokens=2048,
            system=system,
            messages=[{"role": "user", "content": f"CASE:\\n\\n{case_text}"}],
        )
        return response.content[0].text

    if __name__ == "__main__":
        if len(sys.argv) < 2:
            case = sys.stdin.read()
        else:
            case = Path(sys.argv[1]).read_text()
        print(handle_case(case))
''')


def _get_brain(db: Session, slug: str, user: User) -> Brain:
    from fastapi import HTTPException
    brain = db.query(Brain).filter_by(slug=slug, owner_id=user.id).first()
    if not brain:
        raise HTTPException(status_code=404, detail="Brain not found")
    return brain


def _file_complete(content: str | None) -> bool:
    if not content or len(content.strip()) < 200:
        return False
    return "REPLACE WITH" not in content


def _generate_progress(files: dict[str, str], score: int) -> str:
    items = [
        ("01-service-definition.md", "01 -- Service definition"),
        ("02-how-work-happens.md", "02 -- How work happens"),
        ("02-unwritten-rules.md", "02 -- Unwritten rules"),
        ("03-decision-rules.md", "03 -- Decision rules"),
        ("03-evals.json", "03 -- Evals (10+ cases required)"),
        ("04-skills.md", "04 -- Skills"),
        ("05-guardrails.md", "05 -- Guardrails"),
        ("06-proof-log.md", "06 -- Proof log (real entries)"),
    ]
    lines = ["# Brain Progress\n"]
    for filename, label in items:
        checked = "x" if _file_complete(files.get(filename)) else " "
        lines.append(f"- [{checked}] {label}")
    lines.append(f"\n**Readiness: {score}/100**\n")
    if score < 60:
        lines.append(
            "This brain is not ready for production use. The unchecked items above "
            "must be filled in before deploying the brain against real work."
        )
    else:
        lines.append(
            "This brain is ready for testing. Use the platform's Run feature, or the "
            "`agent.py` starter, to begin processing real cases. As you accumulate "
            "proof entries, the brain's readiness will increase."
        )
    return "\n".join(lines)


def _extract_service_blurb(service_def: str | None) -> str:
    if not service_def:
        return "_Service definition not yet completed._"
    for line in service_def.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#") and not stripped.startswith("<!--") and "-->" not in stripped and "REPLACE WITH" not in stripped:
            return stripped
    return "_Service definition not yet completed._"


def _generate_readme(brain: Brain, files: dict[str, str], score: int) -> str:
    complete_count = sum(1 for f in STANDARD_FILES if _file_complete(files.get(f)))
    has_proof = _file_complete(files.get("06-proof-log.md"))
    blurb = _extract_service_blurb(files.get("01-service-definition.md"))

    return f"""# {brain.name}

This folder is a **company brain** -- a structured specification of how one specific job gets done at your company. It is designed to be read by an AI agent so the AI handles this work the same way a trained human would.

## What this brain does

{blurb}

## Status

- Readiness score: {score}/100
- Files complete: {complete_count}/{len(STANDARD_FILES)}
- Has real proof entries: {"yes" if has_proof else "no"}

## How to use this brain

There are three ways to use this folder:

**1. Manually, with Claude or another AI assistant.** Open a Claude conversation, attach this folder, and ask it to handle a real case. The AI will follow the rules in `03-decision-rules.md` and respect the limits in `05-guardrails.md`.

**2. With Claude Code or a developer.** A developer can wire this brain into a script that runs whenever an event happens -- see `agent.py` in this folder for a working starter example.

**3. On the Company Brain platform.** Import this folder back into the platform and use the Run feature to process cases one at a time with human review. This is the recommended path while you're still validating the brain on real work.

## File guide

- `01-service-definition.md` -- what this brain does and what it's for
- `02-how-work-happens.md` -- the current workflow being encoded
- `02-unwritten-rules.md` -- institutional knowledge that isn't in any other doc
- `03-decision-rules.md` -- the IF/THEN rules the agent applies
- `03-evals.json` -- test cases the brain must handle correctly
- `04-skills.md` -- what the agent can do, what tools it needs
- `05-guardrails.md` -- what the agent must never do without approval
- `06-proof-log.md` -- record of real cases the brain has handled

_Generated by Company Brain on {datetime.utcnow().strftime("%Y-%m-%d")}_
"""


@router.get("/api/brains/{slug}/export")
def export_brain(
    slug: str,
    force: bool = Query(False),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    from fastapi import HTTPException
    brain = _get_brain(db, slug, user)
    file_rows = db.query(BrainFile).filter_by(brain_id=brain.id).all()
    files = {f.filename: f.content or "" for f in file_rows}

    readiness = compute_readiness(files)
    score = readiness.score

    if score < 30 and not force:
        raise HTTPException(
            status_code=422,
            detail=(
                "This brain is too incomplete to export. Please fill in at least "
                "Steps 1-3 before exporting. Use ?force=true to override."
            ),
        )

    buf = io.BytesIO()
    folder = f"{brain.slug}-brain"

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for filename in STANDARD_FILES:
            content = files.get(filename, "")
            zf.writestr(f"{folder}/{filename}", content)

        zf.writestr(f"{folder}/brain-readme.md", _generate_readme(brain, files, score))
        zf.writestr(f"{folder}/progress.md", _generate_progress(files, score))
        zf.writestr(f"{folder}/agent.py", AGENT_PY)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={folder}.zip"},
    )
