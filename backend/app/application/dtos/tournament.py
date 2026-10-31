import uuid

from pydantic import BaseModel, ConfigDict, Field


class VenueCreate(BaseModel):
    name: str
    city: str = "Apolo"
    address: str | None = None
    surface_type: str = "NATURAL_GRASS"
    has_lighting: bool = False
    capacity: int | None = None

class VenueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    city: str
    surface_type: str
    has_lighting: bool
    capacity: int | None

class TournamentCreate(BaseModel):
    season_name: str = "Temporada 2026"
    season_year: int = 2026
    name: str = Field(min_length=3, max_length=120)
    slug: str
    sport_format: str = "LEAGUE_ROUND_ROBIN"
    match_duration: int = 90
    points_for_win: int = 3
    points_for_draw: int = 1
    points_for_loss: int = 0

class TournamentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    slug: str
    sport_format: str
    match_duration: int
    points_for_win: int
    points_for_draw: int
    points_for_loss: int
    status: str
