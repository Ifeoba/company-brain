import re
import shutil
from pathlib import Path

from builder.scaffolder import templates_path

SLUG_RE = re.compile(r"^[a-z][a-z0-9-]{1,40}[a-z0-9]$")


def _validate_slug(slug: str) -> str | None:
    if not SLUG_RE.match(slug):
        return (
            f"Invalid slug '{slug}': use lowercase letters, digits, and hyphens only "
            f"(e.g. billing-support, monthly-kpi)"
        )
    words = [w for w in slug.split("-") if w]
    if len(words) < 2:
        return f"Slug must be at least 2 hyphenated words (got {len(words)}): '{slug}'"
    if len(words) > 4:
        return f"Slug must be at most 4 hyphenated words (got {len(words)}): '{slug}'"
    return None


def run(args) -> int:
    slug = args.slug.strip("-")

    if slug.endswith("-brain"):
        folder_name = slug
        service_slug = slug[:-6]
    else:
        folder_name = f"{slug}-brain"
        service_slug = slug

    err = _validate_slug(service_slug)
    if err:
        print(f"✗ {err}")
        return 1

    base = Path(args.dest) if args.dest else Path("brains")
    dest = base / folder_name

    if dest.exists() and not args.force:
        print(f"✗ {dest} already exists. Pass --force to overwrite.")
        return 1

    src = templates_path()
    if not src.exists():
        print(f"✗ Templates directory not found: {src}")
        return 1

    if dest.exists():
        shutil.rmtree(dest)

    base.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dest)

    print(f"✓ Created {dest}/")
    print(f"  Next: open {dest}/01-service-definition.md and fill it in.")
    print(f"  Then: companybrain validate {service_slug}")
    return 0
