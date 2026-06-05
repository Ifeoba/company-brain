# Tier 3 Runtime Layer

The runtime layer adds live execution on top of the authoring UI. It introduces run scheduling, trigger ingestion, tool calls with human-in-the-loop approval, escalation queues, a tamper-evident audit log, and an automated maintainer service.

## Architecture Overview

```
Browser / API clients
        │
        ▼
   FastAPI (HTTP)          — serves REST endpoints, OAuth, webhooks, WebSocket run feed
        │
        ├─► Celery Worker  — executes runs asynchronously (queue: runs)
        │       └─► Tool executor (safe / confirm / escalate)
        │
        ├─► Celery Beat    — fires scheduled triggers, runs daily maintainer job
        │
        └─► Redis          — message broker + beat schedule storage
                └─► SQLite / Postgres  — runs, audit log, escalations, vault
```

The authoring UI (Tier 1 / 2) writes brains and their configs to the database. The runtime layer reads those records, executes them against live inputs, and writes results back — without coupling the two concerns at the code level.

## Running Locally

### 1. Install dependencies

```bash
pip install -e ".[runtime]"
```

### 2. Start Redis

```bash
docker run -p 6379:6379 redis:7-alpine
```

### 3. Start FastAPI

```bash
uvicorn backend.app:app --reload
```

### 4. Start Celery worker

```bash
celery -A backend.celery_app worker --loglevel=info -Q runs,maintainer
```

### 5. Start beat scheduler

```bash
celery -A backend.celery_app beat --loglevel=info
```

All five processes can run in separate terminal tabs. The API is available at `http://localhost:8000`.

## Environment Variables

| Variable | Description | Default / Required |
|---|---|---|
| `DATABASE_URL` | SQLite or Postgres connection URL | `sqlite:///./brain.db` |
| `REDIS_URL` | Celery broker and result backend | `redis://localhost:6379/0` |
| `FERNET_KEY` | Base64 AES key for Vault encryption | **required** |
| `SESSION_SECRET` | Key used to sign session cookies | **required** |
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | **required** |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret | **required** |
| `RESEND_API_KEY` | API key for the `send_email` tool | optional |
| `RESEND_FROM_EMAIL` | Sender address for outbound email | optional |
| `INBOUND_EMAIL_DOMAIN` | Domain for inbound email triggers | `inbound.companybrain.com` |
| `RUN_DAILY_CAP` | Maximum runs per user per day | `50` |

Copy `.env.example` to `.env` and fill in the required values before starting any process.

## Vault (Credentials)

The Vault stores per-workspace secrets (API keys, tokens, passwords) encrypted at rest using Fernet symmetric encryption. Each secret is encrypted with `FERNET_KEY` before being written to the database; the plaintext never leaves the application process.

### Generate a Fernet key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Paste the output as `FERNET_KEY` in your `.env`. Rotating the key requires re-encrypting all vault entries — use the `python -m backend.vault rotate` management command.

Vault secrets are referenced in brain configs as `{{ vault.MY_SECRET }}`. The executor resolves these at run time and redacts them from the audit log.

## Tool Call Risk Levels

Each tool declares a risk level. The executor enforces the following policy at run time:

| Level | Policy | UI surface |
|---|---|---|
| `safe` | Executes automatically, no pause | Run timeline (read-only) |
| `confirm` | Pauses the run; a human must approve or reject before execution continues | Run approval panel |
| `escalate` | Pauses the run; creates a workspace-visible escalation ticket that any maintainer can resolve | Escalation queue |

A run stays in `paused` state until the pending approval or escalation is resolved. Unresolved escalations older than 24 hours are surfaced in the maintainer service digest.

## Triggers

### Webhook

Send a `POST` request to `/api/triggers/webhook/{trigger_id}` with a JSON body. Requests must include an `X-Hub-Signature-256` header signed with the trigger's secret using HMAC-SHA256 (same convention as GitHub webhooks).

```bash
SECRET="your-trigger-secret"
PAYLOAD='{"event":"deal.closed","amount":15000}'
SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')
curl -X POST http://localhost:8000/api/triggers/webhook/{trigger_id} \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD"
```

### Email

Configure your Resend or Postmark inbound route to forward mail addressed to `*@{INBOUND_EMAIL_DOMAIN}` to `/api/triggers/email`. Each brain trigger gets a unique address like `brain-{trigger_id}@inbound.companybrain.com`.

### Schedule

Cron-based triggers are stored in the Celery beat schedule (Redis-backed). Create or update them through the trigger editor in the UI or via `POST /api/triggers/schedule`. Standard cron syntax is supported (`0 9 * * 1` = every Monday at 09:00 UTC).

### Rate limit

All trigger types share a rate limit of **10 runs per minute per trigger**. Requests exceeding this limit receive `HTTP 429` and are not queued.

## Maintainer Service

The maintainer runs daily as a Celery beat task on the `maintainer` queue. It scans completed runs for the following patterns and writes improvement suggestions to the brain's suggestion feed (visible in the brain editor):

| Pattern | Signal | Suggested action |
|---|---|---|
| Recurring escalations | Same tool or decision point escalates repeatedly | Promote tool to `confirm` or adjust decision logic |
| Repeated corrections | Human approvers consistently override a tool result | Retrain or reconfigure the tool |
| Drifting accuracy | Outcome ratings trending down over a rolling 7-day window | Flag for review; link to relevant runs |
| Quiet brains | No runs in 14 days | Prompt the owner to archive or reschedule |

Suggestions include links to the triggering run IDs so maintainers can inspect the evidence before acting.

## Testing a Brain Locally

### 1. Create a webhook trigger

In the UI, open a brain, go to **Triggers → Add → Webhook**, and copy the trigger ID and secret.

### 2. Fire a test run

```bash
TRIGGER_ID="tr_abc123"
SECRET="your-trigger-secret"
PAYLOAD='{
  "case": {
    "id": "case-001",
    "type": "support_ticket",
    "priority": "high",
    "subject": "Cannot access dashboard",
    "body": "I get a 403 error every time I try to open the analytics page.",
    "customer_tier": "enterprise"
  }
}'

SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')

curl -s -X POST "http://localhost:8000/api/triggers/webhook/${TRIGGER_ID}" \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: $SIG" \
  -d "$PAYLOAD"
```

A successful response returns `{"run_id": "run_xyz789", "status": "queued"}`. Open `http://localhost:8000` and navigate to **Runs** to watch execution in real time.

### 3. Audit log

Every run writes a append-only audit trail to the `audit_log` table. Inspect it directly:

```bash
sqlite3 brain.db "SELECT timestamp, event, actor FROM audit_log WHERE run_id='run_xyz789' ORDER BY timestamp;"
```
