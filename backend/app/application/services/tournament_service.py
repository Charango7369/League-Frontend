import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.player import PlayerCreate
from app.application.dtos.team import TeamCreate
from app.application.dtos.tournament import TournamentCreate
from app.infrastructure.models.match import Match
from app.infrastructure.models.player import Player
from app.infrastructure.models.statistics import Standing
from app.infrastructure.models.team import Team
from app.infrastructure.models.tournament import Matchday, Season, Tournament
from app.infrastructure.repositories.tournament_repository import TournamentRepository


class TournamentService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = TournamentRepository(session)

    async def create_tournament(self, org_id: uuid.UUID, data: TournamentCreate) -> Tournament:
        # Create or find Season
        season = Season(
            organization_id=org_id,
            name=data.season_name,
            year=data.season_year,
            is_current=True
        )
        self.session.add(season)
        await self.session.flush()

        tournament = Tournament(
            organization_id=org_id,
            season_id=season.id,
            name=data.name,
            slug=data.slug.lower().strip(),
            sport_format=data.sport_format,
            match_duration=data.match_duration,
            points_for_win=data.points_for_win,
            points_for_draw=data.points_for_draw,
            points_for_loss=data.points_for_loss,
            status="ACTIVE"
        )
        self.session.add(tournament)
        await self.session.commit()
        await self.session.refresh(tournament)
        return tournament

    async def create_team(self, org_id: uuid.UUID, data: TeamCreate) -> Team:
        team = Team(
            organization_id=org_id,
            name=data.name,
            short_code=data.short_code.upper().strip(),
            city=data.city,
            stadium_name=data.stadium_name,
            coach_name=data.coach_name,
            primary_color=data.primary_color,
            secondary_color=data.secondary_color,
            logo_url=data.logo_url,
            founded_year=data.founded_year
        )
        self.session.add(team)
        await self.session.commit()
        await self.session.refresh(team)
        return team

    async def create_player(self, org_id: uuid.UUID, data: PlayerCreate) -> Player:
        player = Player(
            organization_id=org_id,
            team_id=data.team_id,
            first_name=data.first_name,
            last_name=data.last_name,
            jersey_number=data.jersey_number,
            position=data.position,
            document_id=data.document_id,
            date_of_birth=data.date_of_birth,
            photo_url=data.photo_url,
            medical_notes=data.medical_notes,
            guardian_phone=data.guardian_phone,
            bank_account=data.bank_account,
            is_eligible=True
        )
        self.session.add(player)
        await self.session.commit()
        await self.session.refresh(player)
        return player

    async def generate_berger_fixtures(
        self,
        org_id: uuid.UUID,
        tournament_id: uuid.UUID,
        start_date: datetime,
        include_return_leg: bool = False
    ) -> list[Match]:
        """
        Generates full tournament schedule using mathematical Berger tables.
        Rotates home/away balance and assigns matchdays.
        """
        teams = await self.repo.list_teams(org_id)
        if len(teams) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Se requieren al menos 2 equipos afiliados para armar el fixture."
            )

        team_ids: list[uuid.UUID | None] = [t.id for t in teams]
        if len(team_ids) % 2 != 0:
            team_ids.append(None) # Bye/Descanso marker

        n = len(team_ids)
        total_rounds = n - 1
        matches_per_round = n // 2
        generated_matches: list[Match] = []

        current_weekend = start_date

        # Initialize initial Standings records for each team if not exists
        for team in teams:
            standing = Standing(
                tournament_id=tournament_id,
                team_id=team.id,
                played=0,
                won=0,
                drawn=0,
                lost=0,
                goals_for=0,
                goals_against=0,
                goal_difference=0,
                points=0,
                form="",
                position=1
            )
            self.session.add(standing)

        # First Leg (Ida)
        for r in range(total_rounds):
            round_num = r + 1
            matchday = Matchday(
                tournament_id=tournament_id,
                number=round_num,
                name=f"Jornada {round_num}",
                round_type="REGULAR"
            )
            self.session.add(matchday)
            await self.session.flush()

            for m in range(matches_per_round):
                home_idx = (r + m) % (n - 1)
                away_idx = (n - 1 - m + r) % (n - 1)

                if m == 0:
                    away_idx = n - 1

                # Alternate home/away for the pivot team
                if m == 0 and r % 2 == 1:
                    home_idx, away_idx = away_idx, home_idx

                home_team_id = team_ids[home_idx]
                away_team_id = team_ids[away_idx]

                if home_team_id is None or away_team_id is None:
                    continue # Free week (Descanso)

                match_time = current_weekend + timedelta(hours=14 + (m * 2))
                match = Match(
                    organization_id=org_id,
                    tournament_id=tournament_id,
                    matchday_id=matchday.id,
                    home_team_id=home_team_id,
                    away_team_id=away_team_id,
                    scheduled_at=match_time,
                    status="SCHEDULED",
                    home_score=None,
                    away_score=None,
                    current_minute=0
                )
                self.session.add(match)
                generated_matches.append(match)

            current_weekend += timedelta(days=7)

        # Second Leg (Vuelta) if requested
        if include_return_leg:
            first_leg = list(generated_matches)
            for r in range(total_rounds):
                round_num = total_rounds + r + 1
                matchday = Matchday(
                    tournament_id=tournament_id,
                    number=round_num,
                    name=f"Jornada {round_num} (Vuelta)",
                    round_type="REGULAR"
                )
                self.session.add(matchday)
                await self.session.flush()

                round_matches = [m for m in first_leg if m.matchday_id == first_leg[r * (matches_per_round - 1)].matchday_id]
                for idx, prev in enumerate(round_matches):
                    match_time = current_weekend + timedelta(hours=14 + (idx * 2))
                    match = Match(
                        organization_id=org_id,
                        tournament_id=tournament_id,
                        matchday_id=matchday.id,
                        home_team_id=prev.away_team_id,
                        away_team_id=prev.home_team_id,
                        scheduled_at=match_time,
                        status="SCHEDULED",
                        home_score=None,
                        away_score=None,
                        current_minute=0
                    )
                    self.session.add(match)
                    generated_matches.append(match)

                current_weekend += timedelta(days=7)

        await self.session.commit()
        return generated_matches
