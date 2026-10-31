import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class InscriptionCreate(BaseModel):
    team_id: uuid.UUID
    tournament_id: uuid.UUID
    amount: Decimal = Decimal("250.00")
    currency: str = "BOB"
    receipt_url: str | None = None
    bank_account: str | None = None
    notes: str | None = None


class PaymentValidationRequest(BaseModel):
    notes: str | None = None


class InscriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    team_id: uuid.UUID
    tournament_id: uuid.UUID
    amount: Decimal
    currency: str
    status: str
    receipt_url: str | None = None
    bank_account: str | None = None
    registered_by: uuid.UUID | None = None
    approved_by: uuid.UUID | None = None
    notes: str | None = None
    created_at: datetime
