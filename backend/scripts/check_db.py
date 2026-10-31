import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.infrastructure.database import AsyncSessionLocal
from sqlalchemy import select
from app.infrastructure.models.organization import Organization
from app.infrastructure.models.tournament import Tournament
from app.infrastructure.models.team import Team
from app.infrastructure.models.match import Match

async def check():
    async with AsyncSessionLocal() as session:
        orgs = (await session.execute(select(Organization))).scalars().all()
        print("Orgs:", [(str(o.id), o.name, o.slug) for o in orgs])
        ts = (await session.execute(select(Tournament))).scalars().all()
        print("Tournaments:", [(str(t.id), t.name, t.slug) for t in ts])
        teams = (await session.execute(select(Team))).scalars().all()
        print("Teams:", [(str(m.id), m.name) for m in teams])
        matches = (await session.execute(select(Match))).scalars().all()
        print("Matches count:", len(matches))

if __name__ == '__main__':
    asyncio.run(check())
