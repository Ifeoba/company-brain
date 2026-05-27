# Contributing

## Setup

```bash
git clone https://github.com/Ifeoba/company-brain.git
cd company-brain
python3 -m venv venv && source venv/bin/activate
pip install -e .
pytest   # confirm everything passes before you start
```

See `docs/onboarding.md` for a full walkthrough.

---

## Submitting an example brain

Example brains are the highest-value contribution. A good example brain shows a first-time user what "done" looks like in their own domain.

**What a complete example brain requires:**

```
my-service-brain/
├── 01-service-definition.md    what the service does, who it serves, what done looks like
├── 02-how-work-happens.md      the actual steps, with branching paths and edge cases
├── 02-unwritten-rules.md       the things a new hire gets wrong for the first three months
├── 03-decision-rules.md        how the agent decides, including the hard cases
├── 03-evals.json               at least 10 test cases — include 3+ hard/ambiguous ones
├── 04-skills.md                every skill the agent performs, with input/output contracts
├── 05-guardrails.md            what it decides alone, escalates, and never does
├── 06-proof-log.md             at least one real run with a named human sign-off
└── brain-readme.md             one-page index of the brain (optional but recommended)
```

No file may contain `REPLACE WITH` markers. Run `companybrain validate <name>` before opening a PR — it must exit 0.

**What makes a strong example brain:**

- Specific to a real service at a real (or realistic) company, not a generic hypothetical
- Evals with hard cases — the inputs where the right answer isn't obvious
- A proof log entry that shows a real mistake the agent made and what it taught you
- Decision rules that name the tiebreakers, not just the easy cases

**Where to put it:**

Place your brain folder under `examples/` at the repo root:

```bash
examples/
└── my-service-brain/
```

Update the Examples section in `README.md` with a one-line description of your brain.

**Review criteria:**

PRs for example brains are reviewed for completeness (all files present, no placeholders, evals with hard cases) and specificity (does it read like a real service, or a generic template?). Generic brains will be sent back for more detail.

---

## Adding a builder feature

- **New CLI command**: add a module to `builder/commands/`, wire it in `builder/cli.py`, add tests.
- **New interview step or question**: edit `builder/interview/steps.py`. Each step needs at least 3 questions.
- **New template file**: add to `spec/templates/` and add the filename to `REQUIRED_FILES` in `builder/scaffolder.py`.

Run `pytest` before pushing. The test suite enforces step count, question count, file presence, and the runner loop.

---

## Standards

- Type hints on all new functions
- Tests for new builder features — the test suite is the contract
- No comments that explain what the code does; only comments that explain why it does something non-obvious
- PRs should explain what changed, why, and how you tested it
