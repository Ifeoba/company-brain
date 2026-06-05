import json
from .schemas import ReadinessOut, FileDimension

PLACEHOLDER = "REPLACE WITH"

STANDARD_FILES = [
    "01-service-definition.md",
    "02-how-work-happens.md",
    "02-unwritten-rules.md",
    "03-decision-rules.md",
    "03-evals.json",
    "04-skills.md",
    "05-guardrails.md",
    "06-proof-log.md",
    "brain-readme.md",
    "progress.md",
]


def _placeholder_count(content: str) -> int:
    return content.count(PLACEHOLDER)


def _is_proof_log_placeholder(content: str) -> bool:
    lines = [l.strip() for l in content.splitlines() if l.strip() and not l.strip().startswith("#") and not l.strip().startswith("<!--")]
    real_lines = [l for l in lines if l and "-->" not in l]
    return len(real_lines) < 3


def _eval_count(content: str) -> int:
    try:
        data = json.loads(content)
        return len(data.get("evals", []))
    except Exception:
        return 0


def compute_readiness(file_map: dict[str, str]) -> ReadinessOut:
    """
    file_map: {filename: content} for all files that exist.
    Returns score 0-100 and per-file breakdown.
    """
    score = 0
    dims: list[FileDimension] = []
    total_placeholders = 0

    for filename in STANDARD_FILES:
        content = file_map.get(filename)
        exists = content is not None and len(content.strip()) > 0
        ph_count = _placeholder_count(content) if content else 0
        total_placeholders += ph_count
        note = ""

        if exists:
            score += 10
            if filename == "03-evals.json":
                n = _eval_count(content)
                if n < 10:
                    score -= 5
                    note = f"only {n} evals (need 10+)"
            elif filename == "06-proof-log.md":
                if _is_proof_log_placeholder(content):
                    score -= 5
                    note = "no real proof entry yet"

        dims.append(FileDimension(
            filename=filename,
            exists=exists,
            placeholder_count=ph_count,
            note=note,
        ))

    if total_placeholders == 0 and score > 0:
        score += 10

    score = max(0, min(100, score))
    return ReadinessOut(score=score, files=dims)
