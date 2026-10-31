import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base
from app.infrastructure.models.base import TimestampMixin


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    custom_domain: Mapped[str | None] = mapped_column(String(150), unique=True, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(20), default="#1a4fd6")
    theme_branding: Mapped[dict[str, Any]] = mapped_column(JSONB, default=lambda: {
        "hero_title": "ApoloDigital League",
        "tagline": "Tecnología Deportiva desde la Bolivia Real 🇧🇴",
        "official_contact": "+591 765 09789"
    })
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    tournaments = relationship("Tournament", back_populates="organization", cascade="all, delete-orphan")
    teams = relationship("Team", back_populates="organization", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="organization", uselist=False, cascade="all, delete-orphan")

class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    plan: Mapped[str] = mapped_column(String(30), default="FREE") # FREE, PRO, ENTERPRISE
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")
    max_tournaments: Mapped[int] = mapped_column(default=2)
    max_teams: Mapped[int] = mapped_column(default=16)
    whatsapp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_reporter_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    organization = relationship("Organization", back_populates="subscription")
