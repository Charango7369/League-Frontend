import uuid

from pydantic import BaseModel, ConfigDict


class SanctionCreate(BaseModel):
    player_id: uuid.UUID
    player_name: str
    player_number: int | None = None
    team_id: uuid.UUID
    team_name: str
    match_id: uuid.UUID | None = None
    round_number: int | None = None
    sanction_type: str # roja_directa, amarillas_acumuladas, doble_amarilla, conducta_antideportiva, sancion_tribunal
    matches_suspended: int = 1
    matches_served: int = 0
    financial_fine_bob: float | None = 0.0
    description: str
    infraction_details: str
    tribunal_signer: str
    status: str = "activa" # activa, cumplida, apelada, indultada

class SanctionUpdate(BaseModel):
    matches_suspended: int | None = None
    matches_served: int | None = None
    financial_fine_bob: float | None = None
    description: str | None = None
    infraction_details: str | None = None
    tribunal_signer: str | None = None
    status: str | None = None

class SanctionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    player_id: uuid.UUID
    player_name: str
    player_number: int | None = None
    team_id: uuid.UUID
    team_name: str
    match_id: uuid.UUID | None = None
    round_number: int | None = None
    sanction_type: str
    matches_suspended: int
    matches_served: int
    financial_fine_bob: float | None = 0.0
    resolution_date: str
    description: str
    infraction_details: str
    tribunal_signer: str
    status: str

class DisciplinarySummaryResponse(BaseModel):
    active_suspended_count: int
    total_yellow_cards: int
    total_red_cards: int
    total_fines_bob: float
    resolutions_count: int
