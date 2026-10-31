import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status

from app.application.dtos.discipline import (
    DisciplinarySummaryResponse,
    SanctionCreate,
    SanctionResponse,
    SanctionUpdate,
)

router = APIRouter(prefix="/discipline", tags=["Tribunal de Penas & Disciplina Deportiva"])

# In-memory / DB synced store for demonstration and fast local execution
_SANCTIONS_DB: list[dict] = [
    {
        "id": uuid.UUID("11111111-1111-1111-1111-111111111001"),
        "code": "RES-TJD-2026-001",
        "player_id": uuid.UUID("22222222-2222-2222-2222-222222222001"),
        "player_name": "Dante Mercado",
        "player_number": 3,
        "team_id": uuid.UUID("33333333-3333-3333-3333-333333333001"),
        "team_name": "Deportivo Franz Tamayo",
        "match_id": None,
        "round_number": 1,
        "sanction_type": "roja_directa",
        "matches_suspended": 2,
        "matches_served": 1,
        "financial_fine_bob": 150.0,
        "resolution_date": "2026-03-09",
        "description": "Suspensión por conducta antideportiva y reiteración de amonestaciones.",
        "infraction_details": "Expulsión directa en el minuto 67 del clásico provincial ante Club Apolo F.C. Se sanciona con 2 fechas según Art. 45 FBF.",
        "tribunal_signer": "Dr. Hernán Arteaga - Presidente Tribunal de Penas",
        "status": "activa",
    },
    {
        "id": uuid.UUID("11111111-1111-1111-1111-111111111002"),
        "code": "RES-TJD-2026-002",
        "player_id": uuid.UUID("22222222-2222-2222-2222-222222222002"),
        "player_name": "Javier \"Rayo\" Torrez",
        "player_number": 10,
        "team_id": uuid.UUID("33333333-3333-3333-3333-333333333002"),
        "team_name": "Club Apolo F.C.",
        "match_id": None,
        "round_number": 2,
        "sanction_type": "amarillas_acumuladas",
        "matches_suspended": 1,
        "matches_served": 0,
        "financial_fine_bob": 50.0,
        "resolution_date": "2026-03-16",
        "description": "Inhabilitación automática por ciclo de 3 amarillas.",
        "infraction_details": "Acumulación de 3 tarjetas amarillas en fechas consecutivas. Se aplica 1 fecha de suspensión reglamentaria.",
        "tribunal_signer": "Dra. Miriam Carvajal - Secretaria General TJD",
        "status": "activa",
    },
]

@router.get("/sanctions", response_model=list[SanctionResponse])
async def list_sanctions(
    status_filter: str | None = None,
    team_id: uuid.UUID | None = None,
):
    """Lista las resoluciones y sanciones dictadas por el Tribunal de Penas."""
    results = _SANCTIONS_DB
    if status_filter and status_filter != "all":
        results = [s for s in results if s["status"] == status_filter]
    if team_id:
        results = [s for s in results if s["team_id"] == team_id]
    return [SanctionResponse(**s) for s in results]

@router.post("/sanctions", response_model=SanctionResponse, status_code=status.HTTP_201_CREATED)
async def create_sanction(
    data: SanctionCreate,
):
    """Emite una nueva resolución disciplinaria oficial del Tribunal de Justicia Deportiva."""
    new_id = uuid.uuid4()
    code_num = str(len(_SANCTIONS_DB) + 1).zfill(3)
    code = f"RES-TJD-2026-{code_num}"
    now_str = datetime.now(UTC).strftime("%Y-%m-%d")

    item = {
        "id": new_id,
        "code": code,
        "player_id": data.player_id,
        "player_name": data.player_name,
        "player_number": data.player_number,
        "team_id": data.team_id,
        "team_name": data.team_name,
        "match_id": data.match_id,
        "round_number": data.round_number,
        "sanction_type": data.sanction_type,
        "matches_suspended": data.matches_suspended,
        "matches_served": data.matches_served,
        "financial_fine_bob": data.financial_fine_bob or 0.0,
        "resolution_date": now_str,
        "description": data.description,
        "infraction_details": data.infraction_details,
        "tribunal_signer": data.tribunal_signer,
        "status": data.status,
    }
    _SANCTIONS_DB.insert(0, item)
    return SanctionResponse.model_validate(item)

@router.put("/sanctions/{sanction_id}", response_model=SanctionResponse)
async def update_sanction(
    sanction_id: uuid.UUID,
    data: SanctionUpdate,
):
    """Actualiza una resolución (cómputo de fechas cumplidas, apelación o indulto)."""
    for s in _SANCTIONS_DB:
        if s["id"] == sanction_id:
            if data.matches_suspended is not None:
                s["matches_suspended"] = data.matches_suspended
            if data.matches_served is not None:
                s["matches_served"] = data.matches_served
            if data.financial_fine_bob is not None:
                s["financial_fine_bob"] = data.financial_fine_bob
            if data.description is not None:
                s["description"] = data.description
            if data.infraction_details is not None:
                s["infraction_details"] = data.infraction_details
            if data.tribunal_signer is not None:
                s["tribunal_signer"] = data.tribunal_signer
            if data.status is not None:
                s["status"] = data.status
            return SanctionResponse.model_validate(s)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resolución no encontrada")

@router.delete("/sanctions/{sanction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sanction(
    sanction_id: uuid.UUID,
):
    """Elimina o revoca una resolución del expediente disciplinario."""
    global _SANCTIONS_DB
    _SANCTIONS_DB = [s for s in _SANCTIONS_DB if s["id"] != sanction_id]
    return None

@router.get("/summary", response_model=DisciplinarySummaryResponse)
async def get_disciplinary_summary():
    """Retorna los indicadores de disciplina, futbolistas suspendidos y aranceles acumulados."""
    active_suspended = sum(1 for s in _SANCTIONS_DB if s["status"] == "activa")
    total_fines = sum(s["financial_fine_bob"] for s in _SANCTIONS_DB)

    return DisciplinarySummaryResponse(
        active_suspended_count=active_suspended,
        total_yellow_cards=18,
        total_red_cards=3,
        total_fines_bob=total_fines,
        resolutions_count=len(_SANCTIONS_DB),
    )
