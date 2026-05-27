# Company Brain

A platform for building, running, and maintaining organizational intelligence — the structured operating map that lets an AI agent do real work for a specific company, not just chat about it.

---

## What is a brain?

A **brain** is a folder of files for one specific service at one specific company. It captures how the work actually happens — the steps, the decisions, the exceptions, the rules the veteran knows but never wrote down. An AI agent reads this folder to do the work.

A brain is not a knowledge base, a chatbot over documents, or a general AI assistant configuration. It's the encoded knowledge of how one specific job gets done.

```
billing-support-brain/
├── 01-service-definition.md   what this brain is for
├── 02-how-work-happens.md     how the work actually happens
├── 02-unwritten-rules.md      what lives in people's heads, not docs
├── 03-decision-rules.md       how decisions get made, including hard cases
├── 03-evals.json              test cases with known correct outcomes
├── 04-skills.md               what the agent does, with input/output contracts
├── 05-guardrails.md           what the agent decides alone, escalates, never does
├── 06-proof-log.md            real work the agent did, with human sign-off
└── brain-readme.md            one-page index of this brain
```

---

## The four pieces

| Piece | What it is | Where |
|---|---|---|
| **Spec** | Format definition — what a brain folder must contain, file by file | `spec/` |
| **Examples** | Fully-populated brains showing what done looks like | `examples/` |
| **Builder** | CLI to scaffold and interview-fill new brains | `builder/` *(planned)* |
| **Runtime** | Engine to load a brain folder and execute it against real work | `runtime/` *(in progress)* |

The spec and examples are independent of the runtime. You can clone this repo, copy the templates, fill them in by hand, and have a real brain — with or without the runtime running.

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/Ifeoba/company-brain.git
cd company-brain
python3 -m venv venv && source venv/bin/activate
pip install -e .
```

### 2. Scaffold a new brain

```bash
companybrain init billing-support
# ✓ Created brains/billing-support-brain/
#   Next: open brains/billing-support-brain/01-service-definition.md and fill it in.
#   Then: companybrain validate billing-support
```

Open each file and fill it in. The templates have instructions inside. Work through them in order — 01 through 06.

### 3. Check your progress

```bash
companybrain list
# NAME                           STATUS          FILES    PLACEHOLDERS
# billing-support                in formation    9/9      12
```

### 4. Validate structure

```bash
companybrain validate billing-support
# brains/billing-support-brain/
#   ✓ 01-service-definition.md   present
#   ✗ 01-service-definition.md   contains "REPLACE WITH" (3 occurrences)
#   ...
#   Status: not ready (3 issues)
```

Exit code 0 when ready, 1 when issues remain — plug into CI.

### 5. Validate content (in Claude)

Load the `company-brain-validator` skill and run it against your brain folder for a full six-dimension readiness report: service definition, knowledge layer, judgment layer, skills, guardrails, and proof.

---

## Spec

The Brain Spec defines what a brain folder must contain — file by file, field by field, with completeness criteria and failure modes for each.

**[Read the Brain Spec →](spec/BRAIN_SPEC.md)**

The spec also includes:
- JSON schemas for structured files (`spec/schemas/`)
- Template files with fill-in prompts (`spec/templates/`)

---

## Examples

Fully-populated example brains live in `examples/`. Each example shows what a complete, real brain looks like — every file filled in, evals with hard cases, proof log with human sign-off.

**[Browse examples →](examples/)**

**[Owomi transaction categorization brain →](examples/owomi-tx-categorization-brain/)** — the canonical reference example. Covers Owomi's CategoryEngine gap cases, Nigerian bank feed patterns (NIP transfers, Remita, payroll), 13 eval cases including 3 hard cases, and 6 defined skills. Proof log needs real entries; all other files are complete.

The existing `company_brain/brains/sample-support-brain/` is a stub — every file is one or two generic lines. It does not represent a real brain.

---

## Builder

The builder CLI scaffolds new brains and walks users through the six-step build process with interview-style questions.

**Planned commands:**
```bash
companybrain init <service-name>    # creates a brain folder from templates
companybrain interview <name>       # guided build — steps 1–6 with question prompts
companybrain validate <name>        # runs the readiness check
```

The builder is not yet implemented. See `builder/` for the roadmap.

---

## Runtime

The runtime loads a brain folder and executes it against real work — dispatching skills, enforcing guardrails, routing escalations to humans, and logging traces.

The runtime is in active development. Current state: stub scaffolding exists in `company_brain/runtime/`. It does not yet load or execute brain files.

```bash
python run.py   # currently prints placeholder output only
```

---

## Repository layout

```
company-brain/
├── spec/                     Brain Spec — the format definition
│   ├── BRAIN_SPEC.md
│   ├── schemas/              JSON schemas for structured files
│   └── templates/            Empty brain files with prompts inside
├── examples/                 Fully-populated example brains (planned)
├── builder/                  Scaffolder + interview CLI (planned)
├── company_brain/
│   ├── brains/               Brain folders (sample-support-brain is a stub)
│   ├── runtime/              Runtime engine (in progress)
│   └── skills/               Skill spec files used by the builder
└── docs/                     Additional documentation
```

---

## What this is not

- Not a chatbot platform. Brains are not configured chatbots.
- Not a RAG system. Brains don't retrieve — they decide and execute.
- Not one-size-fits-all. Each brain is built for one specific service at one specific company.

---

## License

MIT
