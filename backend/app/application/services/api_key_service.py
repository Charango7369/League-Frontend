import hashlib
import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.audit_service import AuditService
from app.infrastructure.models.api_key import ApiKey
from app.infrastructure.models.user import User

VALID_API_SCOPES = frozenset({
    "api:scores:read",
    "api:stats:read",
    "api:live:write",
})


class ApiKeyService:
    """Manages creation, hashing, verification, revocation, and scope validation for API Keys."""

    @classmethod
    async def create_api_key(
        cls,
        session: AsyncSession,
        tenant_id: uuid.UUID,
        name: str,
        scopes: list[str],
        created_by_user: User | None = None,
        expires_at: datetime | None = None,
    ) -> tuple[ApiKey, str]:
        """
        Generates a high-entropy API key.
        Stores SHA-256 hash and identifiable prefix.
        Returns the ApiKey entity and the raw key string (displayed only once).
        """
        for s in scopes:
            if s not in VALID_API_SCOPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Scope inválido '{s}'. Scopes válidos: {list(VALID_API_SCOPES)}",
                )

        raw_token = secrets.token_urlsafe(32)
        raw_key = f"apl_live_{raw_token}"
        prefix = raw_key[:12]
        hashed_key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

        key_id = uuid.uuid4()
        api_key_obj = ApiKey(
            id=key_id,
            organization_id=tenant_id,
            name=name,
            prefix=prefix,
            hashed_key=hashed_key,
            scopes=scopes,
            created_by=created_by_user.id if created_by_user else None,
            expires_at=expires_at,
            is_active=True,
        )
        session.add(api_key_obj)

        await AuditService.record_mutation(
            session=session,
            tenant_id=tenant_id,
            action="CREATE_API_KEY",
            resource_name="api_keys",
            resource_id=str(key_id),
            before_state=None,
            after_state={
                "name": name,
                "prefix": prefix,
                "scopes": scopes,
                "expires_at": expires_at.isoformat() if expires_at else None,
            },
            user_id=created_by_user.id if created_by_user else None,
        )

        await session.commit()
        await session.refresh(api_key_obj)

        return api_key_obj, raw_key

    @classmethod
    async def verify_api_key(
        cls,
        session: AsyncSession,
        raw_key: str,
        required_scope: str | None = None,
    ) -> ApiKey:
        """
        Authenticates an external API Key against its SHA-256 hash.
        Checks active status, expiration, revocation, and required scope.
        """
        if not raw_key or not raw_key.startswith("apl_"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Formato de API Key inválido.",
                headers={"WWW-Authenticate": "ApiKey"},
            )

        hashed_attempt = hashlib.sha256(raw_key.strip().encode("utf-8")).hexdigest()
        stmt = select(ApiKey).where(
            ApiKey.hashed_key == hashed_attempt,
            ApiKey.is_deleted.is_(False),
        )

        res = await session.execute(stmt)
        key_obj = res.scalar_one_or_none()

        auth_session = None
        temp_engine = None

        if not key_obj:
            from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
            from sqlalchemy.pool import NullPool

            from app.config import settings

            temp_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
            temp_maker = async_sessionmaker(temp_engine, class_=AsyncSession, expire_on_commit=False)
            auth_session = temp_maker()
            res_adm = await auth_session.execute(stmt)
            key_obj = res_adm.scalar_one_or_none()

        try:
            if not key_obj:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API Key inexistente o no reconocida.",
                    headers={"WWW-Authenticate": "ApiKey"},
                )

            if not key_obj.is_active or key_obj.revoked_at is not None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API Key revocada.",
                    headers={"WWW-Authenticate": "ApiKey"},
                )

            now = datetime.now(UTC)
            if key_obj.expires_at is not None and key_obj.expires_at < now:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="API Key expirada.",
                    headers={"WWW-Authenticate": "ApiKey"},
                )

            if required_scope and required_scope not in key_obj.scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Alcance insuficiente: la clave de API carece del scope requerido '{required_scope}'.",
                )

            key_obj.last_used_at = now
            if auth_session is not None:
                await auth_session.commit()
            else:
                await session.commit()

            return key_obj
        finally:
            if auth_session is not None:
                await auth_session.close()
            if temp_engine is not None:
                await temp_engine.dispose()

    @classmethod
    async def revoke_api_key(
        cls,
        session: AsyncSession,
        tenant_id: uuid.UUID,
        key_id: uuid.UUID,
        revoked_by_user: User,
    ) -> ApiKey:
        """Revokes an API Key, immediately disabling external access."""
        stmt = select(ApiKey).where(
            ApiKey.id == key_id,
            ApiKey.organization_id == tenant_id,
            ApiKey.is_deleted.is_(False),
        )
        res = await session.execute(stmt)
        key_obj = res.scalar_one_or_none()
        if not key_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="API Key no encontrada")

        before_state: dict[str, Any] = {"is_active": key_obj.is_active, "revoked_at": key_obj.revoked_at.isoformat() if key_obj.revoked_at else None}

        key_obj.is_active = False
        key_obj.revoked_at = datetime.now(UTC)

        after_state: dict[str, Any] = {"is_active": False, "revoked_at": key_obj.revoked_at.isoformat()}

        await AuditService.record_mutation(
            session=session,
            tenant_id=tenant_id,
            action="REVOKE_API_KEY",
            resource_name="api_keys",
            resource_id=str(key_id),
            before_state=before_state,
            after_state=after_state,
            user_id=revoked_by_user.id,
        )

        await session.commit()
        await session.refresh(key_obj)
        return key_obj
