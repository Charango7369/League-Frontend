import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.permissions import PermissionName
from app.infrastructure.models.user import AuditLog, User
from app.presentation.dependencies.auth_deps import (
    AuthContext,
    get_auth_context,
    get_tenant_db,
    require_permission,
)

router = APIRouter(prefix="/audit", tags=["Auditoría Inmutable"])


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID | None = None
    action: str
    resource_name: str
    resource_id: str | None = None
    before_state: dict[str, Any] | None = None
    after_state: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    created_at: datetime


@router.get("/", response_model=list[AuditLogResponse])
async def list_audit_logs(
    resource_name: str | None = Query(None, description="Filtrar por tipo de recurso (ej: matches, user_roles, inscriptions)"),
    action: str | None = Query(None, description="Filtrar por acción (ej: UPDATE_MATCH_SCORE, ASSIGN_ROLE)"),
    user_id: uuid.UUID | None = Query(None, description="Filtrar por usuario autor"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.AUDITORIA_VER)),
) -> list[AuditLogResponse]:
    """
    Retorna el registro histórico inmutable de auditoría estrictamente limitado al tenant activo.
    Protegido con el permiso canónico 'auditoria:ver'.
    """
    stmt = (
        select(AuditLog)
        .where(AuditLog.tenant_id == auth.tenant_id)
    )

    if resource_name:
        stmt = stmt.where(AuditLog.resource_name == resource_name.lower())
    if action:
        stmt = stmt.where(AuditLog.action == action.upper())
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)

    stmt = stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)

    res = await db.execute(stmt)
    records = res.scalars().all()
    return [AuditLogResponse.model_validate(r) for r in records]
