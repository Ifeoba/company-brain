from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./data/company-brain.db"
    session_secret: str = "dev-secret-change-in-production"
    fernet_key: str = ""

    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/auth/github/callback"

    resend_api_key: str = ""
    resend_from_email: str = "noreply@example.com"

    frontend_origin: str = "http://localhost:5173"

    claude_model: str = "claude-haiku-4-5-20251001"


settings = Settings()
