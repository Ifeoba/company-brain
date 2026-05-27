import argparse
import sys

from builder.commands import init, list_brains, validate


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="companybrain",
        description="Build and validate company brains.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="Scaffold a new brain from templates")
    p_init.add_argument("slug", help="Service slug (2-4 words, lowercase, hyphenated, e.g. billing-support)")
    p_init.add_argument("--dest", metavar="PATH", help="Parent directory for the brain folder (default: brains/)")
    p_init.add_argument("--force", action="store_true", help="Overwrite an existing brain folder")

    p_list = sub.add_parser("list", help="List brains and their readiness status")
    p_list.add_argument("--dest", metavar="PATH", help="Directory to scan (default: brains/)")

    p_validate = sub.add_parser("validate", help="Run structural checks on a brain folder")
    p_validate.add_argument("name", help="Brain name (e.g. billing-support) or path to brain folder")
    p_validate.add_argument("--dest", metavar="PATH", help="Base directory containing the brain (default: brains/)")

    args = parser.parse_args()

    if args.command == "init":
        sys.exit(init.run(args))
    elif args.command == "list":
        sys.exit(list_brains.run(args))
    elif args.command == "validate":
        sys.exit(validate.run(args))
