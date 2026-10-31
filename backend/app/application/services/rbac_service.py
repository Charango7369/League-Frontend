"""RBAC Service for ApoloDigital League.

Handles permission resolution, scope hierarchy, role assignments,
and anti-privilege escalation checks.
"""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.services.audit_service import AuditService
from app.domain.permissions import ScopeType, SystemRole
from app.infrastructure.models.match import Match
from app.infrastructure.models.membership import TenantMembership
from app.infrastructure.models.player import Player
from app.infrastructure.models.rbac import Permission, Role, RolePermission, UserRole
from app.infrastructure.models.user import User


class RBACService:
    @staticmethod
    async def get_user_effective_permissions(
        db: AsyncSession,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        """Returns all active permission assignments for a user within a tenant with their scopes."""
        stmt = (
            select(UserRole)
            .where(
                UserRole.user_id == user_id,
                UserRole.tenant_id == tenant_id,
            )
            .options(
                selectinload(UserRole.role).selectinload(Role.permissions)
            )
        )
        res = await db.execute(stmt)
        user_roles = res.scalars().all()

        assignments = []
        for ur in user_roles:
            for perm in ur.role.permissions:
                assignments.append({
                    "permission": perm.name,
                    "module": perm.module,
                    "action": perm.action,
                    "role_slug": ur.role.slug,
                    "scope_type": ur.scope_type,
                    "scope_id": ur.scope_id,
                })
        return assignments

    @staticmethod
    async def user_has_permission_in_scopes(
        db: AsyncSession,
        user: User,
        tenant_id: uuid.UUID,
        permission_name: str,
        target_scopes: list[tuple[str, uuid.UUID | None]]
    ) -> bool:
        """
        Evaluates whether `user` holds `permission_name` for `tenant_id`
        in any of the given `target_scopes` according to scope hierarchy:
        LEAGUE ⊃ TOURNAMENT ⊃ TEAM.
        """
        # Super Admin has unconditional authorization across all tenants
        if user.role == SystemRole.SUPER_ADMIN.value:
            return True

        # Always include LEAGUE scope in candidate scopes because LEAGUE scope grants everything in the tenant
        effective_scopes = list(target_scopes)
        if ("LEAGUE", None) not in effective_scopes:
            effective_scopes.append(("LEAGUE", None))

        # Query user_roles matching user, tenant, and the role containing permission_name
        stmt = (
            select(UserRole.scope_type, UserRole.scope_id)
            .join(Role, UserRole.role_id == Role.id)
            .join(RolePermission, Role.id == RolePermission.role_id)
            .join(Permission, RolePermission.permission_id == Permission.id)
            .where(
                UserRole.user_id == user.id,
                UserRole.tenant_id == tenant_id,
                Permission.name == permission_name,
            )
        )
        res = await db.execute(stmt)
        granted_tuples = res.fetchall()

        for g_scope_type, g_scope_id in granted_tuples:
            for target_type, target_id in effective_scopes:
                # If granted at LEAGUE level, it satisfies any scope
                if g_scope_type == ScopeType.LEAGUE.value:
                    return True
                # If granted at TOURNAMENT level, it satisfies if tournament IDs match
                if g_scope_type == target_type and g_scope_id is not None and g_scope_id == target_id:
                    return True
                # If granted at TEAM level, it satisfies if team IDs match
                if g_scope_type == ScopeType.TEAM.value and target_type == ScopeType.TEAM.value and g_scope_id == target_id:
                    return True

        # Fallback for unmigrated or direct-role assignments in tests/legacy
        if not granted_tuples and user.role:
            legacy_role_mapping = {
                "ORGANIZATION_ADMIN": SystemRole.ADMIN_LIGA,
                "ADMIN_LIGA": SystemRole.ADMIN_LIGA,
                "TOURNAMENT_ADMIN": SystemRole.ADMIN_LIGA,
                "REFEREE": SystemRole.ARBITRO,
                "ARBITRO": SystemRole.ARBITRO,
                "TEAM_MANAGER": SystemRole.DELEGADO_EQUIPO,
                "DELEGADO_EQUIPO": SystemRole.DELEGADO_EQUIPO,
                "PLAYER": SystemRole.JUGADOR,
                "JUGADOR": SystemRole.JUGADOR,
                "PUBLIC_USER": SystemRole.ESPECTADOR,
                "ESPECTADOR": SystemRole.ESPECTADOR,
            }
            mapped_sys_role = legacy_role_mapping.get(user.role)
            if mapped_sys_role:
                from app.domain.permissions import ROLE_PERMISSIONS_MATRIX
                perms_of_role = ROLE_PERMISSIONS_MATRIX.get(mapped_sys_role, [])
                if any(p.value == permission_name for p in perms_of_role):
                    return True

        return False

    @staticmethod
    async def resolve_resource_scopes(
        db: AsyncSession,
        tenant_id: uuid.UUID,
        resource_params: dict[str, Any]
    ) -> list[tuple[str, uuid.UUID | None]]:
        """
        Resolves the contextual scope hierarchy for an operation.
        Returns a list of (scope_type, scope_id) tuples.
        """
        scopes: list[tuple[str, uuid.UUID | None]] = [("LEAGUE", None)]

        # 1. Direct tournament ID
        tourn_id_val = resource_params.get("tournament_id")
        if tourn_id_val:
            try:
                t_uuid = uuid.UUID(str(tourn_id_val))
                scopes.append((ScopeType.TOURNAMENT.value, t_uuid))
            except ValueError:
                pass

        # 2. Match ID -> resolves tournament and teams
        match_id_val = resource_params.get("match_id")
        if match_id_val:
            try:
                m_uuid = uuid.UUID(str(match_id_val))
                match_res = await db.execute(
                    select(Match).where(Match.id == m_uuid, Match.organization_id == tenant_id)
                )
                match = match_res.scalar_one_or_none()
                if match:
                    if match.tournament_id:
                        scopes.append((ScopeType.TOURNAMENT.value, match.tournament_id))
                    if match.home_team_id:
                        scopes.append((ScopeType.TEAM.value, match.home_team_id))
                    if match.away_team_id:
                        scopes.append((ScopeType.TEAM.value, match.away_team_id))
            except ValueError:
                pass

        # 3. Direct team ID
        team_id_val = resource_params.get("team_id")
        if team_id_val:
            try:
                tm_uuid = uuid.UUID(str(team_id_val))
                scopes.append((ScopeType.TEAM.value, tm_uuid))
            except ValueError:
                pass

        # 4. Direct player ID -> resolves team
        player_id_val = resource_params.get("player_id")
        if player_id_val:
            try:
                p_uuid = uuid.UUID(str(player_id_val))
                p_res = await db.execute(
                    select(Player).where(Player.id == p_uuid, Player.organization_id == tenant_id)
                )
                player = p_res.scalar_one_or_none()
                if player and player.team_id:
                    scopes.append((ScopeType.TEAM.value, player.team_id))
            except ValueError:
                pass

        return scopes

    @staticmethod
    async def assign_user_role(
        db: AsyncSession,
        actor: User,
        tenant_id: uuid.UUID,
        target_user_id: uuid.UUID,
        role_id: uuid.UUID,
        scope_type: str,
        scope_id: uuid.UUID | None
    ) -> UserRole:
        """
        Assigns a role to a user within a scope with strict Anti-Escalation verification:
        1. Actor cannot assign a role to themselves.
        2. Actor must possess all permissions granted by the role in this tenant, or be SUPER_ADMIN.
        3. Target user must have an active membership in the tenant.
        4. Scope validity checks (scope_id must be None for LEAGUE, non-None for TOURNAMENT/TEAM).
        """
        # Anti-escalation rule 1: Cannot self-assign
        if actor.id == target_user_id:
            raise ValueError("Anti-escalada: No puedes asignarte o modificar roles a ti mismo.")

        # Scope format validation
        if scope_type == ScopeType.LEAGUE.value and scope_id is not None:
            raise ValueError("El alcance LEAGUE no debe especificar scope_id.")
        if scope_type in (ScopeType.TOURNAMENT.value, ScopeType.TEAM.value) and scope_id is None:
            raise ValueError(f"El alcance {scope_type} requiere un scope_id válido.")

        # Target user membership check
        mem_res = await db.execute(
            select(TenantMembership).where(
                TenantMembership.user_id == target_user_id,
                TenantMembership.tenant_id == tenant_id,
                TenantMembership.status == "ACTIVE"
            )
        )
        if not mem_res.scalar_one_or_none():
            raise ValueError("El usuario objetivo no tiene una membresía activa en esta organización.")

        # Verify role exists and is accessible
        role_res = await db.execute(
            select(Role).where(
                Role.id == role_id,
                (Role.organization_id.is_(None)) | (Role.organization_id == tenant_id)
            ).options(selectinload(Role.permissions))
        )
        role = role_res.scalar_one_or_none()
        if not role:
            raise ValueError("El rol solicitado no existe o no pertenece a esta organización.")

        # Anti-escalation rule 2: Actor cannot grant permissions they do not possess
        if actor.role != SystemRole.SUPER_ADMIN.value:
            # Get actor's permissions in this tenant
            actor_perms = await RBACService.get_user_effective_permissions(db, actor.id, tenant_id)
            actor_perm_names = {p["permission"] for p in actor_perms}
            required_perms = {p.name for p in role.permissions}

            missing = required_perms - actor_perm_names
            if missing:
                raise ValueError(
                    f"Anti-escalada: No puedes otorgar un rol con permisos que no posees: {list(missing)[:3]}"
                )

        # Check for existing duplicate assignment
        existing_res = await db.execute(
            select(UserRole).where(
                UserRole.user_id == target_user_id,
                UserRole.role_id == role_id,
                UserRole.tenant_id == tenant_id,
                UserRole.scope_type == scope_type,
                UserRole.scope_id == scope_id,
            )
        )
        existing = existing_res.scalar_one_or_none()
        if existing:
            return existing

        new_assignment = UserRole(
            id=uuid.uuid4(),
            user_id=target_user_id,
            role_id=role_id,
            tenant_id=tenant_id,
            scope_type=scope_type,
            scope_id=scope_id,
        )
        db.add(new_assignment)

        # Audit mutation trail
        after_state = {
            "assignment_id": str(new_assignment.id),
            "user_id": str(target_user_id),
            "role_id": str(role_id),
            "role_name": role.name,
            "scope_type": scope_type,
            "scope_id": str(scope_id) if scope_id else None,
        }
        await AuditService.record_mutation(
            session=db,
            tenant_id=tenant_id,
            action="ASSIGN_ROLE",
            resource_name="user_roles",
            resource_id=str(new_assignment.id),
            before_state=None,
            after_state=after_state,
            user_id=actor.id,
        )

        await db.commit()
        await db.refresh(new_assignment)
        return new_assignment

    @staticmethod
    async def revoke_user_role(
        db: AsyncSession,
        actor: User,
        tenant_id: uuid.UUID,
        user_role_id: uuid.UUID
    ) -> None:
        """Revokes a user role assignment with anti-tampering protection."""
        ur_res = await db.execute(
            select(UserRole).where(
                UserRole.id == user_role_id,
                UserRole.tenant_id == tenant_id,
            )
        )
        ur = ur_res.scalar_one_or_none()
        if not ur:
            raise ValueError("Asignación de rol no encontrada en esta organización.")

        if ur.user_id == actor.id and actor.role != SystemRole.SUPER_ADMIN.value:
            raise ValueError("No puedes revocar tus propios roles.")

        before_state = {
            "assignment_id": str(ur.id),
            "user_id": str(ur.user_id),
            "role_id": str(ur.role_id),
            "scope_type": ur.scope_type,
            "scope_id": str(ur.scope_id) if ur.scope_id else None,
        }
        await AuditService.record_mutation(
            session=db,
            tenant_id=tenant_id,
            action="REVOKE_ROLE",
            resource_name="user_roles",
            resource_id=str(ur.id),
            before_state=before_state,
            after_state=None,
            user_id=actor.id,
        )

        await db.delete(ur)
        await db.commit()
