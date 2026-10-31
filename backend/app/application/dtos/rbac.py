import uuid

from pydantic import BaseModel, ConfigDict


class PermissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    module: str
    action: str
    description: str | None = None


class RoleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID | None = None
    name: str
    slug: str
    description: str | None = None
    is_system: bool
    permissions: list[PermissionResponse] = []


class UserRoleAssignmentRequest(BaseModel):
    user_id: uuid.UUID
    role_id: uuid.UUID
    scope_type: str = "LEAGUE"  # LEAGUE, TOURNAMENT, TEAM
    scope_id: uuid.UUID | None = None


class UserRoleAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    role_id: uuid.UUID
    tenant_id: uuid.UUID
    scope_type: str
    scope_id: uuid.UUID | None = None
