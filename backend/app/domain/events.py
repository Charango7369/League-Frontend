import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass(frozen=True)
class DomainEvent:
    event_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    occurred_at: datetime = field(default_factory=datetime.utcnow)
    tenant_id: str = ""

@dataclass(frozen=True)
class MatchEventRecorded(DomainEvent):
    match_id: str = ""
    event_type: str = ""
    minute: int = 0
    team_id: str = ""
    primary_player_id: str | None = None
    secondary_player_id: str | None = None
    home_score: int = 0
    away_score: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)

@dataclass(frozen=True)
class MatchFinished(DomainEvent):
    match_id: str = ""
    tournament_id: str = ""
    home_team_id: str = ""
    away_team_id: str = ""
    home_score: int = 0
    away_score: int = 0

@dataclass(frozen=True)
class StandingsRecalculated(DomainEvent):
    tournament_id: str = ""
    teams_count: int = 0
