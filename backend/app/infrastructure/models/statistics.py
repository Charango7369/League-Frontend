import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.infrastructure.database import Base
from app.infrastructure.models.base import TenantMixin, TimestampMixin


class Standing(Base, TimestampMixin, TenantMixin):
    __tablename__ = "standings"
    __table_args__ = (
        UniqueConstraint("tournament_id", "team_id", name="uq_tournament_team_standing"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), index=True, nullable=False
    )
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"), index=True, nullable=False
    )

    played: Mapped[int] = mapped_column(Integer, default=0)
    won: Mapped[int] = mapped_column(Integer, default=0)
    drawn: Mapped[int] = mapped_column(Integer, default=0)
    lost: Mapped[int] = mapped_column(Integer, default=0)
    goals_for: Mapped[int] = mapped_column(Integer, default=0)
    goals_against: Mapped[int] = mapped_column(Integer, default=0)
    goal_difference: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=0, index=True)
    form: Mapped[str] = mapped_column(String(30), default="") # e.g. "W,D,W,L,W"
    position: Mapped[int] = mapped_column(Integer, default=1)

    tournament = relationship("Tournament", back_populates="standings")
    team = relationship("Team", back_populates="standings")
