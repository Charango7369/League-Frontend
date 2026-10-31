import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class MatchCreate(BaseModel):
    tournament_id: uuid.UUID
    matchday_id: uuid.UUID
    home_team_id: uuid.UUID
    away_team_id: uuid.UUID
    venue_id: uuid.UUID | None = None
    scheduled_at: datetime

class MatchUpdate(BaseModel):
    scheduled_at: datetime | None = None
    venue_id: uuid.UUID | None = None
    status: str | None = None
    home_score: int | None = None
    away_score: int | None = None
    current_minute: int | None = None
    justification: str | None = None

class MatchEventCreate(BaseModel):
    team_id: uuid.UUID
    event_type: str # GOAL, PENALTY_GOAL, OWN_GOAL, YELLOW_CARD, RED_CARD, SUBSTITUTION
    minute: int
    extra_minute: int = 0
    primary_player_id: uuid.UUID | None = None
    secondary_player_id: uuid.UUID | None = None
    metadata: dict[str, Any] = {}
    justification: str | None = None

class MatchEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    match_id: uuid.UUID
    team_id: uuid.UUID
    event_type: str
    minute: int
    extra_minute: int
    primary_player_id: uuid.UUID | None
    secondary_player_id: uuid.UUID | None
    primary_player_name: str | None = None
    team_name: str | None = None

class MatchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tournament_id: uuid.UUID
    matchday_id: uuid.UUID
    home_team_id: uuid.UUID
    away_team_id: uuid.UUID
    home_team_name: str
    away_team_name: str
    home_team_short: str
    away_team_short: str
    home_team_color: str
    away_team_color: str
    home_score: int | None
    away_score: int | None
    status: str
    current_minute: int
    scheduled_at: datetime
    venue_name: str | None = None
    correction_notes: str | None = None

class MatchDetailResponse(MatchResponse):
    events: list[MatchEventResponse] = []

class MatchOfficialSheetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    match_id: uuid.UUID
    tournament_name: str
    season: str
    round_name: str
    home_team_id: uuid.UUID
    away_team_id: uuid.UUID
    home_team_name: str
    away_team_name: str
    home_team_short: str
    away_team_short: str
    home_team_color: str
    away_team_color: str
    home_score: int | None
    away_score: int | None
    status: str
    scheduled_at: datetime
    venue_name: str
    events: list[MatchEventResponse] = []
    officials: list[dict[str, Any]] = []
    is_referee_signed: bool = False
    referee_notes: str | None = None
    correction_notes: str | None = None
    referee_signature_hash: str | None = None
    referee_signed_at: datetime | None = None
    verification_code: str

