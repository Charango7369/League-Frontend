"""Centralized Immutable Audit Service.

Guarantees non-repudiation and regulatory compliance for critical mutations:
- Role & Permission assignments
- Match scores & status transitions
- Disciplinary sanctions
- Financial transactions & Inscription payments

Features:
- Exact state diffing (before_state vs after_state)
- Recursive redaction of sensitive credentials and PII (DNI, medical records, bank accounts)
- Transactional atomicity: if audit log generation fails, the entire transaction rolls back
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.models.user import AuditLog

# Canonical set of sensitive keys that MUST be redacted from audit payloads
SENSITIVE_AUDIT_KEYS = frozenset({
    "dni",
    "document_id",
    "medical_notes",
    "ficha_medica",
    "bank_account",
    "cuenta_bancaria",
    "password",
    "password_hash",
    "hashed_password",
    "token",
    "secret",
    "guardian_phone",
    "telefono_tutor",
    "jwt_secret",
    "api_key",
    "raw_key",
    "hashed_key",
    "totp_secret",
    "mfa_secret",
    "mfa_secret_encrypted",
    "mfa_backup_codes",
    "backup_codes",
    "totp_code",
    "code",
})


def redact_sensitive_payload(data: Any) -> Any:
    """Recursively redacts sensitive keys from audit log dictionaries or lists."""
    if isinstance(data, dict):
        cleaned: dict[str, Any] = {}
        for k, v in data.items():
            key_lower = str(k).lower().strip()
            if key_lower in SENSITIVE_AUDIT_KEYS:
                cleaned[k] = "[REDACTED]"
            elif isinstance(v, (dict, list)):
                cleaned[k] = redact_sensitive_payload(v)
            else:
                cleaned[k] = v
        return cleaned
    elif isinstance(data, list):
        return [redact_sensitive_payload(item) for item in data]
    return data


class AuditService:
    """Enterprise service for generating immutable audit log records."""

    @classmethod
    async def record_mutation(
        cls,
        session: AsyncSession,
        tenant_id: uuid.UUID,
        action: str,
        resource_name: str,
        resource_id: str | None = None,
        before_state: dict[str, Any] | None = None,
        after_state: dict[str, Any] | None = None,
        user_id: uuid.UUID | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditLog:
        """
        Creates an AuditLog entry with sanitized before/after state in the current transaction.

        If session.flush() fails, the active transaction is aborted, guaranteeing
        that no business mutation can be committed without its corresponding audit trail.
        """
        clean_before = redact_sensitive_payload(before_state) if before_state is not None else None
        clean_after = redact_sensitive_payload(after_state) if after_state is not None else None

        audit_entry = AuditLog(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            user_id=user_id,
            action=action.upper(),
            resource_name=resource_name.lower(),
            resource_id=str(resource_id) if resource_id is not None else None,
            before_state=clean_before,
            after_state=clean_after,
            ip_address=ip_address,
            user_agent=user_agent,
            created_at=datetime.now(UTC),
        )

        session.add(audit_entry)
        # Flush to enforce constraints and fail early within the current transaction
        await session.flush()
        return audit_entry
