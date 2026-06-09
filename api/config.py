from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # On Vercel Lambda, use /tmp for writable SQLite; elsewhere use cwd
    database_url: str = "sqlite:////tmp/football_analysis.db" if __import__("os").environ.get("VERCEL") else "sqlite:///./football_analysis.db"
    stub_user_tier: str = "free"
    geofence_blocked_countries: str = ""
    allowed_origins: str = "http://localhost:3000"
    time_decay_xi: float = 0.0018
    admin_secret: str = "dev-secret"

    @property
    def blocked_countries(self) -> list[str]:
        if not self.geofence_blocked_countries:
            return []
        return [c.strip().upper() for c in self.geofence_blocked_countries.split(",") if c.strip()]

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
