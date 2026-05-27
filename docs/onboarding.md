# Developer Onboarding

## Prerequisites

- Python 3.9+
- An Anthropic API key (for `companybrain interview` only — not needed for init/list/validate)

---

## Setup

```bash
git clone https://github.com/Ifeoba/company-brain.git
cd company-brain
python3 -m venv venv && source venv/bin/activate
pip install -e .
```

The `-e` flag installs in editable mode so changes to `builder/` take effect immediately.

---

## Run the tests

```bash
pytest
```

All tests live in `builder/tests/`. The suite mocks the Anthropic client — no API key needed to run tests.

---

## Try the CLI

```bash
companybrain init my-test-brain
companybrain list
companybrain validate my-test-brain
```

For the interview (requires `ANTHROPIC_API_KEY`):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
companybrain interview my-test-brain
```

---

## Project layout

```
builder/
├── cli.py                  Argument parsing
├── scaffolder.py           Template resolution and file list
├── commands/               One module per CLI subcommand
└── interview/              Interview runner and step definitions

spec/
├── BRAIN_SPEC.md           Authoritative format definition
├── templates/              Source files copied by `companybrain init`
└── schemas/                JSON schemas for structured files

examples/                   Fully-populated example brains
```

See `docs/architecture.md` for how the pieces fit together.

---

## Making changes

- **New CLI command**: add a module to `builder/commands/`, wire it in `builder/cli.py`.
- **New interview step**: add a `Step` to `builder/interview/steps.py`, add the template file to `spec/templates/`, add the filename to `REQUIRED_FILES` in `builder/scaffolder.py`.
- **New template file**: add to `spec/templates/`. The scaffolder copies the entire directory, so it will be included automatically.

Run `pytest` before pushing. The test suite checks step count, question count, file presence, and the full interview runner loop.
