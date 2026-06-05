from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from .config import settings
from .db import init_db
from . import sse
from .routes import activity, analytics, audit, auth, brains, escalations, events, export, experts, insights, interview, maintainer, relationships, runs, settings as settings_routes, tools, triggers, updates, vault


def create_app() -> FastAPI:
    app = FastAPI(title="Company Brain", docs_url="/api/docs", redoc_url=None)

    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="cb_session",
        https_only=False,
        same_site="lax",
        max_age=86400 * 30,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth.router)
    app.include_router(brains.router)
    app.include_router(interview.router)
    app.include_router(experts.router)
    app.include_router(export.router)
    app.include_router(settings_routes.router)
    app.include_router(updates.router)
    app.include_router(relationships.router)
    app.include_router(runs.router)
    app.include_router(triggers.router)
    app.include_router(tools.router)
    app.include_router(vault.router)
    app.include_router(escalations.router)
    app.include_router(audit.router)
    app.include_router(events.router)
    app.include_router(maintainer.router)
    app.include_router(activity.router)
    app.include_router(analytics.router)
    app.include_router(insights.router)

    # Serve built frontend from /static if it exists
    static_dir = Path(__file__).parent.parent / "static"
    if static_dir.exists():
        app.mount("/assets", StaticFiles(directory=static_dir / "assets"), name="assets")

        @app.get("/{full_path:path}", include_in_schema=False)
        def spa_fallback(full_path: str, request: Request):
            if full_path.startswith("api/"):
                from fastapi import HTTPException
                raise HTTPException(status_code=404)
            file_path = static_dir / full_path
            if file_path.exists() and file_path.is_file():
                return FileResponse(file_path)
            return FileResponse(static_dir / "index.html")

    @app.on_event("startup")
    async def startup():
        import asyncio
        init_db()
        sse.set_loop(asyncio.get_event_loop())

    return app


app = create_app()
