import json
from pathlib import Path

from builder.scaffolder import REQUIRED_FILES, PLACEHOLDER

_EVALS_REQUIRED_KEYS = {"service", "version", "evals"}


def run(args) -> int:
    name = args.name

    # Accept direct path, name with -brain suffix, or bare name
    candidate = Path(name)
    if candidate.exists() and candidate.is_dir():
        brain_dir = candidate
    else:
        folder_name = name if name.endswith("-brain") else f"{name}-brain"
        base = Path(args.dest) if args.dest else Path("brains")
        brain_dir = base / folder_name

    if not brain_dir.exists():
        print(f"✗ Brain folder not found: {brain_dir}")
        return 1

    issues: list[str] = []
    lines: list[str] = [str(brain_dir) + "/"]

    for filename in REQUIRED_FILES:
        f = brain_dir / filename
        col = f"{filename:<42}"

        if not f.exists():
            lines.append(f"  ✗ {col} missing")
            issues.append(f"missing: {filename}")
            continue

        if f.stat().st_size == 0:
            lines.append(f"  ✗ {col} empty file")
            issues.append(f"empty: {filename}")
            continue

        lines.append(f"  ✓ {col} present")

        try:
            text = f.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            lines.append(f"  ✗ {col} could not read: {e}")
            issues.append(f"unreadable: {filename}")
            continue

        count = text.count(PLACEHOLDER)
        if count > 0:
            s = "s" if count != 1 else ""
            lines.append(f"  ✗ {col} contains \"REPLACE WITH\" ({count} occurrence{s})")
            issues.append(f"placeholders: {filename} ({count})")

        if filename == "03-evals.json":
            try:
                data = json.loads(text)
            except json.JSONDecodeError as e:
                lines.append(f"  ✗ {col} invalid JSON: {e}")
                issues.append(f"invalid JSON: {filename}")
                continue

            missing = _EVALS_REQUIRED_KEYS - set(data.keys())
            if missing:
                lines.append(f"  ✗ {col} missing top-level keys: {', '.join(sorted(missing))}")
                issues.append(f"missing keys in {filename}: {missing}")
            elif not isinstance(data.get("evals"), list):
                lines.append(f"  ✗ {col} 'evals' must be an array")
                issues.append(f"'evals' not an array: {filename}")
            else:
                n = len(data["evals"])
                lines.append(f"  ✓ {col} valid JSON ({n} eval case{'s' if n != 1 else ''})")

    if not brain_dir.name.endswith("-brain"):
        lines.append(f"  ✗ folder name '{brain_dir.name}' should end in '-brain'")
        issues.append("folder name does not end in -brain")

    print("\n".join(lines))

    if issues:
        n = len(issues)
        print(f"\n  Status: not ready ({n} issue{'s' if n != 1 else ''})")
        return 1

    print("\n  Status: ready")
    return 0
