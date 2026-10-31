import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base
from app.infrastructure.models.base import TenantMixin, TimestampMixin


class Venue(Base, TimestampMixin, TenantMixin):
    __tablename__ = "venues"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    city: Mapped[str] = mapped_column(String(80), default="Apolo")
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    surface_type: Mapped[str] = mapped_column(String(40), default="NATURAL_GRASS")
    has_lighting: Mapped[bool] = mapped_column(Boolean, default=False)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)

    matches = relationship("Match", back_populates="venue")

class Season(Base, TimestampMixin, TenantMixin):
    __tablename__ = "seasons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(80), nullable=False) # e.g. "Temporada 2026"
    year: Mapped[int] = mapped_column(Integer, default=2026)
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)

    tournaments = relationship("Tournament", back_populates="season", cascade="all, delete-orphan")

class Tournament(Base, TimestampMixin, TenantMixin):
    __tablename__ = "tournaments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("seasons.id", ondelete="CASCADE"), index=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    sport_format: Mapped[str] = mapped_column(String(40), default="LEAGUE_ROUND_ROBIN")
    match_duration: Mapped[int] = mapped_column(Integer, default=90)
    points_for_win: Mapped[int] = mapped_column(Integer, default=3)
    points_for_draw: Mapped[int] = mapped_column(Integer, default=1)
    points_for_loss: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")

    # Relationships
    organization = relationship("Organization", back_populates="tournaments")
    season = relationship("Season", back_populates="tournaments")
    matchdays = relationship("Matchday", back_populates="tournament", cascade="all, delete-orphan", order_by="Matchday.number")
    matches = relationship("Match", back_populates="tournament", cascade="all, delete-orphan")
    standings = relationship("Standing", back_populates="tournament", cascade="all, delete-orphan")

class Matchday(Base, TimestampMixin, TenantMixin):
    __tablename__ = "matchdays"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(60), nullable=False) # e.g. "Jornada 1", "Cuartos de Final"
    round_type: Mapped[str] = mapped_column(String(30), default="REGULAR")

    tournament = relationship("Tournament", back_populates="matchdays")
    matches = relationship("Match", back_populates="matchday", cascade="all, delete-orphan")
