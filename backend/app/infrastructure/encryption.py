"""Symmetric Encryption at Rest for Sensitive Database Fields.

Uses cryptography.fernet.MultiFernet (AES-128-CBC with HMAC-SHA256 authenticated encryption).
Supports zero-downtime key rotation via MultiFernet fallback decryption.
"""

from typing import Any

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from sqlalchemy.types import String, Text, TypeDecorator

from app.config import settings

_cipher: MultiFernet | None = None


def get_fernet_cipher() -> MultiFernet:
    """Initializes or returns cached MultiFernet cipher with primary and rotation keys."""
    global _cipher
    if _cipher is None:
        primary_key = settings.FIELD_ENCRYPTION_KEY.strip().encode("utf-8")
        keys = [Fernet(primary_key)]
        for prev_key in settings.FIELD_ENCRYPTION_PREVIOUS_KEYS:
            pk = prev_key.strip()
            if pk:
                keys.append(Fernet(pk.encode("utf-8")))
        _cipher = MultiFernet(keys)
    return _cipher


def reset_fernet_cipher() -> None:
    """Forces re-initialization of cipher (useful in tests when settings change)."""
    global _cipher
    _cipher = None


def encrypt_field(value: str | None) -> str | None:
    """Encrypts plaintext string to url-safe base64 token using the primary key."""
    if value is None:
        return None
    cipher = get_fernet_cipher()
    return cipher.encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_field(value: str | None) -> str | None:
    """Decrypts url-safe base64 token to plaintext string using primary or previous keys."""
    if value is None:
        return None
    cipher = get_fernet_cipher()
    try:
        return cipher.decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        # If token is invalid or already plaintext (legacy fallback), return as is
        return value


def rotate_encrypted_field(value: str | None) -> str | None:
    """Re-encrypts ciphertext with the primary key if it was encrypted with an older key."""
    if value is None:
        return None
    cipher = get_fernet_cipher()
    try:
        return cipher.rotate(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return value


class EncryptedString(TypeDecorator[str | None]):
    """SQLAlchemy TypeDecorator for VARCHAR columns encrypted at rest."""

    impl = String
    cache_ok = True

    def __init__(self, length: int = 255, **kwargs: Any) -> None:
        super().__init__(length=length, **kwargs)

    def process_bind_param(self, value: str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        return encrypt_field(value)

    def process_result_value(self, value: str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        return decrypt_field(value)


class EncryptedText(TypeDecorator[str | None]):
    """SQLAlchemy TypeDecorator for TEXT columns encrypted at rest."""

    impl = Text
    cache_ok = True

    def process_bind_param(self, value: str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        return encrypt_field(value)

    def process_result_value(self, value: str | None, dialect: Any) -> str | None:
        if value is None:
            return None
        return decrypt_field(value)
