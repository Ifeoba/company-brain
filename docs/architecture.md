# Architecture

## Overview

Company Brain has two independent layers: the **builder** (ships now) and the **runtime** (deferred).

The builder produces brain folders. The runtime will consume them. They share only the brain folder format defined in `spec/BRAIN_SPEC.md`.

---

## Builder

```
builder/
├── cli.py                  Argument parsing — entry point for all commands
├── scaffolder.py           Templates path resolution and REQUIRED_FILES list
├── commands/
│   ├── init.py             Copies spec/templates/ into a new brain folder
│   ├── list_brains.py      Scans brains/ and reports placeholder counts
│   └── validate.py         Structural checks: file presence, placeholder count, JSON validity
└── interview/
    ├── steps.py            Six Step objects (number, questions list, files list)
    └── runner.py           InterviewRunner — drives the question loop and calls Claude
```

### Interview flow

1. `InterviewRunner.run()` iterates the six steps in order.
2. For each step, `_is_done()` checks whether all target files exist and contain no `REPLACE WITH` markers. If done, the step is skipped.
3. Otherwise, the runner asks each question in `step.questions` and collects answers.
4. `_generate_and_confirm()` calls `anthropic.messages.create` with a system prompt (loaded from the template file) and the answers, then prints the generated content and prompts `[y/n/edit]`.
   - `y` — writes the file
   - `n` — skips the file (leaves placeholder in place)
   - `edit` — writes the file (user edits externally afterward)
5. After all files in a step are accepted, `_mark_progress()` checks off that step in `progress.md`.

### Adding a step

1. Add a `Step` object to `builder/interview/steps.py`.
2. Add the new files to `REQUIRED_FILES` in `builder/scaffolder.py`.
3. Add template files to `spec/templates/`.
4. Tests in `builder/tests/test_interview.py` will catch missing questions or files.

---

## Brain folder format

Defined in full in `spec/BRAIN_SPEC.md`. Key invariant: every file must contain no `REPLACE WITH` markers for a brain to pass `companybrain validate`.

`03-evals.json` is the only structured file — its schema is in `spec/schemas/evals-schema.json`.

---

## Runtime (deferred)

Stub scaffolding lives in `company_brain/runtime/`. The design intent:

- `engine.py` — registers and runs workflows
- `executor.py` — executes a single skill against input
- `runner.py` — top-level loop: load brain → register skills → listen for events
- `logger.py` — structured trace logging per run

None of this is connected to real brain files yet. Runtime development begins once the brain format is stable through real-world use.
