import uuid

from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base
from app.infrastructure.models.base import TenantMixin, TimestampMixin


class Team(Base, TimestampMixin, TenantMixin):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_code: Mapped[str] = mapped_column(String(6), nullable=False)
    city: Mapped[str] = mapped_column(String(80), default="Apolo")
    stadium_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    coach_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    primary_color: Mapped[str] = mapped_column(String(20), default="#1a4fd6")
    secondary_color: Mapped[str] = mapped_column(String(20), default="#f0b429")
    founded_year: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="teams")
    players = relationship("Player", back_populates="team", cascade="all, delete-orphan")
    standings = relationship("Standing", back_populates="team", cascade="all, delete-orphan")
