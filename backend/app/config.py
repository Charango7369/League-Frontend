from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Apolodigital League Enterprise SaaS"
    VERSION: str = "2.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # Database & Redis
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgrespassword@localhost:5435/apolodigital_league",
        description="Async PostgreSQL connection URI (Admin/Migration Owner)"
    )
    APP_DATABASE_URL: str = Field(
        default="postgresql+asyncpg://app_user:app_user_password_2026_secure@localhost:5435/apolodigital_league",
        description="Async PostgreSQL connection URI for application runtime with RLS enforced"
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URI for PubSub & Caching"
    )

    # JWT Authentication
    JWT_SECRET: str = Field(
        default="apolodigital-super-secret-key-bolivia-2026-production-grade",
        description="Secret key for JWT generation"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "apolodigital-league"
    JWT_AUDIENCE: str = "apolodigital-api"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for dev / token renewal
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Field-Level Security & Encryption at Rest (Fernet AES-128-CBC + HMAC-SHA256)
    FIELD_ENCRYPTION_KEY: str = Field(
        default="OUMEsyVR1aQuNbztuZyWtMHm91s-a6Z-An7bMb_5Ya4=",
        description="Primary url-safe Base64-encoded 32-byte key for symmetric column encryption"
    )
    FIELD_ENCRYPTION_PREVIOUS_KEYS: list[str] = Field(
        default_factory=list,
        description="Prior encryption keys to support zero-downtime key rotation via MultiFernet"
    )

    # Match Official Sheet & State Governance
    MATCH_GRACE_PERIOD_MINUTES: int = Field(
        default=120,
        description="Grace period in minutes after match finish during which referee can edit official match sheet"
    )

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "https://apolodigital.lat",
        "https://*.apolodigital.lat",
    ]

    # Meta Cloud API (WhatsApp)
    WHATSAPP_API_TOKEN: str = ""
    WHATSAPP_PHONE_NUMBER_ID: str = ""
    WHATSAPP_DEFAULT_PHONE: str = "59176509789"  # Default official Apolodigital contact

    # AI Sports Journalist
    GEMINI_API_KEY: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
