import uuid
from collections.abc import Callable
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.rbac_service import RBACService
from app.domain.permissions import PermissionName
from app.infrastructure.database import get_db, set_session_tenant
from app.infrastructure.models.match import Match
from app.infrastructure.models.membership import TenantMembership
from app.infrastructure.models.team import Team
from app.infrastructure.models.tournament import Tournament
from app.infrastructure.models.user import User
from app.infrastructure.repositories.user_repository import UserRepository
from app.infrastructure.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

class AuthContext(BaseModel):
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    email: str
    role: str
    mfa_required: bool = False
    mfa_verified: bool = False
    mfa_verified_at: str | None = None

async def get_auth_context(
    token: str | None = Depends(oauth2_scheme)
) -> AuthContext:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticación no proporcionado",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido, expirado o con firma incorrecta",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token no contiene sujeto")

    tenant_id_str = payload.get("tenant_id") or payload.get("org_id")
    if not tenant_id_str:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Token no contiene tenant activo")

    try:
        user_id = uuid.UUID(str(user_id_str))
        tenant_id = uuid.UUID(str(tenant_id_str))
    except ValueError as err:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identificadores de token malformados") from err

    return AuthContext(
        user_id=user_id,
        tenant_id=tenant_id,
        email=payload.get("email", ""),
        role=payload.get("role", "PUBLIC_USER"),
        mfa_required=bool(payload.get("mfa_required", False)),
        mfa_verified=bool(payload.get("mfa_verified", False)),
        mfa_verified_at=payload.get("mfa_verified_at"),
    )

async def get_tenant_db(
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_db)
) -> AsyncSession:
    """
    Session dependency that sets the active tenant context in PostgreSQL (SET LOCAL app.current_tenant_id)
    and ORM contextvars, and verifies active membership.
    """
    await set_session_tenant(db, auth.tenant_id)

    # Validate that the user holds an active membership in this tenant
    stmt = select(TenantMembership).where(
        TenantMembership.user_id == auth.user_id,
        TenantMembership.tenant_id == auth.tenant_id,
        TenantMembership.status == "ACTIVE",
        TenantMembership.is_deleted.is_(False)
    )
    result = await db.execute(stmt)
    membership = result.scalar_one_or_none()

    if not membership and auth.role != "SUPER_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El usuario no tiene una membresía activa en la organización indicada"
        )

    return db

async def get_current_user(
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
) -> User:
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(auth.user_id)
    if not user or not user.is_active or user.is_deleted:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Usuario inactivo o no encontrado")
    return user

def require_roles(allowed_roles: list[str]) -> Callable[..., User]:
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == "SUPER_ADMIN":
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso denegado. Se requiere uno de los roles: {allowed_roles}"
            )
        return current_user
    return role_checker


def require_permission(permission: str | PermissionName) -> Callable[..., Any]:
    """
    Reusable guard verifying atomic permission against the contextual resource scope:
    Scope Hierarchy: LEAGUE ⊃ TOURNAMENT ⊃ TEAM.
    Denies by default (403 Forbidden).
    """
    perm_str = permission.value if isinstance(permission, PermissionName) else str(permission)

    async def permission_checker(
        request: Request,
        auth: AuthContext = Depends(get_auth_context),
        db: AsyncSession = Depends(get_tenant_db),
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role == "SUPER_ADMIN":
            return current_user

        # 1. Enforce IDOR protection: if path explicitly targets a resource, verify it belongs to tenant
        if "match_id" in request.path_params:
            try:
                m_id = uuid.UUID(str(request.path_params["match_id"]))
                m_check = await db.execute(
                    select(Match.id).where(Match.id == m_id, Match.organization_id == auth.tenant_id)
                )
                if not m_check.scalar_one_or_none():
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")
            except ValueError as err:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado") from err

        if "tournament_id" in request.path_params:
            try:
                t_id = uuid.UUID(str(request.path_params["tournament_id"]))
                t_check = await db.execute(
                    select(Tournament.id).where(Tournament.id == t_id, Tournament.organization_id == auth.tenant_id)
                )
                if not t_check.scalar_one_or_none():
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torneo no encontrado")
            except ValueError as err:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torneo no encontrado") from err

        if "team_id" in request.path_params:
            try:
                tm_id = uuid.UUID(str(request.path_params["team_id"]))
                tm_check = await db.execute(
                    select(Team.id).where(Team.id == tm_id, Team.organization_id == auth.tenant_id)
                )
                if not tm_check.scalar_one_or_none():
                    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")
            except ValueError as err:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado") from err

        # 2. Collect all path, query & body params to resolve target resource
        resource_params: dict[str, Any] = dict(request.path_params)
        for k, v in request.query_params.items():
            if k not in resource_params:
                resource_params[k] = v

        if request.method in ("POST", "PUT", "PATCH"):
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    body_json = await request.json()
                    if isinstance(body_json, dict):
                        for k in ("tournament_id", "team_id", "match_id", "player_id"):
                            if k in body_json and k not in resource_params:
                                resource_params[k] = body_json[k]
                except Exception:
                    pass

        # 3. Resolve scopes (hierarchy: LEAGUE -> TOURNAMENT -> TEAM)
        scopes = await RBACService.resolve_resource_scopes(db, auth.tenant_id, resource_params)

        # 4. Verify if user holds the permission in any applicable scope
        has_perm = await RBACService.user_has_permission_in_scopes(
            db=db,
            user=current_user,
            tenant_id=auth.tenant_id,
            permission_name=perm_str,
            target_scopes=scopes,
        )

        if not has_perm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permiso insuficiente: Se requiere '{perm_str}' en el alcance del recurso solicitado."
            )

        return current_user

    return permission_checker


async def require_mfa_verified(
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(get_current_user),
) -> User:
    """Enforces MFA verification for privileged administrative roles or MFA-enrolled accounts."""
    is_privileged = current_user.role in ("SUPER_ADMIN", "ADMIN_LIGA", "GESTOR_FINANCIERO")
    if is_privileged or current_user.mfa_enabled or auth.mfa_required:
        if not auth.mfa_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="MFA requerido: Se requiere verificación de doble factor (TOTP) para acceder a este recurso privilegiado.",
            )
    return current_user


class ApiKeyContext(BaseModel):
    api_key_id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    scopes: list[str]


def require_api_key(
    required_scope: str | None = None,
    limit: int = 60,
    window_seconds: int = 60,
) -> Callable[..., Any]:
    """Dependency verifying external API Keys, scopes, tenant isolation, and Redis rate limiting."""
    async def api_key_dependency(
        request: Request,
        db: AsyncSession = Depends(get_db),
    ) -> ApiKeyContext:
        from app.application.services.api_key_service import ApiKeyService
        from app.infrastructure.rate_limiter import RateLimiter

        raw_key = request.headers.get("X-API-Key")
        if not raw_key:
            auth_h = request.headers.get("Authorization", "")
            if auth_h.startswith("ApiKey "):
                raw_key = auth_h.split(" ", 1)[1].strip()
            elif auth_h.startswith("Bearer apl_"):
                raw_key = auth_h.split(" ", 1)[1].strip()

        if not raw_key:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="API Key no proporcionada. Envíela en la cabecera 'X-API-Key' o 'Authorization: ApiKey <clave>'.",
                headers={"WWW-Authenticate": "ApiKey"},
            )

        key_obj = await ApiKeyService.verify_api_key(
            session=db,
            raw_key=raw_key,
            required_scope=required_scope,
        )

        await set_session_tenant(db, key_obj.organization_id)

        await RateLimiter.check_rate_limit(
            tenant_id=key_obj.organization_id,
            identifier=f"api_key_{key_obj.id}",
            limit=limit,
            window_seconds=window_seconds,
            fail_closed=True,
        )

        return ApiKeyContext(
            api_key_id=key_obj.id,
            tenant_id=key_obj.organization_id,
            name=key_obj.name,
            scopes=key_obj.scopes,
        )

    return api_key_dependency

