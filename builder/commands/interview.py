import os
import sys
from pathlib import Path

from builder.interview.runner import InterviewRunner


_DEFAULT_MODEL = "claude-haiku-4-5-20251001"


def _get_client():
    try:
        import anthropic
    except ImportError:
        print("✗ The anthropic package is required for the interview command.")
        print("  Run: pip install anthropic")
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("✗ ANTHROPIC_API_KEY environment variable is not set.")
        print("  Get a key at https://console.anthropic.com/")
        print("  Then: export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    import anthropic
    return anthropic.Anthropic(api_key=api_key)


def run(args) -> int:
    name = args.name
    folder_name = name if name.endswith("-brain") else f"{name}-brain"
    base = Path(args.dest) if args.dest else Path("brains")
    brain_dir = base / folder_name

    if not brain_dir.exists():
        print(f"✗ Brain folder not found: {brain_dir}")
        print(f"  Run: companybrain init {name}")
        return 1

    model = (
        args.model
        or os.environ.get("COMPANYBRAIN_MODEL")
        or _DEFAULT_MODEL
    )

    client = _get_client()

    runner = InterviewRunner(brain_dir=brain_dir, client=client, model=model)
    try:
        runner.run(start_step=args.step)
    except KeyboardInterrupt:
        print("\n\n  Interrupted. Progress saved for completed steps. Run again to continue.")
        return 1

    return 0
