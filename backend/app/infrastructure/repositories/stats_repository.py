import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.models.player import Player, PlayerStatistic
from app.infrastructure.models.statistics import Standing
from app.infrastructure.models.team import Team
from app.infrastructure.repositories.base import BaseRepository


class StatsRepository(BaseRepository[Standing]):
    def __init__(self, session: AsyncSession):
        super().__init__(Standing, session)

    async def get_standings_by_tournament(self, tournament_id: uuid.UUID) -> list[Standing]:
        query = (
            select(Standing)
            .where(Standing.tournament_id == tournament_id)
            .options(selectinload(Standing.team))
            .order_by(
                Standing.points.desc(),
                Standing.goal_difference.desc(),
                Standing.goals_for.desc(),
                Standing.won.desc()
            )
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_top_scorers(self, tournament_id: uuid.UUID, limit: int = 10):
        query = (
            select(PlayerStatistic, Player, Team)
            .join(Player, PlayerStatistic.player_id == Player.id)
            .join(Team, Player.team_id == Team.id)
            .where(PlayerStatistic.tournament_id == tournament_id, PlayerStatistic.goals > 0)
            .order_by(PlayerStatistic.goals.desc(), PlayerStatistic.assists.desc())
            .limit(limit)
        )
        result = await self.session.execute(query)
        return result.all()
