import uuid

from app.application.dtos.discipline import SanctionCreate, SanctionResponse


def test_sanction_dto_validation():
    player_id = uuid.uuid4()
    team_id = uuid.uuid4()

    sanc_create = SanctionCreate(
        player_id=player_id,
        player_name="Dante Mercado",
        player_number=3,
        team_id=team_id,
        team_name="Deportivo Franz Tamayo",
        sanction_type="roja_directa",
        matches_suspended=2,
        matches_served=1,
        financial_fine_bob=150.0,
        description="Suspensión por conducta antideportiva.",
        infraction_details="Expulsión directa en el minuto 67 del clásico provincial.",
        tribunal_signer="Dr. Hernán Arteaga - Presidente Tribunal de Penas",
        status="activa",
    )

    assert sanc_create.player_name == "Dante Mercado"
    assert sanc_create.matches_suspended == 2
    assert sanc_create.matches_served == 1
    assert sanc_create.status == "activa"
    assert sanc_create.sanction_type == "roja_directa"

def test_sanction_resolution_code_format():
    sanc_resp = SanctionResponse(
        id=uuid.uuid4(),
        code="RES-TJD-2026-001",
        player_id=uuid.uuid4(),
        player_name="Javier Torrez",
        player_number=10,
        team_id=uuid.uuid4(),
        team_name="Club Apolo F.C.",
        sanction_type="amarillas_acumuladas",
        matches_suspended=1,
        matches_served=0,
        financial_fine_bob=50.0,
        resolution_date="2026-03-16",
        description="Ciclo de 3 amarillas.",
        infraction_details="Acumulación consecutiva de tarjetas amarillas.",
        tribunal_signer="Dra. Miriam Carvajal - Secretaria General TJD",
        status="activa",
    )

    assert sanc_resp.code.startswith("RES-TJD-")
    assert sanc_resp.matches_suspended - sanc_resp.matches_served == 1
