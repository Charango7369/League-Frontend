import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.infrastructure.models.match import Match, Referee, RefereeAssignment
from app.infrastructure.repositories.base import BaseRepository


class RefereeRepository(BaseRepository[Referee]):
    def __init__(self, session: AsyncSession):
        super().__init__(Referee, session)

    async def list_all_referees(self, organization_id: uuid.UUID | None = None) -> list[Referee]:
        query = select(Referee).where(Referee.is_deleted.is_(False)).order_by(Referee.last_name, Referee.first_name)
        if organization_id:
            query = query.where(Referee.organization_id == organization_id)
        res = await self.session.execute(query)
        return list(res.scalars().all())

    async def get_with_assignments(self, referee_id: uuid.UUID) -> Referee | None:
        query = (
            select(Referee)
            .where(Referee.id == referee_id)
            .options(
                selectinload(Referee.assignments).selectinload(RefereeAssignment.match)
            )
        )
        res = await self.session.execute(query)
        return res.scalar_one_or_none()

    async def get_match_assignments(self, match_id: uuid.UUID) -> list[RefereeAssignment]:
        query = (
            select(RefereeAssignment)
            .where(RefereeAssignment.match_id == match_id)
            .options(selectinload(RefereeAssignment.referee))
        )
        res = await self.session.execute(query)
        return list(res.scalars().all())

    async def set_match_assignments(
        self,
        match_id: uuid.UUID,
        assignments_data: list[dict]
    ) -> list[RefereeAssignment]:
        # Delete existing assignments for this match
        await self.session.execute(
            delete(RefereeAssignment).where(RefereeAssignment.match_id == match_id)
        )
        created = []
        for item in assignments_data:
            assignment = RefereeAssignment(
                match_id=match_id,
                referee_id=item["referee_id"],
                role=item["role"]
            )
            self.session.add(assignment)
            created.append(assignment)

        await self.session.flush()
        return await self.get_match_assignments(match_id)

    async def sign_match_sheet(
        self,
        match_id: uuid.UUID,
        notes: str | None,
        signature_hash: str,
        signed_at: datetime
    ) -> Match | None:
        query = select(Match).where(Match.id == match_id)
        res = await self.session.execute(query)
        match = res.scalar_one_or_none()
        if not match:
            return None

        match.referee_notes = notes
        match.is_referee_signed = True
        match.referee_signature_hash = signature_hash
        match.referee_signed_at = signed_at
        await self.session.commit()
        await self.session.refresh(match)
        return match
