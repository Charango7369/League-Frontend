import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.models.match import Match, MatchEvent
from app.infrastructure.repositories.base import BaseRepository


class MatchRepository(BaseRepository[Match]):
    def __init__(self, session: AsyncSession):
        super().__init__(Match, session)

    async def get_match_with_details(self, match_id: uuid.UUID) -> Match | None:
        query = (
            select(Match)
            .where(Match.id == match_id)
            .options(
                selectinload(Match.home_team),
                selectinload(Match.away_team),
                selectinload(Match.venue),
                selectinload(Match.events).selectinload(MatchEvent.primary_player),
                selectinload(Match.events).selectinload(MatchEvent.team),
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_by_tournament(
        self,
        tournament_id: uuid.UUID,
        matchday_id: uuid.UUID | None = None,
        status: str | None = None
    ) -> list[Match]:
        query = (
            select(Match)
            .where(Match.tournament_id == tournament_id)
            .options(
                selectinload(Match.home_team),
                selectinload(Match.away_team),
                selectinload(Match.venue),
            )
            .order_by(Match.scheduled_at)
        )
        if matchday_id:
            query = query.where(Match.matchday_id == matchday_id)
        if status:
            query = query.where(Match.status == status)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def add_event(self, event: MatchEvent) -> MatchEvent:
        self.session.add(event)
        await self.session.commit()
        await self.session.refresh(event)
        return event
