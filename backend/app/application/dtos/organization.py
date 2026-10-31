import uuid

from pydantic import BaseModel, Field


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    slug: str = Field(min_length=3, max_length=80)
    custom_domain: str | None = None
    primary_color: str = "#1a4fd6"
    theme_branding: dict | None = None

class OrganizationUpdate(BaseModel):
    name: str | None = None
    custom_domain: str | None = None
    primary_color: str | None = None
    theme_branding: dict | None = None
    logo_url: str | None = None

class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    custom_domain: str | None
    logo_url: str | None
    primary_color: str
    theme_branding: dict
    status: str

    class Config:
        from_attributes = True
