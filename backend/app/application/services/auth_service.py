import uuid
from datetime import UTC
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.auth import LoginRequest, RegisterRequest, TokenResponse
from app.domain.models.enums import RoleType
from app.domain.permissions import ScopeType, SystemRole
from app.infrastructure.database import AsyncAdminSessionLocal
from app.infrastructure.models.membership import TenantMembership
from app.infrastructure.models.organization import Organization
from app.infrastructure.models.rbac import Role, UserRole
from app.infrastructure.models.user import User
from app.infrastructure.repositories.organization_repository import OrganizationRepository
from app.infrastructure.repositories.user_repository import UserRepository
from app.infrastructure.security import create_access_token, create_refresh_token, get_password_hash, verify_password


class AuthService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.user_repo = UserRepository(session)
        self.org_repo = OrganizationRepository(session)

    async def register(self, data: RegisterRequest) -> TokenResponse:
        existing_user = await self.user_repo.get_by_email(data.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico ya se encuentra registrado."
            )

        existing_org = await self.org_repo.get_by_slug(data.organization_slug)
        if existing_org:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El identificador de organización (slug) ya está en uso."
            )

        # Create Organization
        org = Organization(
            name=data.organization_name,
            slug=data.organization_slug.lower().strip()
        )
        created_org = await self.org_repo.create_with_subscription(org, plan="FREE")

        # Create Admin User
        user = User(
            organization_id=created_org.id,
            email=data.email.lower().strip(),
            password_hash=get_password_hash(data.password),
            full_name=data.full_name,
            phone=data.phone,
            role=RoleType.ORGANIZATION_ADMIN.value,
            is_active=True
        )
        created_user = await self.user_repo.create(user)

        # Create Active Tenant Membership
        membership = TenantMembership(
            user_id=created_user.id,
            tenant_id=created_org.id,
            role=created_user.role,
            status="ACTIVE"
        )
        self.session.add(membership)

        # Assign default ADMIN_LIGA role at LEAGUE scope
        admin_role_res = await self.session.execute(
            select(Role).where(Role.slug == SystemRole.ADMIN_LIGA.value, Role.organization_id.is_(None))
        )
        admin_role = admin_role_res.scalar_one_or_none()
        if admin_role:
            ur = UserRole(
                id=uuid.uuid4(),
                user_id=created_user.id,
                role_id=admin_role.id,
                tenant_id=created_org.id,
                scope_type=ScopeType.LEAGUE.value,
                scope_id=None,
            )
            self.session.add(ur)

        await self.session.commit()

        # Generate Tokens with tenant_id exclusively
        token_payload = {
            "sub": str(created_user.id),
            "email": created_user.email,
            "role": created_user.role,
            "tenant_id": str(created_org.id),
            "org_id": str(created_org.id),
            "org_slug": created_org.slug
        }

        access_token = create_access_token(token_payload)
        refresh_token = create_refresh_token(token_payload)

        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=60 * 24,
            user_id=created_user.id,
            email=created_user.email,
            role=created_user.role,
            organization_id=created_org.id,
            organization_slug=created_org.slug,
            tenant_id=created_org.id
        )

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await self.user_repo.get_by_email(data.email)
        if not user or not verify_password(data.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credenciales de acceso inválidas."
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La cuenta de usuario se encuentra suspendida."
            )

        # Query user active memberships
        stmt = select(TenantMembership).where(
            TenantMembership.user_id == user.id,
            TenantMembership.status == "ACTIVE",
            TenantMembership.is_deleted.is_(False)
        )
        res = await self.session.execute(stmt)
        memberships = list(res.scalars().all())

        active_tenant_id = None
        active_role = user.role
        org_slug = None

        if memberships:
            # Prefer membership matching user.organization_id, otherwise first active membership
            active_membership = next(
                (m for m in memberships if m.tenant_id == user.organization_id),
                memberships[0]
            )
            active_tenant_id = active_membership.tenant_id
            active_role = active_membership.role or user.role
            org = await self.org_repo.get_by_id(active_tenant_id)
            if org:
                org_slug = org.slug
        elif user.organization_id:
            active_tenant_id = user.organization_id
            org = await self.org_repo.get_by_id(user.organization_id)
            if org:
                org_slug = org.slug

        is_privileged = active_role in ("SUPER_ADMIN", "ADMIN_LIGA", "GESTOR_FINANCIERO")
        mfa_required = is_privileged or getattr(user, "mfa_enabled", False)
        mfa_verified = False if mfa_required else True

        token_payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": active_role,
            "tenant_id": str(active_tenant_id) if active_tenant_id else None,
            "org_id": str(active_tenant_id) if active_tenant_id else None,
            "org_slug": org_slug,
            "mfa_required": mfa_required,
            "mfa_verified": mfa_verified,
        }

        return TokenResponse(
            access_token=create_access_token(token_payload),
            refresh_token=create_refresh_token(token_payload),
            expires_in=60 * 24,
            user_id=user.id,
            email=user.email,
            role=active_role,
            organization_id=active_tenant_id,
            organization_slug=org_slug,
            tenant_id=active_tenant_id,
            mfa_required=mfa_required,
            mfa_verified=mfa_verified,
        )

    async def switch_tenant(self, user_id: uuid.UUID, target_tenant_id: uuid.UUID) -> TokenResponse:
        """
        Validates active membership for the requested tenant and emits a fresh token.
        Uses admin session for the cross-tenant membership validation task.
        Never accepts tenant_id from body/query as truth without validating membership.
        """
        async with AsyncAdminSessionLocal() as admin_db:
            user_repo = UserRepository(admin_db)
            org_repo = OrganizationRepository(admin_db)

            user = await user_repo.get_by_id(user_id)
            if not user or not user.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuario no encontrado o inactivo"
                )

            # Check membership in target tenant
            stmt = select(TenantMembership).where(
                TenantMembership.user_id == user_id,
                TenantMembership.tenant_id == target_tenant_id,
                TenantMembership.status == "ACTIVE",
                TenantMembership.is_deleted.is_(False)
            )
            res = await admin_db.execute(stmt)
            membership = res.scalar_one_or_none()

            if not membership and user.role != RoleType.SUPER_ADMIN.value:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No posee una membresía activa en la organización solicitada"
                )

            # Query Organization
            org = await org_repo.get_by_id(target_tenant_id)
            if not org or org.is_deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organización destino no encontrada"
                )

            active_role = membership.role if membership else user.role

            is_privileged = active_role in ("SUPER_ADMIN", "ADMIN_LIGA", "GESTOR_FINANCIERO")
            mfa_required = is_privileged or getattr(user, "mfa_enabled", False)
            mfa_verified = False if mfa_required else True

            token_payload = {
                "sub": str(user.id),
                "email": user.email,
                "role": active_role,
                "tenant_id": str(org.id),
                "org_id": str(org.id),
                "org_slug": org.slug,
                "mfa_required": mfa_required,
                "mfa_verified": mfa_verified,
            }

            return TokenResponse(
                access_token=create_access_token(token_payload),
                refresh_token=create_refresh_token(token_payload),
                expires_in=60 * 24,
                user_id=user.id,
                email=user.email,
                role=active_role,
                organization_id=org.id,
                organization_slug=org.slug,
                tenant_id=org.id,
                mfa_required=mfa_required,
                mfa_verified=mfa_verified,
            )

    async def setup_mfa(self, user_id: uuid.UUID, tenant_id: uuid.UUID) -> dict[str, Any]:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        from app.application.services.mfa_service import MFAService
        return await MFAService.setup_mfa(self.session, user, tenant_id)

    async def enable_mfa(self, user_id: uuid.UUID, code: str, tenant_id: uuid.UUID) -> bool:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        from app.application.services.mfa_service import MFAService
        return await MFAService.enable_mfa(self.session, user, code, tenant_id)

    async def verify_mfa(
        self,
        user_id: uuid.UUID,
        code: str | None = None,
        backup_code: str | None = None,
        tenant_id: uuid.UUID | None = None,
    ) -> TokenResponse:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
        from datetime import datetime

        from app.application.services.mfa_service import MFAService
        await MFAService.verify_mfa_code(
            session=self.session,
            user=user,
            code=code,
            backup_code=backup_code,
            tenant_id=tenant_id,
        )

        now_iso = datetime.now(UTC).isoformat()
        token_payload = {
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
            "tenant_id": str(tenant_id) if tenant_id else str(user.organization_id) if user.organization_id else None,
            "org_id": str(tenant_id) if tenant_id else str(user.organization_id) if user.organization_id else None,
            "mfa_required": True,
            "mfa_verified": True,
            "mfa_verified_at": now_iso,
        }

        return TokenResponse(
            access_token=create_access_token(token_payload),
            refresh_token=create_refresh_token(token_payload),
            expires_in=60 * 24,
            user_id=user.id,
            email=user.email,
            role=user.role,
            organization_id=tenant_id or user.organization_id,
            organization_slug=None,
            tenant_id=tenant_id or user.organization_id,
            mfa_required=True,
            mfa_verified=True,
        )
