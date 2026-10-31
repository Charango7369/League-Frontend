import asyncio
import os
import sys
from datetime import datetime, timedelta
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.infrastructure.database import AsyncSessionLocal
from sqlalchemy import select
from app.infrastructure.models.organization import Organization
from app.infrastructure.models.tournament import Tournament, Season, Matchday, Venue
from app.infrastructure.models.team import Team
from app.infrastructure.models.player import Player
from app.infrastructure.models.match import Match, MatchEvent
from app.application.services.tournament_service import TournamentService
from app.application.services.stats_engine import StatsEngine
from app.application.dtos.team import TeamCreate
from app.application.dtos.tournament import TournamentCreate

INITIAL_TEAMS_DATA = [
    {
        "name": "Club Apolo F.C.",
        "short_code": "APO",
        "city": "Apolo Centro",
        "stadium_name": "Estadio Municipal de Apolo",
        "coach_name": "Roberto Quispe",
        "primary_color": "#1a4fd6",
        "secondary_color": "#f0b429",
        "players": [
            ("Rodrigo", "Rojas", 9, "Delantero"),
            ("Ariel", "Mendoza", 10, "Mediocampista"),
            ("Carlos", "Guzmán", 1, "Portero")
        ]
    },
    {
        "name": "Deportivo Franz Tamayo",
        "short_code": "DFT",
        "city": "Franz Tamayo",
        "stadium_name": "Estadio Bicentenario",
        "coach_name": "Marcelo Cárdenas",
        "primary_color": "#15803d",
        "secondary_color": "#ffffff",
        "players": [
            ("Javier", "Fernández", 9, "Delantero"),
            ("Mauricio", "Paz", 8, "Mediocampista"),
            ("Walter", "Flores", 1, "Portero")
        ]
    },
    {
        "name": "Atlético Madidi",
        "short_code": "MAD",
        "city": "Reserva Madidi",
        "stadium_name": "Cancha Parque Madidi",
        "coach_name": "Gabriel Soria",
        "primary_color": "#0f766e",
        "secondary_color": "#fbbf24",
        "players": [
            ("Diego", "Chávez", 11, "Delantero"),
            ("Lucas", "Torres", 5, "Defensor"),
            ("Álvaro", "Peña", 1, "Portero")
        ]
    },
    {
        "name": "Real Machariapo",
        "short_code": "RMA",
        "city": "Machariapo",
        "stadium_name": "Cancha Cañón Machariapo",
        "coach_name": "Luis Fernando Vega",
        "primary_color": "#b91c1c",
        "secondary_color": "#ffffff",
        "players": [
            ("Fernando", "Salvatierra", 7, "Extremo"),
            ("Oscar", "Vaca", 10, "Enganche"),
            ("Daniel", "Suárez", 1, "Portero")
        ]
    },
    {
        "name": "Juventud Atén",
        "short_code": "ATN",
        "city": "Atén",
        "stadium_name": "Cancha San Bartolomé",
        "coach_name": "Carlos Mamani",
        "primary_color": "#0284c7",
        "secondary_color": "#ffffff",
        "players": [
            ("Gustavo", "Ríos", 9, "Delantero"),
            ("Héctor", "Calle", 6, "Pivote"),
            ("José", "Valdez", 1, "Portero")
        ]
    },
    {
        "name": "Tigres del Norte Apolo",
        "short_code": "TIG",
        "city": "Barrio Norte",
        "stadium_name": "Polideportivo Central",
        "coach_name": "Hugo Miranda",
        "primary_color": "#d97706",
        "secondary_color": "#000000",
        "players": [
            ("Marcos", "Aguilar", 9, "Goleador"),
            ("Cristian", "Poma", 7, "Extremo"),
            ("Andrés", "León", 1, "Portero")
        ]
    },
    {
        "name": "Rangers de Franz Tamayo",
        "short_code": "RAN",
        "city": "El Carmen",
        "stadium_name": "Cancha El Carmen",
        "coach_name": "Esteban Ramos",
        "primary_color": "#4338ca",
        "secondary_color": "#38bdf8",
        "players": [
            ("Eduardo", "Zárate", 10, "Capitán"),
            ("Fabián", "Cruz", 4, "Central"),
            ("Pablo", "Cabrera", 1, "Portero")
        ]
    },
    {
        "name": "Unión Pauje-Yuyo",
        "short_code": "UPY",
        "city": "Pauje",
        "stadium_name": "Cancha Ribera Yuyo",
        "coach_name": "Ángel Morales",
        "primary_color": "#c2410c",
        "secondary_color": "#fef08a",
        "players": [
            ("Samuel", "Morales", 11, "Delantero"),
            ("Ignacio", "Silva", 8, "Volante"),
            ("Rubén", "Darío", 1, "Portero")
        ]
    }
]

async def seed():
    async with AsyncSessionLocal() as session:
        # Find organization
        result = await session.execute(
            select(Organization).where(Organization.slug == "asociacion-apolo")
        )
        org = result.scalars().first()
        if not org:
            org = Organization(
                id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
                name="Asociación Provincial de Fútbol Franz Tamayo",
                slug="asociacion-apolo",
                status="ACTIVE",
            )
            session.add(org)
            await session.commit()
            print("Organización 'asociacion-apolo' creada automáticamente.")

        print(f"Using Organization: {org.name} ({org.id})")

        # 1. Create Venue
        venue = Venue(
            organization_id=org.id,
            name="Estadio Municipal de Apolo",
            city="Apolo",
            surface_type="Césped Natural",
            capacity=3500
        )
        session.add(venue)
        await session.flush()

        # 2. Create Season and Tournament
        tourney_service = TournamentService(session)
        tourney_dto = TournamentCreate(
            name="Liga de Fútbol Apolodigital 2026",
            slug="liga-futbol-apolo-2026",
            sport_format="SOCCER_11",
            match_duration=90,
            season_name="Temporada Oficial 2026",
            season_year=2026
        )
        tournament = await tourney_service.create_tournament(org.id, tourney_dto)
        print(f"Created Tournament: {tournament.name} ({tournament.id})")

        # 3. Create Teams and Players
        created_teams = []
        player_map = {} # team_id -> list of players
        for t_data in INITIAL_TEAMS_DATA:
            team_dto = TeamCreate(
                name=t_data["name"],
                short_code=t_data["short_code"],
                city=t_data["city"],
                stadium_name=t_data["stadium_name"],
                coach_name=t_data["coach_name"],
                primary_color=t_data["primary_color"],
                secondary_color=t_data["secondary_color"]
            )
            team = await tourney_service.create_team(org.id, team_dto)
            created_teams.append(team)

            # Create players
            player_list = []
            for p_first, p_last, p_dorsal, p_pos in t_data["players"]:
                player = Player(
                    organization_id=org.id,
                    team_id=team.id,
                    first_name=p_first,
                    last_name=p_last,
                    jersey_number=p_dorsal,
                    position=p_pos,
                    is_eligible=True
                )
                session.add(player)
                await session.flush()
                player_list.append(player)
            player_map[team.id] = player_list

        await session.commit()
        print(f"Created {len(created_teams)} teams with official rosters.")

        # 4. Generate Berger Fixtures
        fixtures = await tourney_service.generate_berger_fixtures(
            org_id=org.id,
            tournament_id=tournament.id,
            start_date=datetime.utcnow() - timedelta(days=14),
            include_return_leg=False
        )
        print(f"Generated {len(fixtures)} matches using Berger algorithm.")

        # 5. Play some sample matches to generate live standings
        # Jornada 1: 4 matches
        jornada1_matches = fixtures[:4]
        # Match 1: Club Apolo FC vs Deportivo Franz Tamayo -> 3 - 1 (FINISHED)
        m1 = jornada1_matches[0]
        m1.status = "FINISHED"
        m1.home_score = 3
        m1.away_score = 1
        m1.finished_at = datetime.utcnow() - timedelta(days=7)

        # Record events for m1
        h_players = player_map[m1.home_team_id]
        a_players = player_map[m1.away_team_id]

        ev1 = MatchEvent(
            organization_id=org.id,
            match_id=m1.id,
            team_id=m1.home_team_id,
            primary_player_id=h_players[0].id,
            event_type="GOAL",
            minute=18
        )
        ev2 = MatchEvent(
            organization_id=org.id,
            match_id=m1.id,
            team_id=m1.away_team_id,
            primary_player_id=a_players[0].id,
            event_type="GOAL",
            minute=34
        )
        ev3 = MatchEvent(
            organization_id=org.id,
            match_id=m1.id,
            team_id=m1.home_team_id,
            primary_player_id=h_players[0].id,
            event_type="GOAL",
            minute=62
        )
        ev4 = MatchEvent(
            organization_id=org.id,
            match_id=m1.id,
            team_id=m1.home_team_id,
            primary_player_id=h_players[1].id,
            event_type="GOAL",
            minute=88
        )
        session.add_all([ev1, ev2, ev3, ev4])

        # Match 2: Atlético Madidi vs Real Machariapo -> 2 - 2 (FINISHED)
        m2 = jornada1_matches[1]
        m2.status = "FINISHED"
        m2.home_score = 2
        m2.away_score = 2
        m2.finished_at = datetime.utcnow() - timedelta(days=7)

        # Match 3: Juventud Atén vs Tigres del Norte -> 1 - 0 (FINISHED)
        m3 = jornada1_matches[2]
        m3.status = "FINISHED"
        m3.home_score = 1
        m3.away_score = 0
        m3.finished_at = datetime.utcnow() - timedelta(days=6)

        # Match 4: Rangers vs Unión Pauje-Yuyo -> 2 - 1 LIVE (en_juego min 73)
        m4 = jornada1_matches[3]
        m4.status = "LIVE"
        m4.current_minute = 73
        m4.home_score = 2
        m4.away_score = 1
        m4.started_at = datetime.utcnow() - timedelta(minutes=80)

        await session.commit()

        # 6. Recalculate standings with StatsEngine
        stats_engine = StatsEngine(session)
        await stats_engine.recalculate_tournament_standings(tournament.id)
        
        standings_q = select(Standing).where(Standing.tournament_id == tournament.id).order_by(Standing.position)
        standings_res = await session.execute(standings_q)
        standings = list(standings_res.scalars().all())
        print(f"Standings successfully calculated for {len(standings)} teams!")

        # Print top table
        for s in standings:
            team_obj = await session.get(Team, s.team_id)
            print(f"Pos {s.position}: {team_obj.name} | PTS: {s.points} | PJ: {s.played} | DIF: {s.goal_difference}")

if __name__ == '__main__':
    asyncio.run(seed())
