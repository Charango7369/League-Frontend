import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class PlayerCreate(BaseModel):
    team_id: uuid.UUID
    first_name: str
    last_name: str
    jersey_number: int = Field(ge=1, le=99)
    position: str = "FORWARD"
    document_id: str | None = None
    date_of_birth: date | None = None
    photo_url: str | None = None
    medical_notes: str | None = None
    guardian_phone: str | None = None
    bank_account: str | None = None

class PlayerUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    jersey_number: int | None = None
    position: str | None = None
    photo_url: str | None = None
    is_eligible: bool | None = None
    document_id: str | None = None
    date_of_birth: date | None = None
    medical_notes: str | None = None
    guardian_phone: str | None = None
    bank_account: str | None = None

class PlayerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    team_id: uuid.UUID
    first_name: str
    last_name: str
    jersey_number: int
    position: str
    photo_url: str | None = None
    is_eligible: bool = True
    date_of_birth: date | None = None
    document_id: str | None = None
    medical_notes: str | None = None
    guardian_phone: str | None = None
    bank_account: str | None = None

class PlayerLeaderboardResponse(BaseModel):
    player_id: uuid.UUID
    full_name: str
    jersey_number: int
    team_name: str
    team_short: str
    team_color: str
    goals: int
    assists: int
    yellow_cards: int
    red_cards: int
