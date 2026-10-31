import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import pyotp
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.services.audit_service import AuditService
from app.domain.permissions import SystemRole
from app.infrastructure.encryption import decrypt_field, encrypt_field
from app.infrastructure.models.user import User

PRIVILEGED_ROLES = frozenset({
    SystemRole.SUPER_ADMIN.value,
    SystemRole.ADMIN_LIGA.value,
    SystemRole.GESTOR_FINANCIERO.value,
})


class MFAService:
    """Enterprise MFA Service managing TOTP enrollment, encryption at rest, and backup codes."""

    @staticmethod
    def is_privileged_role(role: str) -> bool:
        return role in PRIVILEGED_ROLES

    @classmethod
    async def setup_mfa(cls, session: AsyncSession, user: User, tenant_id: uuid.UUID) -> dict[str, Any]:
        """
        Generates a new TOTP secret and 8 single-use backup codes.
        Stores secret encrypted at rest and backup codes as SHA-256 hashes.
        Returns plaintext secret and backup codes ONCE for display to the user.
        """
        raw_secret = pyotp.random_base32()
        encrypted_secret = encrypt_field(raw_secret)

        # Generate 8 single-use backup codes (e.g. "A1B2-C3D4")
        plaintext_backup_codes: list[str] = []
        hashed_backup_codes: list[str] = []
        for _ in range(8):
            part1 = secrets.token_hex(2).upper()
            part2 = secrets.token_hex(2).upper()
            code_str = f"{part1}-{part2}"
            plaintext_backup_codes.append(code_str)
            code_hash = hashlib.sha256(code_str.encode("utf-8")).hexdigest()
            hashed_backup_codes.append(code_hash)

        user.mfa_secret_encrypted = encrypted_secret
        user.mfa_backup_codes = hashed_backup_codes
        user.mfa_failed_attempts = 0
        user.mfa_locked_until = None

        await AuditService.record_mutation(
            session=session,
            tenant_id=tenant_id,
            action="MFA_SETUP_INITIATED",
            resource_name="users",
            resource_id=str(user.id),
            before_state=None,
            after_state={"user_id": str(user.id), "mfa_initialized": True},
            user_id=user.id,
        )

        await session.commit()
        await session.refresh(user)

        totp = pyotp.TOTP(raw_secret)
        provisioning_uri = totp.provisioning_uri(
            name=user.email,
            issuer_name="ApoloDigital League"
        )

        return {
            "secret": raw_secret,
            "provisioning_uri": provisioning_uri,
            "backup_codes": plaintext_backup_codes,
        }

    @classmethod
    async def enable_mfa(
        cls,
        session: AsyncSession,
        user: User,
        code: str,
        tenant_id: uuid.UUID
    ) -> bool:
        """Confirms initial TOTP verification code to officially enable MFA on the user account."""
        if not user.mfa_secret_encrypted:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MFA no ha sido configurado previamente. Inicie el proceso con /setup.",
            )

        raw_secret = decrypt_field(user.mfa_secret_encrypted)
        if not raw_secret:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Error al desencriptar el secreto TOTP.",
            )

        totp = pyotp.TOTP(raw_secret)
        if not totp.verify(code.strip(), valid_window=1):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Código TOTP inválido. Verifique la hora de su dispositivo.",
            )

        user.mfa_enabled = True
        user.mfa_failed_attempts = 0
        user.mfa_locked_until = None

        await AuditService.record_mutation(
            session=session,
            tenant_id=tenant_id,
            action="MFA_ENABLED",
            resource_name="users",
            resource_id=str(user.id),
            before_state={"mfa_enabled": False},
            after_state={"mfa_enabled": True},
            user_id=user.id,
        )

        await session.commit()
        await session.refresh(user)
        return True

    @classmethod
    async def verify_mfa_code(
        cls,
        session: AsyncSession,
        user: User,
        code: str | None = None,
        backup_code: str | None = None,
        tenant_id: uuid.UUID | None = None,
    ) -> bool:
        """
        Validates a TOTP code or single-use backup code.
        If a backup code is verified, it is immediately consumed and deleted from storage.
        Enforces maximum 5 failed attempts lockout.
        """
        now = datetime.now(UTC)
        if user.mfa_failed_attempts >= 5 and user.mfa_locked_until and user.mfa_locked_until > now:
            remaining = int((user.mfa_locked_until - now).total_seconds())
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Demasiados intentos fallidos de MFA. Cuenta bloqueada temporalmente por {remaining} segundos.",
            )

        is_valid = False
        method_used = "TOTP"

        if code:
            if not user.mfa_secret_encrypted:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="MFA no habilitado")
            raw_secret = decrypt_field(user.mfa_secret_encrypted)
            if raw_secret:
                totp = pyotp.TOTP(raw_secret)
                is_valid = totp.verify(code.strip(), valid_window=1)

        elif backup_code:
            clean_bc = backup_code.strip().upper()
            bc_hash = hashlib.sha256(clean_bc.encode("utf-8")).hexdigest()
            current_codes = list(user.mfa_backup_codes or [])
            if bc_hash in current_codes:
                is_valid = True
                method_used = "BACKUP_CODE"
                # Consume backup code: single-use strictly enforced
                current_codes.remove(bc_hash)
                user.mfa_backup_codes = current_codes

        if not is_valid:
            user.mfa_failed_attempts = (user.mfa_failed_attempts or 0) + 1
            if user.mfa_failed_attempts >= 5:
                user.mfa_locked_until = now + timedelta(minutes=15)
            await session.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Código MFA o código de respaldo inválido o ya utilizado.",
            )

        # Reset failed attempts on success
        user.mfa_failed_attempts = 0
        user.mfa_locked_until = None

        if tenant_id:
            await AuditService.record_mutation(
                session=session,
                tenant_id=tenant_id,
                action="MFA_AUTHENTICATION_SUCCESS",
                resource_name="users",
                resource_id=str(user.id),
                before_state=None,
                after_state={"method": method_used, "user_id": str(user.id)},
                user_id=user.id,
            )

        await session.commit()
        await session.refresh(user)
        return True
