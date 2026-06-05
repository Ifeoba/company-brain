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
| **Builder** | CLI to scaffold and interview-fill new brains | `builder/` |
| **Runtime** | Engine to load a brain folder and execute it against real work | `company_brain/runtime/` *(deferred — stub only)* |

The spec and examples are independent of the runtime. You can clone this repo, copy the templates, fill them in by hand, and have a real brain — with or without the runtime running.

---

## Web app (Docker)

The web app runs the full runtime — brain interviews, runs, escalations, audit log, and the maintainer service — as a Docker Compose stack.

### 1. Copy and fill in the environment file

```bash
cp web/.env.example web/.env
```

Open `web/.env` and fill in every `REPLACE_ME` value:

**`SESSION_SECRET`** — random 32-byte hex string used to sign session cookies:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**`FERNET_KEY`** — symmetric encryption key used to store API keys at rest:
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Paste each output directly into `web/.env`. Do not leave `REPLACE_ME` — the app will fail to start with a clear error if either key is missing.

### 2. Create a GitHub OAuth app

Go to <https://github.com/settings/applications/new> and create a new OAuth app with:

- **Homepage URL**: `http://localhost:5173`
- **Authorization callback URL**: `http://localhost:8000/api/auth/github/callback`

Copy the **Client ID** and generate a **Client Secret**, then paste them into `web/.env`:

```
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### 3. Start the stack

```bash
docker-compose up --build
```

This starts Postgres, Redis, the FastAPI backend (port 8000), and the Celery worker and beat scheduler.

### 4. Run database migrations

In a second terminal, once the `api` container is healthy:

```bash
docker-compose exec api alembic upgrade head
```

This creates all tables. Confirm with:

```bash
docker-compose exec db psql -U cb -d companybrain -c "\dt"
```

You should see 25+ tables.

### 5. Start the frontend (dev)

```bash
cd web/frontend
npm install
npm run dev
```

Open <http://localhost:5173> and sign in with GitHub.

### Resetting the database

```bash
docker-compose down -v   # removes the pgdata volume
docker-compose up --build
docker-compose exec api alembic upgrade head
```

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/Ifeoba/company-brain.git
cd company-brain
python3 -m venv venv && source venv/bin/activate
pip install --upgrade pip
pip install -e .
```

### 2. Scaffold a new brain

```bash
companybrain init billing-support
# ✓ Created brains/billing-support-brain/
#   Next: open brains/billing-support-brain/01-service-definition.md and fill it in.
#   Then: companybrain validate billing-support
```

### 3. Fill in the brain with Claude

`companybrain interview` walks you through the six steps with questions and uses Claude to generate each file from your answers. It's the fastest path from empty scaffold to complete brain.

> **Requires `ANTHROPIC_API_KEY`** — set it before running:
> ```bash
> export ANTHROPIC_API_KEY=sk-ant-...
> ```
> Get a key at <https://console.anthropic.com/>. The command exits with instructions if the variable is missing.

```bash
companybrain interview billing-support
# Step 1: Service Definition
# What does this service do? ...
```

You can also fill in the files by hand — open each one in order (01 through 06) and follow the prompts inside.

### 4. Check your progress

```bash
companybrain list
# NAME                           STATUS          FILES    PLACEHOLDERS
# billing-support                in formation    9/9      12
```

### 5. Validate structure

```bash
companybrain validate billing-support
# brains/billing-support-brain/
#   ✓ 01-service-definition.md   present
#   ✗ 01-service-definition.md   contains "REPLACE WITH" (3 occurrences)
#   ...
#   Status: not ready (3 issues)
```

Exit code 0 when ready, 1 when issues remain — plug into CI.

### 6. Validate content (in Claude)

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

**[Owomi transaction categorization brain →](examples/owomi-tx-categorization-brain/)** — the canonical reference example. Covers Owomi's CategoryEngine gap cases, Nigerian bank feed patterns (NIP transfers, Remita, payroll), 13 eval cases including 3 hard cases, and 6 defined skills.

---

## Builder

The builder CLI scaffolds new brains and walks users through the six-step build process with interview-style questions.

```bash
companybrain init <service-name>    # creates a brain folder from templates
companybrain interview <name>       # guided build — steps 1–6 with question prompts
companybrain validate <name>        # runs the readiness check
companybrain list                   # show all brains and their status
```

`companybrain interview` requires an Anthropic API key (`ANTHROPIC_API_KEY`). The command will exit with setup instructions if it is not set.

---

## Runtime

The runtime will load a brain folder and execute it against real work — dispatching skills, enforcing guardrails, routing escalations to humans, and logging traces.

Current state: deferred. Stub scaffolding exists in `company_brain/runtime/` (engine, executor, runner, logger, workflow state). None of it runs a brain yet. The builder and spec are the active work; the runtime picks up once the brain format is stable.

---

## Repository layout

```
company-brain/
├── spec/                     Brain Spec — the format definition
│   ├── BRAIN_SPEC.md
│   ├── schemas/              JSON schemas for structured files
│   └── templates/            Empty brain files with prompts inside
├── examples/                 Fully-populated example brains
├── builder/                  Scaffolder + interview CLI (shipped)
├── company_brain/
│   ├── brains/               Brain folders built with the CLI
│   ├── runtime/              Runtime engine (deferred — stub only)
│   └── skills/               Skill spec files used by the builder
└── docs/                     Architecture and onboarding notes
```

---

## What this is not

- Not a chatbot platform. Brains are not configured chatbots.
- Not a RAG system. Brains don't retrieve — they decide and execute.
- Not one-size-fits-all. Each brain is built for one specific service at one specific company.

---

## License

MIT
