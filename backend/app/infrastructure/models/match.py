import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base
from app.infrastructure.models.base import TenantMixin, TimestampMixin


class Referee(Base, TimestampMixin, TenantMixin):
    __tablename__ = "referees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    license_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    category: Mapped[str] = mapped_column(String(40), default="REGIONAL")
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    association: Mapped[str] = mapped_column(String(120), default="Colegio de Árbitros Franz Tamayo")
    role_primary: Mapped[str] = mapped_column(String(40), default="PRINCIPAL")
    matches_count: Mapped[int] = mapped_column(Integer, default=0)
    yellow_cards_count: Mapped[int] = mapped_column(Integer, default=0)
    red_cards_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(30), default="ACTIVE")

    assignments = relationship("RefereeAssignment", back_populates="referee")

class Match(Base, TimestampMixin, TenantMixin):
    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    matchday_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matchdays.id", ondelete="CASCADE"), index=True, nullable=False
    )
    home_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    away_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    venue_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("venues.id", ondelete="SET NULL"), nullable=True
    )

    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    home_score: Mapped[int | None] = mapped_column(Integer, default=None)
    away_score: Mapped[int | None] = mapped_column(Integer, default=None)
    status: Mapped[str] = mapped_column(String(30), default="SCHEDULED", index=True)
    current_minute: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    referee_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    correction_notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_referee_signed: Mapped[bool] = mapped_column(default=False)
    referee_signature_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    referee_signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    tournament = relationship("Tournament", back_populates="matches")
    matchday = relationship("Matchday", back_populates="matches")
    venue = relationship("Venue", back_populates="matches")
    home_team = relationship("Team", foreign_keys=[home_team_id])
    away_team = relationship("Team", foreign_keys=[away_team_id])
    events = relationship("MatchEvent", back_populates="match", cascade="all, delete-orphan", order_by="MatchEvent.minute")
    referee_assignments = relationship("RefereeAssignment", back_populates="match", cascade="all, delete-orphan")

class MatchEvent(Base, TimestampMixin, TenantMixin):
    __tablename__ = "match_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), index=True, nullable=False
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=False
    )
    primary_player_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )
    secondary_player_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id", ondelete="SET NULL"), nullable=True
    )

    event_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False) # GOAL, YELLOW_CARD, RED_CARD, etc.
    minute: Mapped[int] = mapped_column(Integer, nullable=False)
    extra_minute: Mapped[int] = mapped_column(Integer, default=0)
    event_metadata: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)

    # Relationships
    match = relationship("Match", back_populates="events")
    team = relationship("Team")
    primary_player = relationship("Player", foreign_keys=[primary_player_id])
    secondary_player = relationship("Player", foreign_keys=[secondary_player_id])

class RefereeAssignment(Base, TimestampMixin, TenantMixin):
    __tablename__ = "referee_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    match_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matches.id", ondelete="CASCADE"), index=True, nullable=False
    )
    referee_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("referees.id", ondelete="CASCADE"), index=True, nullable=False
    )
    role: Mapped[str] = mapped_column(String(40), default="MAIN") # MAIN, ASSISTANT_1, ASSISTANT_2, FOURTH

    match = relationship("Match", back_populates="referee_assignments")
    referee = relationship("Referee", back_populates="assignments")
