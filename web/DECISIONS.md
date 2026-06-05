# Architecture Decisions

Decisions made during the Tier 1 build that weren't specified in the brief.

---

## Backend

**D1: httpx directly for GitHub OAuth (not Authlib)**
Brief specified Authlib, but Authlib's FastAPI integration requires an async HTTP client and significant boilerplate. httpx is already a transitive dependency (via anthropic SDK). Raw OAuth exchange is 20 lines and more transparent to debug.

**D2: Synchronous SQLAlchemy (not async)**
SQLite doesn't benefit meaningfully from async I/O. Sync SQLAlchemy with FastAPI's thread pool is simpler, easier to test, and avoids async session management complexity. Switch to async + Postgres when scaling beyond a single server.

**D3: Session stored client-side in signed cookie**
Used Starlette's `SessionMiddleware` (backed by itsdangerous). No server-side session store needed for Tier 1 — user ID + CSRF token fit easily in a cookie. Works fine for a single-server deployment.

**D4: CSRF via double-submit cookie pattern**
`GET /api/csrf-token` returns a token stored in the session. POST/PUT/DELETE require `X-CSRF-Token` header matching the session token. Simple, no state management, works with SPA architecture.

**D5: FastAPI BackgroundTasks for email**
`POST /ask-expert` enqueues email sending as a background task so the API response returns immediately. Email failures don't block the user. For production, replace with a task queue (Celery/RQ) if email reliability matters.

**D6: BrainFile content stored in DB, not disk**
The brief specified this. Brain folders are generated on demand at export time. Avoids filesystem sync issues and makes the whole app deployable as a single stateless container (minus the SQLite file).

**D7: Lazy BrainFile creation**
Files are created when first written (either via `PUT /files/:filename` or `POST /interview/generate`). Not pre-created on brain creation. Means `has_content: false` for unstarted files, which the readiness score handles correctly.

**D8: Default model is claude-haiku-4-5-20251001**
Same model the CLI uses. Fast and cheap for drafting interview files. Configurable via `CLAUDE_MODEL` env var if needed.

**D9: brain-readme.md excluded from scoring deduction**
It's optional per the spec. Including it in the 10-file scoring means a perfect score is achievable without it (score = 90 from 9 real files + 10 for no placeholders = 100). brain-readme.md just doesn't count as a deduction.

---

## Frontend

**D10: Tailwind dark class strategy**
Brief specified light default, dark mode support. Using Tailwind's `dark:` class strategy with `darkMode: "class"`. Toggle stored in localStorage. Not yet wired to a UI toggle button — add to Settings page in a follow-up.

**D11: No markdown rendering in file preview**
Brief specified this explicitly. File content is shown as monospaced plaintext in a `<pre>` tag. Edit mode is a plain `<textarea>`. No CodeMirror, no Monaco.

**D12: Autosave is debounced at 800ms**
Answers are auto-saved 800ms after the user stops typing. This keeps the "Saved Xs ago" indicator accurate without hammering the API on every keystroke.

**D13: Expert link uses port 5173 in dev**
The backend runs on 8000, frontend on 5173. In dev, expert links point to localhost:5173 (the frontend) since the frontend proxies /api to 8000. In production, both run on the same origin so this logic is irrelevant.

**D14: Toast system is inline, no library**
Brief said no UI libraries. Toasts are a simple state string + timeout in BrainAuthor. Not worth extracting to a context for Tier 1.

---

## Open for Tier 2

- Streaming Claude responses (show file content as it's generated)
- Dark mode toggle in UI (the CSS works; just need a button)
- Eval running against an agent
- Multi-user real-time collaboration
- Public brain library
- Resend webhook for delivery confirmation
