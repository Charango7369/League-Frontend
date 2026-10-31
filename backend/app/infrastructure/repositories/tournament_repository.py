import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models.player import Player
from app.infrastructure.models.team import Team
from app.infrastructure.models.tournament import Tournament
from app.infrastructure.repositories.base import BaseRepository


class TournamentRepository(BaseRepository[Tournament]):
    def __init__(self, session: AsyncSession):
        super().__init__(Tournament, session)

    async def list_by_organization(self, organization_id: uuid.UUID) -> list[Tournament]:
        query = select(Tournament).where(Tournament.organization_id == organization_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_by_slug(self, organization_id: uuid.UUID, slug: str) -> Tournament | None:
        query = select(Tournament).where(
            Tournament.organization_id == organization_id,
            Tournament.slug == slug
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_teams(self, organization_id: uuid.UUID) -> list[Team]:
        query = select(Team).where(Team.organization_id == organization_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_team(self, team_id: uuid.UUID) -> Team | None:
        query = select(Team).where(Team.id == team_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_players_by_team(self, team_id: uuid.UUID) -> list[Player]:
        query = select(Player).where(Player.team_id == team_id).order_by(Player.jersey_number)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_player(self, player_id: uuid.UUID) -> Player | None:
        query = select(Player).where(Player.id == player_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()
