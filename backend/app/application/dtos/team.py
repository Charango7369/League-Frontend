import uuid

from pydantic import BaseModel, ConfigDict, Field


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    short_code: str = Field(min_length=2, max_length=6)
    city: str = "Apolo"
    stadium_name: str | None = None
    coach_name: str | None = None
    primary_color: str = "#1a4fd6"
    secondary_color: str = "#f0b429"
    logo_url: str | None = None
    founded_year: int | None = None

class TeamUpdate(BaseModel):
    name: str | None = None
    short_code: str | None = None
    city: str | None = None
    stadium_name: str | None = None
    coach_name: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    logo_url: str | None = None

class TeamResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    short_code: str
    city: str
    stadium_name: str | None
    coach_name: str | None
    primary_color: str
    secondary_color: str
    logo_url: str | None
    founded_year: int | None
