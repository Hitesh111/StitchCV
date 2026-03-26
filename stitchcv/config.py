from __future__ import annotations
"""Configuration management for StitchCV."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Gemini API
    gemini_api_key: str = Field(..., description="Primary Google Gemini API key")
    gemini_api_key_fallback: str = Field(default="", description="Fallback Gemini API key")
    gemini_model: str = Field(default="gemini-2.5-flash", description="Gemini model to use")
    gemini_requests_per_minute: int = Field(default=15, description="Rate limit for Gemini API")

    # Fallback APIs
    groq_api_key: str = Field(default="", description="Groq API key")
    openrouter_api_key: str = Field(default="", description="OpenRouter API key")

    @property
    def active_gemini_api_key(self) -> str:
        """Return primary key; fall back to secondary if primary is empty."""
        return self.gemini_api_key or self.gemini_api_key_fallback

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./stitchcv.db",
        description="Database connection URL",
    )

    # Rate Limiting
    requests_per_minute: int = Field(default=10, description="General rate limit")

    # Browser Settings
    headless: bool = Field(default=True, description="Run browser in headless mode")
    slow_mo: int = Field(default=100, description="Slow down browser actions (ms)")
    browser_timeout: int = Field(default=30000, description="Browser timeout (ms)")

    # Application Settings
    require_human_review: bool = Field(
        default=True, description="Require human review before submission"
    )
    frontend_base_url: str = Field(
        default="http://127.0.0.1:5173", description="Frontend base URL for auth redirects"
    )
    app_base_url: str = Field(
        default="http://127.0.0.1:8000", description="Backend base URL for OAuth callbacks"
    )
    google_client_id: str = Field(default="", description="Google OAuth client id")
    google_client_secret: str = Field(default="", description="Google OAuth client secret")
    linkedin_client_id: str = Field(default="", description="LinkedIn OAuth client id")
    linkedin_client_secret: str = Field(default="", description="LinkedIn OAuth client secret")
    razorpay_key_id: str = Field(default="", description="Razorpay API Key ID")
    razorpay_key_secret: str = Field(default="", description="Razorpay API Key Secret")
    default_work_authorization: str = Field(
        default="authorized", description="Default work authorization status"
    )
    default_requires_sponsorship: bool = Field(
        default=False, description="Default sponsorship requirement"
    )

    # Paths
    data_dir: Path = Field(default=Path("data"), description="Data directory")
    master_resume_path: Path = Field(
        default=Path("data/master_resume.json"), description="Master resume file"
    )
    profile_path: Path = Field(default=Path("data/profile.json"), description="User profile file")
    tailored_resumes_dir: Path = Field(
        default=Path("data/tailored_resumes"), description="Tailored resumes directory"
    )

    # Logging
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = Field(
        default="INFO", description="Logging level"
    )


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Convenience access
settings = get_settings()
