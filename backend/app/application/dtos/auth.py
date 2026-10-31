import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    organization_name: str
    organization_slug: str
    phone: str | None = None

class SwitchTenantRequest(BaseModel):
    tenant_id: uuid.UUID

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: uuid.UUID
    email: str
    role: str
    organization_id: uuid.UUID | None
    organization_slug: str | None
    tenant_id: uuid.UUID | None = None
    mfa_required: bool = False
    mfa_verified: bool = False

class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    backup_codes: list[str]

class MFAEnableRequest(BaseModel):
    code: str

class MFAVerifyRequest(BaseModel):
    code: str | None = None
    backup_code: str | None = None

class MFAVerifyResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    mfa_verified: bool = True
    mfa_verified_at: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    role: str
    organization_id: uuid.UUID | None
    is_active: bool
