import uuid
from datetime import UTC, datetime

from app.application.dtos.match import MatchEventResponse, MatchOfficialSheetResponse


def test_match_official_sheet_dto():
    match_id = uuid.uuid4()
    home_id = uuid.uuid4()
    away_id = uuid.uuid4()
    now = datetime.now(UTC)

    sheet = MatchOfficialSheetResponse(
        match_id=match_id,
        tournament_name="Campeonato Provincial Franz Tamayo",
        season="2026",
        round_name="Jornada 1",
        home_team_id=home_id,
        away_team_id=away_id,
        home_team_name="Club Apolo F.C.",
        away_team_name="Deportivo Franz Tamayo",
        home_team_short="APO",
        away_team_short="DFT",
        home_team_color="#1a4fd6",
        away_team_color="#f0b429",
        home_score=3,
        away_score=2,
        status="FINISHED",
        scheduled_at=now,
        venue_name="Estadio Municipal de Apolo",
        events=[
            MatchEventResponse(
                id=uuid.uuid4(),
                match_id=match_id,
                team_id=home_id,
                event_type="GOAL",
                minute=14,
                extra_minute=0,
                primary_player_id=uuid.uuid4(),
                secondary_player_id=None,
                primary_player_name="Gonzalo Vaca",
                team_name="Club Apolo F.C.",
            )
        ],
        officials=[
            {
                "role": "Principal",
                "referee_name": "Marco Antonio Quispe",
                "license_number": "FBF-LP-0412",
            }
        ],
        is_referee_signed=True,
        referee_notes="Partido oficial concluido en tiempo reglamentario sin incidentes.",
        referee_signature_hash="c7f93a8d10b2e4f7a19283c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
        referee_signed_at=now,
        verification_code=f"ACTA-{str(match_id)[:8].upper()}-APOVDFT",
    )

    assert sheet.home_score == 3
    assert sheet.away_score == 2
    assert sheet.is_referee_signed is True
    assert sheet.verification_code.startswith("ACTA-")
    assert len(sheet.events) == 1
    assert sheet.events[0].primary_player_name == "Gonzalo Vaca"
    assert sheet.officials[0]["referee_name"] == "Marco Antonio Quispe"
