from pathlib import Path

REQUIRED_FILES = [
    "01-service-definition.md",
    "02-how-work-happens.md",
    "02-unwritten-rules.md",
    "03-decision-rules.md",
    "03-evals.json",
    "04-skills.md",
    "05-guardrails.md",
    "06-proof-log.md",
    "brain-readme.md",
]

PLACEHOLDER = "REPLACE WITH"


def templates_path() -> Path:
    return Path(__file__).parent.parent / "spec" / "templates"
