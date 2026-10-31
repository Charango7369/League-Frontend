"""Centralized Field-Level Security (FLS) Service.

Enforces dynamic field masking and redaction for sensitive athlete and financial data:
- document_id (DNI / CI)
- medical_notes (Ficha médica / estado de salud)
- guardian_phone (Contacto de tutor / emergencia)
- bank_account (Cuenta bancaria / datos de cobro)

Rules are evaluated dynamically based on the caller's AuthContext, assigned roles,
and scope hierarchy (LEAGUE ⊃ TOURNAMENT ⊃ TEAM).
"""

import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.dtos.player import PlayerResponse
from app.domain.permissions import ScopeType, SystemRole
from app.infrastructure.models.player import Player
from app.infrastructure.models.rbac import UserRole
from app.presentation.dependencies.auth_deps import AuthContext


def mask_string(val: str | None, visible_trailing_chars: int = 4, mask_char: str = "*") -> str | None:
    """Masks a sensitive string, preserving only trailing characters if sufficiently long."""
    if not val:
        return None
    val_str = str(val).strip()
    if len(val_str) <= visible_trailing_chars:
        return mask_char * 4
    masked_prefix = mask_char * min(len(val_str) - visible_trailing_chars, 4)
    return f"{masked_prefix}{val_str[-visible_trailing_chars:]}"


class FLSService:
    """Centralized FLS evaluation and enforcement service."""

    @classmethod
    async def get_user_assigned_roles(
        cls, db: AsyncSession, user_id: uuid.UUID, tenant_id: uuid.UUID
    ) -> list[UserRole]:
        """Fetches active user role assignments within the tenant with preloaded permissions."""
        stmt = (
            select(UserRole)
            .where(
                UserRole.user_id == user_id,
                UserRole.tenant_id == tenant_id,
                UserRole.is_deleted.is_(False),
            )
            .options(selectinload(UserRole.role))
        )
        res = await db.execute(stmt)
        return list(res.scalars().all())

    @classmethod
    def can_view_medical_notes(
        cls,
        user_roles: list[UserRole],
        player_team_id: uuid.UUID,
        is_super_admin: bool,
    ) -> bool:
        """Determines if the caller is authorized to view medical records."""
        if is_super_admin:
            return True

        for ur in user_roles:
            role_slug = getattr(ur.role, "slug", None) or getattr(ur.role, "name", "")
            # League admins can view all medical notes in the tenant
            if role_slug in (SystemRole.ADMIN_LIGA.value, "Admin Liga") and ur.scope_type == ScopeType.LEAGUE:
                return True
            # Team delegates can view medical notes of players in their team
            if role_slug in (SystemRole.DELEGADO_EQUIPO.value, "Delegado Equipo"):
                if ur.scope_type == ScopeType.TEAM and ur.scope_id == player_team_id:
                    return True
                if ur.scope_type == ScopeType.LEAGUE:
                    return True
        return False

    @classmethod
    def can_view_document_id(
        cls,
        user_roles: list[UserRole],
        player_team_id: uuid.UUID,
        is_super_admin: bool,
    ) -> bool:
        """Determines if the caller is authorized to view full CI/DNI."""
        if is_super_admin:
            return True

        for ur in user_roles:
            role_slug = getattr(ur.role, "slug", None) or getattr(ur.role, "name", "")
            if role_slug in (SystemRole.ADMIN_LIGA.value, "Admin Liga") and ur.scope_type == ScopeType.LEAGUE:
                return True
            if role_slug in (SystemRole.DELEGADO_EQUIPO.value, "Delegado Equipo"):
                if ur.scope_type == ScopeType.TEAM and ur.scope_id == player_team_id:
                    return True
                if ur.scope_type == ScopeType.LEAGUE:
                    return True
        return False

    @classmethod
    def can_view_bank_account(
        cls,
        user_roles: list[UserRole],
        player_team_id: uuid.UUID,
        is_super_admin: bool,
    ) -> bool:
        """Determines if the caller is authorized to view bank account numbers."""
        if is_super_admin:
            return True

        for ur in user_roles:
            role_slug = getattr(ur.role, "slug", None) or getattr(ur.role, "name", "")
            if (
                role_slug in (SystemRole.ADMIN_LIGA.value, "Admin Liga", SystemRole.GESTOR_FINANCIERO.value, "Gestor Financiero")
                and ur.scope_type == ScopeType.LEAGUE
            ):
                return True
            if (
                role_slug in (SystemRole.DELEGADO_EQUIPO.value, "Delegado Equipo")
                and ur.scope_type == ScopeType.TEAM
                and ur.scope_id == player_team_id
            ):
                return True
        return False

    @classmethod
    async def mask_player(
        cls,
        player: Player,
        auth: AuthContext,
        db: AsyncSession,
    ) -> PlayerResponse:
        """Applies FLS to a single Player model, returning a secured PlayerResponse."""
        user_roles = await cls.get_user_assigned_roles(db, auth.user_id, auth.tenant_id)
        is_super = auth.role == SystemRole.SUPER_ADMIN

        # Check permissions for each field
        allow_medical = cls.can_view_medical_notes(user_roles, player.team_id, is_super)
        allow_doc = cls.can_view_document_id(user_roles, player.team_id, is_super)
        allow_bank = cls.can_view_bank_account(user_roles, player.team_id, is_super)

        # Build secured response
        doc_id = player.document_id if allow_doc else mask_string(player.document_id)
        med_notes = player.medical_notes if allow_medical else None
        guard_phone = player.guardian_phone if allow_doc else mask_string(player.guardian_phone)
        bank_acc = player.bank_account if allow_bank else mask_string(player.bank_account)

        return PlayerResponse(
            id=player.id,
            team_id=player.team_id,
            first_name=player.first_name,
            last_name=player.last_name,
            jersey_number=player.jersey_number,
            position=player.position,
            photo_url=player.photo_url,
            is_eligible=player.is_eligible,
            date_of_birth=player.date_of_birth,
            document_id=doc_id,
            medical_notes=med_notes,
            guardian_phone=guard_phone,
            bank_account=bank_acc,
        )

    @classmethod
    async def mask_player_list(
        cls,
        players: Iterable[Player],
        auth: AuthContext,
        db: AsyncSession,
    ) -> list[PlayerResponse]:
        """Applies FLS to an iterable of Player models in a single batch."""
        user_roles = await cls.get_user_assigned_roles(db, auth.user_id, auth.tenant_id)
        is_super = auth.role == SystemRole.SUPER_ADMIN

        results: list[PlayerResponse] = []
        for player in players:
            allow_medical = cls.can_view_medical_notes(user_roles, player.team_id, is_super)
            allow_doc = cls.can_view_document_id(user_roles, player.team_id, is_super)
            allow_bank = cls.can_view_bank_account(user_roles, player.team_id, is_super)

            doc_id = player.document_id if allow_doc else mask_string(player.document_id)
            med_notes = player.medical_notes if allow_medical else None
            guard_phone = player.guardian_phone if allow_doc else mask_string(player.guardian_phone)
            bank_acc = player.bank_account if allow_bank else mask_string(player.bank_account)

            results.append(
                PlayerResponse(
                    id=player.id,
                    team_id=player.team_id,
                    first_name=player.first_name,
                    last_name=player.last_name,
                    jersey_number=player.jersey_number,
                    position=player.position,
                    photo_url=player.photo_url,
                    is_eligible=player.is_eligible,
                    date_of_birth=player.date_of_birth,
                    document_id=doc_id,
                    medical_notes=med_notes,
                    guardian_phone=guard_phone,
                    bank_account=bank_acc,
                )
            )
        return results
