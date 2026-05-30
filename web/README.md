# Company Brain — Web UI

The web interface for Company Brain. A FastAPI backend + React frontend that lets you create, interview-fill, and export brain folders through a guided UI with expert email delegation.

---

## Local development

### Prerequisites

- Python 3.11+
- Node.js 20+
- A GitHub OAuth app ([create one here](https://github.com/settings/applications/new))
- An Anthropic API key ([get one here](https://console.anthropic.com/))
- A Resend account for email ([optional in dev](https://resend.com))

### 1. Clone and install

```bash
git clone https://github.com/Ifeoba/company-brain.git
cd company-brain

# Install the builder CLI (required by the web backend)
python3 -m venv venv && source venv/bin/activate
pip install --upgrade pip
pip install -e .

# Install web backend deps
pip install -e web/
```

### 2. Configure environment

```bash
cp web/.env.example web/.env
```

Edit `web/.env` with your values:

```bash
# Generate SESSION_SECRET
python3 -c "import secrets; print(secrets.token_hex(32))"

# Generate FERNET_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

GitHub OAuth app settings:
- Homepage URL: `http://localhost:5173`
- Callback URL: `http://localhost:8000/api/auth/github/callback`

### 3. Start the backend

```bash
cd web
uvicorn backend.app:app --reload --port 8000
```

The API is at `http://localhost:8000/api/docs`.

### 4. Start the frontend

```bash
cd web/frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

---

## Running tests

```bash
# Builder tests (must pass — builder/ is not modified by the web)
pytest builder/

# Web backend tests
cd web
pytest
```

---

## Project layout

```
web/
├── backend/          FastAPI app
│   ├── app.py        App factory
│   ├── models.py     SQLAlchemy models
│   ├── routes/       API route handlers
│   ├── migrations/   Alembic migrations
│   └── tests/        Backend tests
├── frontend/         React + Vite + TypeScript + Tailwind
│   └── src/
│       ├── pages/    Login, BrainsList, BrainAuthor, ExpertAnswer, Settings
│       ├── components/
│       └── api/      TanStack Query hooks + fetch client
├── docker/           Dockerfile (multi-stage)
├── .env.example      Environment variable template
└── DECISIONS.md      Architecture decisions log
```

---

## Deployment

The app runs as a single container: FastAPI serves both the API and the built React app.

**Recommended: [Railway](https://railway.app)**

1. Push to GitHub
2. Create a new Railway project → Deploy from GitHub
3. Set environment variables in Railway dashboard (see `.env.example`)
4. Railway auto-detects the Dockerfile and builds

**Alternative: [Fly.io](https://fly.io)**

```bash
fly launch --dockerfile web/docker/Dockerfile
fly secrets set SESSION_SECRET=... FERNET_KEY=... GITHUB_CLIENT_ID=... ...
fly deploy
```

### Database

SQLite is stored at `DATABASE_URL` (default: `./data/company-brain.db`). For Railway/Fly, mount a persistent volume at `/app/web/data`. The database is created automatically on first startup.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | SQLite path (default: `sqlite:///./data/company-brain.db`) |
| `SESSION_SECRET` | Yes | 32-byte hex string for cookie signing |
| `FERNET_KEY` | Yes | Base64 Fernet key for API key encryption |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app client secret |
| `GITHUB_REDIRECT_URI` | Yes | OAuth callback URL |
| `RESEND_API_KEY` | No | Resend API key (email works without it in dev — logs to console) |
| `RESEND_FROM_EMAIL` | No | Sender address (default: `noreply@example.com`) |
| `FRONTEND_ORIGIN` | Yes | Frontend URL for CORS (default: `http://localhost:5173`) |
