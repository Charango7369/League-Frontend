from app.infrastructure.security import create_access_token, decode_token, get_password_hash, verify_password


def test_password_hashing():
    plain = "ApoloDigital2026!#"
    hashed = get_password_hash(plain)
    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_generation_and_decode():
    data = {"sub": "12345-uuid", "role": "ORGANIZATION_ADMIN", "org_slug": "liga-apolo"}
    token = create_access_token(data)
    decoded = decode_token(token)
    assert decoded is not None
    assert decoded["sub"] == "12345-uuid"
    assert decoded["role"] == "ORGANIZATION_ADMIN"
    assert decoded["org_slug"] == "liga-apolo"
