import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models.match import Match
from app.infrastructure.models.statistics import Standing
from app.infrastructure.models.team import Team
from app.infrastructure.redis_client import redis_service


class StatsEngine:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def recalculate_tournament_standings(self, tournament_id: uuid.UUID):
        """
        Idempotent recalculation of official FIFA tournament standings
        based on all recorded match scores.
        """
        # 1. Fetch all teams participating
        teams_q = select(Team).join(Standing, Standing.team_id == Team.id).where(Standing.tournament_id == tournament_id)
        teams_res = await self.session.execute(teams_q)
        teams = list(teams_res.scalars().all())

        if not teams:
            # Fallback: find teams from matches
            teams_q2 = select(Team).distinct().join(Match, (Match.home_team_id == Team.id) | (Match.away_team_id == Team.id)).where(Match.tournament_id == tournament_id)
            teams_res2 = await self.session.execute(teams_q2)
            teams = list(teams_res2.scalars().all())

        stats_map: dict[uuid.UUID, dict[str, Any]] = {
            t.id: {
                "team": t,
                "played": 0,
                "won": 0,
                "drawn": 0,
                "lost": 0,
                "goals_for": 0,
                "goals_against": 0,
                "goal_difference": 0,
                "points": 0,
                "form_list": []
            }
            for t in teams
        }

        # 2. Fetch matches with valid scores
        matches_q = (
            select(Match)
            .where(
                Match.tournament_id == tournament_id,
                Match.home_score.isnot(None),
                Match.away_score.isnot(None)
            )
            .order_by(Match.scheduled_at.asc())
        )
        matches_res = await self.session.execute(matches_q)
        matches = list(matches_res.scalars().all())

        for m in matches:
            home = stats_map.get(m.home_team_id)
            away = stats_map.get(m.away_team_id)

            if not home or not away:
                continue

            hs = m.home_score or 0
            as_ = m.away_score or 0

            home["played"] += 1
            away["played"] += 1

            home["goals_for"] += hs
            home["goals_against"] += as_
            home["goal_difference"] = home["goals_for"] - home["goals_against"]

            away["goals_for"] += as_
            away["goals_against"] += hs
            away["goal_difference"] = away["goals_for"] - away["goals_against"]

            if hs > as_:
                home["won"] += 1
                home["points"] += 3
                home["form_list"].append("W")
                away["lost"] += 1
                away["form_list"].append("L")
            elif hs < as_:
                away["won"] += 1
                away["points"] += 3
                away["form_list"].append("W")
                home["lost"] += 1
                home["form_list"].append("L")
            else:
                home["drawn"] += 1
                home["points"] += 1
                home["form_list"].append("D")
                away["drawn"] += 1
                away["points"] += 1
                away["form_list"].append("D")

        # 3. Sort by Points -> GD -> GF
        sorted_standings = sorted(
            stats_map.values(),
            key=lambda x: (x["points"], x["goal_difference"], x["goals_for"]),
            reverse=True
        )

        # 4. Upsert Standings records
        for pos, data in enumerate(sorted_standings, start=1):
            team_id = data["team"].id
            recent_form = ",".join(data["form_list"][-5:])

            existing_q = select(Standing).where(Standing.tournament_id == tournament_id, Standing.team_id == team_id)
            res = await self.session.execute(existing_q)
            standing_rec = res.scalar_one_or_none()

            if not standing_rec:
                standing_rec = Standing(
                    tournament_id=tournament_id,
                    team_id=team_id
                )
                self.session.add(standing_rec)

            standing_rec.played = data["played"]
            standing_rec.won = data["won"]
            standing_rec.drawn = data["drawn"]
            standing_rec.lost = data["lost"]
            standing_rec.goals_for = data["goals_for"]
            standing_rec.goals_against = data["goals_against"]
            standing_rec.goal_difference = data["goal_difference"]
            standing_rec.points = data["points"]
            standing_rec.form = recent_form
            standing_rec.position = pos

        await self.session.commit()

        # Invalidate Redis cache
        cache_key = f"standings:{tournament_id}"
        if redis_service:
            await redis_service.set(cache_key, None, expire_seconds=1)
