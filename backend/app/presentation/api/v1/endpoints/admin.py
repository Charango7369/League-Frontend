import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.api_key import (
    ApiKeyCreateRequest,
    ApiKeyCreateResponse,
    ApiKeyResponse,
)
from app.application.services.api_key_service import ApiKeyService
from app.domain.permissions import PermissionName
from app.infrastructure.models.api_key import ApiKey
from app.infrastructure.models.inscription import Inscription
from app.infrastructure.models.user import User
from app.infrastructure.rate_limiter import RateLimiter
from app.presentation.dependencies.auth_deps import (
    AuthContext,
    get_auth_context,
    get_tenant_db,
    require_mfa_verified,
    require_permission,
)

router = APIRouter(prefix="/admin", tags=["Administración & Gobierno de APIs"])


@router.post("/api-keys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_external_api_key(
    data: ApiKeyCreateRequest,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.ROLES_GESTIONAR)),
    _mfa: User = Depends(require_mfa_verified),
    db: AsyncSession = Depends(get_tenant_db),
) -> ApiKeyCreateResponse:
    """
    Crea una nueva API Key con scopes específicos para integraciones externas.
    Muestra la clave en texto plano UNA SOLA VEZ.
    Exige permiso atómico 'roles:gestionar' y verificación MFA obligatoria.
    """
    # Rate limit administrative creation
    await RateLimiter.check_rate_limit(
        tenant_id=auth.tenant_id,
        identifier=f"admin_key_create_{current_user.id}",
        limit=20,
        window_seconds=60,
        fail_closed=True,
    )

    from datetime import timedelta
    expires_at = datetime.now(UTC) + timedelta(days=data.expires_in_days) if data.expires_in_days else None

    api_key_obj, raw_key = await ApiKeyService.create_api_key(
        session=db,
        tenant_id=auth.tenant_id,
        name=data.name,
        scopes=data.scopes,
        created_by_user=current_user,
        expires_at=expires_at,
    )

    return ApiKeyCreateResponse(
        id=api_key_obj.id,
        name=api_key_obj.name,
        prefix=api_key_obj.prefix,
        scopes=api_key_obj.scopes,
        raw_key=raw_key,
        expires_at=api_key_obj.expires_at,
        created_at=api_key_obj.created_at,
    )


@router.get("/api-keys", response_model=list[ApiKeyResponse])
async def list_external_api_keys(
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.ROLES_VER)),
    _mfa: User = Depends(require_mfa_verified),
    db: AsyncSession = Depends(get_tenant_db),
) -> list[ApiKeyResponse]:
    """Lista las claves de API del tenant activo sin exponer nunca el secreto ni el hash completo."""
    stmt = (
        select(ApiKey)
        .where(
            ApiKey.organization_id == auth.tenant_id,
            ApiKey.is_deleted.is_(False),
        )
        .order_by(ApiKey.created_at.desc())
    )
    res = await db.execute(stmt)
    keys = res.scalars().all()
    return [ApiKeyResponse.model_validate(k) for k in keys]


@router.delete("/api-keys/{key_id}", response_model=ApiKeyResponse)
async def revoke_external_api_key(
    key_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.ROLES_GESTIONAR)),
    _mfa: User = Depends(require_mfa_verified),
    db: AsyncSession = Depends(get_tenant_db),
) -> ApiKeyResponse:
    """Revoca inmediatamente una clave de API, deshabilitando todo acceso exterior."""
    key_obj = await ApiKeyService.revoke_api_key(
        session=db,
        tenant_id=auth.tenant_id,
        key_id=key_id,
        revoked_by_user=current_user,
    )
    return ApiKeyResponse.model_validate(key_obj)


@router.get("/finances/export-balance")
async def export_financial_balance(
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.FINANZAS_EXPORTAR_BALANCE)),
    _mfa: User = Depends(require_mfa_verified),
    db: AsyncSession = Depends(get_tenant_db),
) -> dict[str, Any]:
    """
    Exportación de balance general financiero.
    Operación crítica restringida a roles privilegiados con MFA verificado y rate limiting estricto.
    """
    await RateLimiter.check_rate_limit(
        tenant_id=auth.tenant_id,
        identifier=f"export_balance_{current_user.id}",
        limit=10,
        window_seconds=60,
        fail_closed=True,
    )

    stmt = select(Inscription).where(
        Inscription.organization_id == auth.tenant_id,
        Inscription.is_deleted.is_(False),
    )
    res = await db.execute(stmt)
    inscriptions = res.scalars().all()

    total_validated = sum(item.amount for item in inscriptions if item.status == "VALIDATED")
    total_pending = sum(item.amount for item in inscriptions if item.status == "PENDING")

    return {
        "tenant_id": str(auth.tenant_id),
        "exported_at": datetime.now(UTC).isoformat(),
        "exported_by": current_user.email,
        "mfa_verified": True,
        "currency": "BOB",
        "total_validated": float(total_validated),
        "total_pending": float(total_pending),
        "records_count": len(inscriptions),
    }
