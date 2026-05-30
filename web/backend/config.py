from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# Always resolve .env relative to this file (web/backend/ → web/)
_ENV_FILE = Path(__file__).parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./data/company-brain.db"
    session_secret: str = "dev-secret-change-in-production"
    fernet_key: str = ""

    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/auth/github/callback"

    resend_api_key: str = ""
    resend_from_email: str = "noreply@example.com"

    frontend_origin: str = "http://localhost:8000"

    claude_model: str = "claude-haiku-4-5-20251001"

    # Queue / async
    redis_url: str = "redis://localhost:6379/0"
    run_daily_cap: int = 50

    # Email triggers
    inbound_email_domain: str = "inbound.companybrain.com"


settings = Settings()
