
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models.organization import Organization, Subscription
from app.infrastructure.repositories.base import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    def __init__(self, session: AsyncSession):
        super().__init__(Organization, session)

    async def get_by_slug(self, slug: str) -> Organization | None:
        query = select(Organization).where(Organization.slug == slug.lower().strip())
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def create_with_subscription(self, org: Organization, plan: str = "FREE") -> Organization:
        self.session.add(org)
        await self.session.flush()

        sub = Subscription(
            organization_id=org.id,
            plan=plan,
            status="ACTIVE",
            max_tournaments=2 if plan == "FREE" else 10,
            max_teams=16 if plan == "FREE" else 64,
            whatsapp_enabled=(plan != "FREE"),
            ai_reporter_enabled=(plan != "FREE")
        )
        self.session.add(sub)
        await self.session.commit()
        await self.session.refresh(org)
        return org
