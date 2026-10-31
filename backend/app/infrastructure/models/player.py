import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base
from app.infrastructure.encryption import EncryptedString, EncryptedText
from app.infrastructure.models.base import TenantMixin, TimestampMixin


class Player(Base, TimestampMixin, TenantMixin):
    __tablename__ = "players"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=False
    )
    first_name: Mapped[str] = mapped_column(String(80), nullable=False)
    last_name: Mapped[str] = mapped_column(String(80), nullable=False)
    jersey_number: Mapped[int] = mapped_column(Integer, default=10)
    position: Mapped[str] = mapped_column(String(30), default="FORWARD")
    document_id: Mapped[str | None] = mapped_column(String(40), nullable=True) # CI boliviano o DNI
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    is_eligible: Mapped[bool] = mapped_column(Boolean, default=True)

    # Sensitive fields protected by FLS and Encryption at Rest
    medical_notes: Mapped[str | None] = mapped_column(EncryptedText, nullable=True)
    guardian_phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(EncryptedString(255), nullable=True)

    # Relationships
    team = relationship("Team", back_populates="players")
    statistics = relationship("PlayerStatistic", back_populates="player", cascade="all, delete-orphan")

class PlayerStatistic(Base, TimestampMixin, TenantMixin):
    __tablename__ = "player_statistics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id", ondelete="CASCADE"), index=True, nullable=False
    )
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    matches_played: Mapped[int] = mapped_column(Integer, default=0)
    goals: Mapped[int] = mapped_column(Integer, default=0)
    assists: Mapped[int] = mapped_column(Integer, default=0)
    yellow_cards: Mapped[int] = mapped_column(Integer, default=0)
    red_cards: Mapped[int] = mapped_column(Integer, default=0)
    minutes_played: Mapped[int] = mapped_column(Integer, default=0)
    mvp_count: Mapped[int] = mapped_column(Integer, default=0)

    player = relationship("Player", back_populates="statistics")
