from pathlib import Path

from builder.scaffolder import REQUIRED_FILES, PLACEHOLDER


def _brain_status(brain_dir: Path) -> tuple[int, int, str]:
    """Returns (file_count, total_placeholders, status_string)."""
    file_count = sum(1 for f in REQUIRED_FILES if (brain_dir / f).exists())

    files_with_placeholders = 0
    total_placeholders = 0
    for name in REQUIRED_FILES:
        f = brain_dir / name
        if not f.exists():
            continue
        try:
            count = f.read_text(encoding="utf-8").count(PLACEHOLDER)
        except (OSError, UnicodeDecodeError):
            count = 0
        total_placeholders += count
        if count > 0:
            files_with_placeholders += 1

    if file_count == len(REQUIRED_FILES) and total_placeholders == 0:
        status = "ready"
    elif file_count > 0 and files_with_placeholders == file_count:
        status = "not started"
    else:
        status = "in formation"

    return file_count, total_placeholders, status


def run(args) -> int:
    base = Path(args.dest) if args.dest else Path("brains")

    if not base.exists():
        print(f"Directory not found: {base}")
        print("Run 'companybrain init <slug>' to create your first brain.")
        return 0

    brains = sorted(p for p in base.iterdir() if p.is_dir() and p.name.endswith("-brain"))

    header = f"{'NAME':<30} {'STATUS':<15} {'FILES':<8} PLACEHOLDERS"
    print(header)
    print("-" * len(header))

    if not brains:
        print("(no brains found)")
        return 0

    for brain_dir in brains:
        name = brain_dir.name[:-6]  # strip -brain
        file_count, placeholders, status = _brain_status(brain_dir)
        print(f"{name:<30} {status:<15} {file_count}/{len(REQUIRED_FILES):<6} {placeholders}")

    return 0
