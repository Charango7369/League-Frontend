import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RefereeCreate(BaseModel):
    first_name: str
    last_name: str
    license_number: str | None = None
    category: str = "REGIONAL"
    phone: str | None = None
    association: str = "Colegio de Árbitros Franz Tamayo"
    role_primary: str = "PRINCIPAL"
    organization_id: uuid.UUID | None = None

class RefereeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    first_name: str
    last_name: str
    full_name: str
    license_number: str | None
    category: str
    phone: str | None
    association: str
    role_primary: str
    matches_count: int
    yellow_cards_count: int
    red_cards_count: int
    status: str

class RefereeAssignmentCreate(BaseModel):
    referee_id: uuid.UUID
    role: str # MAIN, ASSISTANT_1, ASSISTANT_2, FOURTH

class RefereeAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    match_id: uuid.UUID
    referee_id: uuid.UUID
    role: str
    referee_name: str | None = None
    license_number: str | None = None

class MatchOfficialSignRequest(BaseModel):
    referee_notes: str | None = None
    signed_by_name: str

class MatchOfficialSignResponse(BaseModel):
    match_id: uuid.UUID
    is_referee_signed: bool
    referee_signed_at: datetime | None
    referee_signature_hash: str | None
    referee_notes: str | None
