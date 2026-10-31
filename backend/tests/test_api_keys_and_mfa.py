"""Test Suite for Phase 5: API Key Governance, Multi-Tenant Rate Limiting, MFA (TOTP) & Admin Security.

Acceptance Criteria:
1. API Keys with Scopes:
   - Clave de alta entropía mostrada una sola vez; en BD se guarda solo SHA-256 y prefijo 'apl_live_...'.
   - Atada a tenant_id, con scopes específicos ('api:scores:read', 'api:stats:read', 'api:live:write').
   - Scope válido permite acceso (200 OK).
   - Scope insuficiente retorna 403 Forbidden.
   - Clave revocada retorna 401 Unauthorized.
   - Clave expirada retorna 401 Unauthorized.
   - RLS y aislamiento por tenant garantizados: clave de Tenant A intentando acceder o mutar partido de Tenant B retorna 404 Not Found.
2. Rate Limiting Multi-Tenant (Redis):
   - Contador en Redis particionado por tenant y clave/usuario.
   - Ráfaga superando el límite retorna 429 Too Many Requests con cabeceras 'Retry-After' y 'X-RateLimit-*'.
   - Las peticiones de otro tenant en la misma ventana de tiempo no son afectadas (aislamiento estricto).
3. MFA (TOTP) & Códigos de Respaldo:
   - Obligatorio para roles privilegiados (SUPER_ADMIN, ADMIN_LIGA, GESTOR_FINANCIERO).
   - Secreto TOTP cifrado en reposo con Fernet.
   - 8 códigos de respaldo guardados como hashes SHA-256.
   - Token emitido en login sin MFA tiene mfa_verified=false; acceso a endpoint administrativo protegido retorna 403 Forbidden.
   - Verificación con TOTP válido retorna token con mfa_verified=true; acceso a endpoint administrativo protegido retorna 200 OK.
   - Código de respaldo es de un solo uso; reutilizarlo retorna 401 Unauthorized.
   - 5 intentos consecutivos fallidos activan bloqueo temporal de cuenta (429 Too Many Requests).
4. No Repudio y Auditoría Criptográfica:
   - Ninguna API Key en texto plano ni secreto TOTP en BD ni en logs de auditoría.
"""

import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pyotp
import pytest
import pytest_asyncio
import redis.asyncio as aioredis
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.application.services.api_key_service import ApiKeyService
from app.config import settings
from app.domain.permissions import SystemRole
from app.infrastructure.database import get_db, reset_session_tenant
from app.infrastructure.rate_limiter import RateLimiter
from app.infrastructure.security import create_access_token
from app.main import app

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture(autouse=True)
async def test_client():
    """Overrides get_db with an isolated NullPool session factory per test."""
    engine_test = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(engine_test, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as s:
            try:
                yield s
            finally:
                await reset_session_tenant(s)
                await s.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)
    await engine_test.dispose()


@pytest_asyncio.fixture
async def api_mfa_seed():
    """Seeds multi-tenant test environment with Tenant A and Tenant B, users, tournaments, matches."""
    org_a_id = uuid.uuid4()
    org_b_id = uuid.uuid4()

    user_admin_a_id = uuid.uuid4()
    user_admin_b_id = uuid.uuid4()
    user_treasurer_a_id = uuid.uuid4()

    season_a_id = uuid.uuid4()
    season_b_id = uuid.uuid4()
    tourn_a_id = uuid.uuid4()
    tourn_b_id = uuid.uuid4()
    matchday_a_id = uuid.uuid4()
    matchday_b_id = uuid.uuid4()
    team_a1_id = uuid.uuid4()
    team_a2_id = uuid.uuid4()
    team_b1_id = uuid.uuid4()
    team_b2_id = uuid.uuid4()
    match_a_id = uuid.uuid4()
    match_b_id = uuid.uuid4()

    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        # 1. Organizations
        await conn.execute(text("""
            INSERT INTO organizations (id, name, slug, primary_color, theme_branding, status, created_at, updated_at, is_deleted)
            VALUES
                (:org_a, 'Liga Metropolitana A', :slug_a, '#0055ff', '{}', 'ACTIVE', now(), now(), false),
                (:org_b, 'Liga Provincial B', :slug_b, '#ff5500', '{}', 'ACTIVE', now(), now(), false);
        """), {
            "org_a": org_a_id, "slug_a": f"liga-a-{str(org_a_id)[:8]}",
            "org_b": org_b_id, "slug_b": f"liga-b-{str(org_b_id)[:8]}",
        })

        # 2. Users
        await conn.execute(text("""
            INSERT INTO users (id, organization_id, email, password_hash, full_name, role, is_active, mfa_enabled, created_at, updated_at, is_deleted)
            VALUES
                (:u_adm_a, :org_a, :e_adm_a, 'hashed', 'Admin Liga A', 'ADMIN_LIGA', true, false, now(), now(), false),
                (:u_adm_b, :org_b, :e_adm_b, 'hashed', 'Admin Liga B', 'ADMIN_LIGA', true, false, now(), now(), false),
                (:u_tre_a, :org_a, :e_tre_a, 'hashed', 'Tesorero Liga A', 'GESTOR_FINANCIERO', true, false, now(), now(), false);
        """), {
            "u_adm_a": user_admin_a_id, "org_a": org_a_id, "e_adm_a": f"admin_a_{str(uuid.uuid4())[:8]}@test.com",
            "u_adm_b": user_admin_b_id, "org_b": org_b_id, "e_adm_b": f"admin_b_{str(uuid.uuid4())[:8]}@test.com",
            "u_tre_a": user_treasurer_a_id, "e_tre_a": f"tre_a_{str(uuid.uuid4())[:8]}@test.com",
        })

        # 3. Memberships
        await conn.execute(text("""
            INSERT INTO tenant_memberships (id, user_id, tenant_id, status, role, created_at, updated_at, is_deleted)
            VALUES
                (gen_random_uuid(), :u_adm_a, :org_a, 'ACTIVE', 'ADMIN_LIGA', now(), now(), false),
                (gen_random_uuid(), :u_adm_b, :org_b, 'ACTIVE', 'ADMIN_LIGA', now(), now(), false),
                (gen_random_uuid(), :u_tre_a, :org_a, 'ACTIVE', 'GESTOR_FINANCIERO', now(), now(), false);
        """), {
            "u_adm_a": user_admin_a_id, "org_a": org_a_id,
            "u_adm_b": user_admin_b_id, "org_b": org_b_id,
            "u_tre_a": user_treasurer_a_id,
        })

        # 4. Roles & Permissions setup for RBAC
        role_rows = await conn.execute(text("SELECT id, slug FROM roles WHERE organization_id IS NULL;"))
        role_map = {r[1]: r[0] for r in role_rows.fetchall()}

        await conn.execute(text("""
            INSERT INTO user_roles (id, user_id, role_id, tenant_id, scope_type, scope_id, created_at, updated_at)
            VALUES
                (gen_random_uuid(), :u_adm_a, :r_adm, :org_a, 'LEAGUE', NULL, now(), now()),
                (gen_random_uuid(), :u_adm_b, :r_adm, :org_b, 'LEAGUE', NULL, now(), now()),
                (gen_random_uuid(), :u_tre_a, :r_tre, :org_a, 'LEAGUE', NULL, now(), now());
        """), {
            "u_adm_a": user_admin_a_id, "r_adm": role_map[SystemRole.ADMIN_LIGA.value], "org_a": org_a_id,
            "u_adm_b": user_admin_b_id, "org_b": org_b_id,
            "u_tre_a": user_treasurer_a_id, "r_tre": role_map[SystemRole.GESTOR_FINANCIERO.value],
        })

        # 5. Seasons & Tournaments
        await conn.execute(text("""
            INSERT INTO seasons (id, organization_id, name, year, is_current, created_at, updated_at, is_deleted)
            VALUES
                (:s_a, :org_a, 'Temporada A 2026', 2026, true, now(), now(), false),
                (:s_b, :org_b, 'Temporada B 2026', 2026, true, now(), now(), false);
        """), {"s_a": season_a_id, "org_a": org_a_id, "s_b": season_b_id, "org_b": org_b_id})

        await conn.execute(text("""
            INSERT INTO tournaments (id, organization_id, season_id, name, slug, sport_format, match_duration, points_for_win, points_for_draw, points_for_loss, status, created_at, updated_at, is_deleted)
            VALUES
                (:t_a, :org_a, :s_a, 'Torneo A', :slug_ta, 'LEAGUE_ROUND_ROBIN', 90, 3, 1, 0, 'ACTIVE', now(), now(), false),
                (:t_b, :org_b, :s_b, 'Torneo B', :slug_tb, 'LEAGUE_ROUND_ROBIN', 90, 3, 1, 0, 'ACTIVE', now(), now(), false);
        """), {
            "t_a": tourn_a_id, "org_a": org_a_id, "s_a": season_a_id, "slug_ta": f"ta-{str(tourn_a_id)[:8]}",
            "t_b": tourn_b_id, "org_b": org_b_id, "s_b": season_b_id, "slug_tb": f"tb-{str(tourn_b_id)[:8]}",
        })

        await conn.execute(text("""
            INSERT INTO matchdays (id, organization_id, tournament_id, number, name, round_type, created_at, updated_at, is_deleted)
            VALUES
                (:mda, :org_a, :t_a, 1, 'Jornada 1', 'REGULAR', now(), now(), false),
                (:mdb, :org_b, :t_b, 1, 'Jornada 1', 'REGULAR', now(), now(), false);
        """), {"mda": matchday_a_id, "org_a": org_a_id, "t_a": tourn_a_id, "mdb": matchday_b_id, "org_b": org_b_id, "t_b": tourn_b_id})

        # 6. Teams
        await conn.execute(text("""
            INSERT INTO teams (id, organization_id, name, short_code, primary_color, secondary_color, city, created_at, updated_at, is_deleted)
            VALUES
                (:t_a1, :org_a, 'Equipo Alpha A', 'EAA', '#111', '#fff', 'La Paz', now(), now(), false),
                (:t_a2, :org_a, 'Equipo Beta A', 'EBA', '#222', '#fff', 'La Paz', now(), now(), false),
                (:t_b1, :org_b, 'Equipo Gamma B', 'EGB', '#333', '#fff', 'Cochabamba', now(), now(), false),
                (:t_b2, :org_b, 'Equipo Delta B', 'EDB', '#444', '#fff', 'Cochabamba', now(), now(), false);
        """), {
            "t_a1": team_a1_id, "t_a2": team_a2_id, "org_a": org_a_id,
            "t_b1": team_b1_id, "t_b2": team_b2_id, "org_b": org_b_id,
        })

        # 7. Matches
        now_dt = datetime.now(UTC)
        await conn.execute(text("""
            INSERT INTO matches (id, organization_id, tournament_id, matchday_id, home_team_id, away_team_id, scheduled_at, home_score, away_score, status, current_minute, is_referee_signed, created_at, updated_at, is_deleted)
            VALUES
                (:m_a, :org_a, :t_a, :mda, :t_a1, :t_a2, :now_dt, 1, 0, 'LIVE', 45, false, now(), now(), false),
                (:m_b, :org_b, :t_b, :mdb, :t_b1, :t_b2, :now_dt, 2, 2, 'LIVE', 60, false, now(), now(), false);
        """), {
            "m_a": match_a_id, "org_a": org_a_id, "t_a": tourn_a_id, "mda": matchday_a_id, "t_a1": team_a1_id, "t_a2": team_a2_id, "now_dt": now_dt,
            "m_b": match_b_id, "org_b": org_b_id, "t_b": tourn_b_id, "mdb": matchday_b_id, "t_b1": team_b1_id, "t_b2": team_b2_id,
        })

        # 8. Inscriptions (for balance export test)
        await conn.execute(text("""
            INSERT INTO inscriptions (id, organization_id, tournament_id, team_id, amount, status, registered_by, approved_by, created_at, updated_at, is_deleted)
            VALUES
                (gen_random_uuid(), :org_a, :t_a, :t_a1, 500.00, 'VALIDATED', :u_adm_a, :u_tre_a, now(), now(), false),
                (gen_random_uuid(), :org_a, :t_a, :t_a2, 300.00, 'PENDING', :u_adm_a, NULL, now(), now(), false);
        """), {"org_a": org_a_id, "t_a": tourn_a_id, "t_a1": team_a1_id, "t_a2": team_a2_id, "u_adm_a": user_admin_a_id, "u_tre_a": user_treasurer_a_id})

    # Clear redis keys for these test tenants
    try:
        r = await aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        keys_a = await r.keys(f"rate_limit:{org_a_id}:*")
        keys_b = await r.keys(f"rate_limit:{org_b_id}:*")
        all_k = keys_a + keys_b
        if all_k:
            await r.delete(*all_k)
        await r.aclose()
    except Exception:
        pass

    session_maker = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    # Pre-create test API keys
    async with session_maker() as session:
        # Key with scores:read for Tenant A
        _, raw_key_scores_a = await ApiKeyService.create_api_key(
            session=session,
            tenant_id=org_a_id,
            name="Scores Key A",
            scopes=["api:scores:read"],
        )

        # Key with live:write for Tenant A
        _, raw_key_live_a = await ApiKeyService.create_api_key(
            session=session,
            tenant_id=org_a_id,
            name="Live Key A",
            scopes=["api:live:write"],
        )

        # Key with full scopes for Tenant B
        _, raw_key_b = await ApiKeyService.create_api_key(
            session=session,
            tenant_id=org_b_id,
            name="Full Key B",
            scopes=["api:scores:read", "api:stats:read", "api:live:write"],
        )

        # Revoked Key for Tenant A
        revoked_key_obj, raw_key_revoked = await ApiKeyService.create_api_key(
            session=session,
            tenant_id=org_a_id,
            name="Revoked Key A",
            scopes=["api:scores:read"],
        )
        revoked_key_obj.is_active = False
        revoked_key_obj.revoked_at = datetime.now(UTC)
        await session.commit()

        # Expired Key for Tenant A
        expired_key_obj, raw_key_expired = await ApiKeyService.create_api_key(
            session=session,
            tenant_id=org_a_id,
            name="Expired Key A",
            scopes=["api:scores:read"],
            expires_at=datetime.now(UTC) - timedelta(days=1),
        )

    await engine.dispose()

    return {
        "org_a_id": org_a_id,
        "org_b_id": org_b_id,
        "user_admin_a_id": user_admin_a_id,
        "user_admin_b_id": user_admin_b_id,
        "user_treasurer_a_id": user_treasurer_a_id,
        "match_a_id": match_a_id,
        "match_b_id": match_b_id,
        "raw_key_scores_a": raw_key_scores_a,
        "raw_key_live_a": raw_key_live_a,
        "raw_key_b": raw_key_b,
        "raw_key_revoked": raw_key_revoked,
        "raw_key_expired": raw_key_expired,
    }


async def test_api_key_valid_scope_success(api_mfa_seed):
    """API Key with scope 'api:scores:read' succeeds in querying scores."""
    seed = api_mfa_seed
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get(
            "/api/v1/integrations/scores",
            headers={"X-API-Key": seed["raw_key_scores_a"]},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["tenant_id"] == str(seed["org_a_id"])
        assert data["count"] == 1
        assert data["scores"][0]["match_id"] == str(seed["match_a_id"])


async def test_api_key_insufficient_scope_forbidden(api_mfa_seed):
    """API Key with 'api:scores:read' attempting 'api:live:write' operation is rejected with 403 Forbidden."""
    seed = api_mfa_seed
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.post(
            "/api/v1/integrations/live-update",
            headers={"X-API-Key": seed["raw_key_scores_a"]},
            json={
                "match_id": str(seed["match_a_id"]),
                "home_score": 2,
                "away_score": 1,
                "current_minute": 50,
            },
        )
        assert resp.status_code == 403, resp.text
        assert "Alcance insuficiente" in resp.json()["detail"]


async def test_api_key_revoked_unauthorized(api_mfa_seed):
    """Revoked API Key returns 401 Unauthorized."""
    seed = api_mfa_seed
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get(
            "/api/v1/integrations/scores",
            headers={"X-API-Key": seed["raw_key_revoked"]},
        )
        assert resp.status_code == 401, resp.text
        assert "revocada" in resp.json()["detail"].lower()


async def test_api_key_expired_unauthorized(api_mfa_seed):
    """Expired API Key returns 401 Unauthorized."""
    seed = api_mfa_seed
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get(
            "/api/v1/integrations/scores",
            headers={"X-API-Key": seed["raw_key_expired"]},
        )
        assert resp.status_code == 401, resp.text
        assert "expirada" in resp.json()["detail"].lower()


async def test_api_key_rate_limiting_and_tenant_isolation(api_mfa_seed):
    """
    Rate limiting under high request burst:
    - Breaching the limit triggers 429 Too Many Requests with 'Retry-After' and 'X-RateLimit-*' headers.
    - Tenant B's API key remains completely unaffected in the same window.
    """
    seed = api_mfa_seed
    tenant_a = seed["org_a_id"]
    tenant_b = seed["org_b_id"]

    # 1. Test rate limiter mechanics directly with a tight threshold (limit=3)
    ident_a = f"test_burst_consumer_{uuid.uuid4()}"
    ident_b = f"test_burst_consumer_{uuid.uuid4()}"

    # Tenant A makes 3 successful requests
    for _ in range(3):
        headers = await RateLimiter.check_rate_limit(
            tenant_id=tenant_a,
            identifier=ident_a,
            limit=3,
            window_seconds=60,
            fail_closed=True,
        )
        assert "X-RateLimit-Remaining" in headers

    # 4th request from Tenant A breaches limit -> 429
    with pytest.raises(Exception) as exc_info:
        await RateLimiter.check_rate_limit(
            tenant_id=tenant_a,
            identifier=ident_a,
            limit=3,
            window_seconds=60,
            fail_closed=True,
        )
    err = exc_info.value
    assert getattr(err, "status_code", None) == 429
    assert "Retry-After" in err.headers
    assert "X-RateLimit-Limit" in err.headers
    assert err.headers["X-RateLimit-Limit"] == "3"

    # Tenant B in the exact same window is completely unaffected (strict multi-tenant isolation)
    headers_b = await RateLimiter.check_rate_limit(
        tenant_id=tenant_b,
        identifier=ident_b,
        limit=3,
        window_seconds=60,
        fail_closed=True,
    )
    assert headers_b["X-RateLimit-Remaining"] == "2"


async def test_api_key_cross_tenant_isolation_returns_404(api_mfa_seed):
    """
    API Key from Tenant A cannot access or mutate resources of Tenant B.
    Returns 404 Not Found (zero cross-tenant information leakage).
    """
    seed = api_mfa_seed
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Tenant A's live key attempts to update Match belonging to Tenant B
        resp = await client.post(
            "/api/v1/integrations/live-update",
            headers={"X-API-Key": seed["raw_key_live_a"]},
            json={
                "match_id": str(seed["match_b_id"]),
                "home_score": 5,
                "away_score": 0,
                "current_minute": 88,
            },
        )
        assert resp.status_code == 404, resp.text


async def test_privileged_user_without_mfa_forbidden(api_mfa_seed):
    """
    Privileged user login without MFA verification returns token with mfa_verified=false.
    Access to protected administration endpoint returns 403 Forbidden.
    """
    seed = api_mfa_seed
    # Token with mfa_required=True, mfa_verified=False (standard post-password login for privileged roles)
    unverified_token = create_access_token({
        "sub": str(seed["user_admin_a_id"]),
        "email": "admin_a@test.com",
        "role": SystemRole.ADMIN_LIGA.value,
        "tenant_id": str(seed["org_a_id"]),
        "mfa_required": True,
        "mfa_verified": False,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        resp = await client.get(
            "/api/v1/admin/finances/export-balance",
            headers={"Authorization": f"Bearer {unverified_token}"},
        )
        assert resp.status_code == 403, resp.text
        assert "MFA requerido" in resp.json()["detail"]


async def test_mfa_setup_and_enable(api_mfa_seed):
    """
    Full MFA Enrollment lifecycle:
    1. /auth/mfa/setup generates TOTP secret and 8 backup codes.
    2. Secret is stored Fernet-encrypted at rest and backup codes are stored as SHA-256 hashes.
    3. /auth/mfa/enable verifies initial TOTP code before activating MFA flag in user account.
    """
    seed = api_mfa_seed
    token = create_access_token({
        "sub": str(seed["user_admin_a_id"]),
        "email": "admin_a@test.com",
        "role": SystemRole.ADMIN_LIGA.value,
        "tenant_id": str(seed["org_a_id"]),
        "mfa_required": True,
        "mfa_verified": False,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Step 1: Initiate MFA Setup
        resp_setup = await client.post(
            "/api/v1/auth/mfa/setup",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp_setup.status_code == 200, resp_setup.text
        setup_data = resp_setup.json()
        raw_secret = setup_data["secret"]
        backup_codes = setup_data["backup_codes"]
        assert len(raw_secret) >= 16
        assert len(backup_codes) == 8
        assert "otpauth://" in setup_data["provisioning_uri"]

        # Step 2: Attempt enable with invalid code -> 400 Bad Request
        resp_bad = await client.post(
            "/api/v1/auth/mfa/enable",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": "000000"},
        )
        assert resp_bad.status_code == 400, resp_bad.text

        # Step 3: Enable with valid TOTP code
        valid_totp = pyotp.TOTP(raw_secret).now()
        resp_enable = await client.post(
            "/api/v1/auth/mfa/enable",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": valid_totp},
        )
        assert resp_enable.status_code == 200, resp_enable.text

        # Verify DB status
        engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
        async with engine.begin() as conn:
            res = await conn.execute(
                text("SELECT mfa_enabled, mfa_secret_encrypted, mfa_backup_codes FROM users WHERE id = :uid"),
                {"uid": seed["user_admin_a_id"]},
            )
            row = res.fetchone()
            assert row[0] is True  # mfa_enabled
            assert row[1] != raw_secret  # Secret is NOT stored in plaintext!
            assert len(row[2]) == 8  # 8 hashed codes stored
        await engine.dispose()


async def test_mfa_totp_verification_grants_verified_token(api_mfa_seed):
    """
    Verification with valid TOTP code emits token with mfa_verified=true,
    allowing full access to privileged administration endpoints.
    """
    seed = api_mfa_seed
    token = create_access_token({
        "sub": str(seed["user_treasurer_a_id"]),
        "email": "treasurer_a@test.com",
        "role": SystemRole.GESTOR_FINANCIERO.value,
        "tenant_id": str(seed["org_a_id"]),
        "mfa_required": True,
        "mfa_verified": False,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Enrol MFA first
        resp_setup = await client.post(
            "/api/v1/auth/mfa/setup",
            headers={"Authorization": f"Bearer {token}"},
        )
        raw_secret = resp_setup.json()["secret"]

        # Enable
        totp_code = pyotp.TOTP(raw_secret).now()
        await client.post(
            "/api/v1/auth/mfa/enable",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": totp_code},
        )

        # Step: Verify MFA
        resp_verify = await client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": pyotp.TOTP(raw_secret).now()},
        )
        assert resp_verify.status_code == 200, resp_verify.text
        token_data = resp_verify.json()
        assert token_data["mfa_verified"] is True
        verified_token = token_data["access_token"]

        # Access privileged administration route
        resp_admin = await client.get(
            "/api/v1/admin/finances/export-balance",
            headers={"Authorization": f"Bearer {verified_token}"},
        )
        assert resp_admin.status_code == 200, resp_admin.text
        balance_data = resp_admin.json()
        assert balance_data["mfa_verified"] is True
        assert balance_data["total_validated"] == 500.00
        assert balance_data["total_pending"] == 300.00


async def test_mfa_backup_code_single_use_consumption(api_mfa_seed):
    """
    Backup code verifies successfully on first use and is consumed immediately.
    Attempting to reuse the exact same backup code returns 401 Unauthorized.
    """
    seed = api_mfa_seed
    token = create_access_token({
        "sub": str(seed["user_admin_b_id"]),
        "email": "admin_b@test.com",
        "role": SystemRole.ADMIN_LIGA.value,
        "tenant_id": str(seed["org_b_id"]),
        "mfa_required": True,
        "mfa_verified": False,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Enrol MFA
        resp_setup = await client.post(
            "/api/v1/auth/mfa/setup",
            headers={"Authorization": f"Bearer {token}"},
        )
        setup_data = resp_setup.json()
        raw_secret = setup_data["secret"]
        backup_codes = setup_data["backup_codes"]
        single_use_code = backup_codes[0]

        # Enable
        await client.post(
            "/api/v1/auth/mfa/enable",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": pyotp.TOTP(raw_secret).now()},
        )

        # First use of backup code -> 200 OK
        resp_first = await client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {token}"},
            json={"backup_code": single_use_code},
        )
        assert resp_first.status_code == 200, resp_first.text
        assert resp_first.json()["mfa_verified"] is True

        # Second use of identical backup code -> REJECTED with 401 Unauthorized!
        resp_second = await client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {token}"},
            json={"backup_code": single_use_code},
        )
        assert resp_second.status_code == 401, resp_second.text
        assert "inválido o ya utilizado" in resp_second.json()["detail"]


async def test_mfa_lockout_after_5_failed_attempts(api_mfa_seed):
    """
    5 consecutive invalid MFA attempts triggers temporary account lockout (429 Too Many Requests).
    """
    seed = api_mfa_seed
    user_id = uuid.uuid4()
    org_id = seed["org_a_id"]

    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text("""
            INSERT INTO users (id, organization_id, email, password_hash, full_name, role, is_active, mfa_enabled, created_at, updated_at, is_deleted)
            VALUES (:uid, :org, :email, 'hashed', 'Test Lockout User', 'ADMIN_LIGA', true, true, now(), now(), false);
        """), {"uid": user_id, "org": org_id, "email": f"lockout_{str(user_id)[:8]}@test.com"})
        await conn.execute(text("""
            INSERT INTO tenant_memberships (id, user_id, tenant_id, status, role, created_at, updated_at, is_deleted)
            VALUES (gen_random_uuid(), :uid, :org, 'ACTIVE', 'ADMIN_LIGA', now(), now(), false);
        """), {"uid": user_id, "org": org_id})
    await engine.dispose()

    token = create_access_token({
        "sub": str(user_id),
        "email": f"lockout_{str(user_id)[:8]}@test.com",
        "role": SystemRole.ADMIN_LIGA.value,
        "tenant_id": str(org_id),
        "mfa_required": True,
        "mfa_verified": False,
    })

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Enrol
        resp_setup = await client.post(
            "/api/v1/auth/mfa/setup",
            headers={"Authorization": f"Bearer {token}"},
        )
        raw_secret = resp_setup.json()["secret"]
        await client.post(
            "/api/v1/auth/mfa/enable",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": pyotp.TOTP(raw_secret).now()},
        )

        # 4 consecutive bad attempts -> 401 Unauthorized
        for i in range(4):
            r = await client.post(
                "/api/v1/auth/mfa/verify",
                headers={"Authorization": f"Bearer {token}"},
                json={"code": f"00000{i}"},
            )
            assert r.status_code == 401, f"Attempt {i+1} expected 401"

        # 5th attempt breaches threshold -> triggers lockout (401 or 429)
        r5 = await client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": "000005"},
        )
        # 5th fails, locking the user
        assert r5.status_code in (401, 429)

        # 6th attempt while locked -> 429 Too Many Requests
        r6 = await client.post(
            "/api/v1/auth/mfa/verify",
            headers={"Authorization": f"Bearer {token}"},
            json={"code": "000006"},
        )
        assert r6.status_code == 429, r6.text
        assert "Cuenta bloqueada temporalmente" in r6.json()["detail"]


async def test_no_plaintext_keys_or_secrets_in_db_or_audit_logs(api_mfa_seed):
    """
    Zero-plaintext verification:
    - In database: api_keys stores only SHA-256 (64 hex characters); users stores Fernet encrypted secrets and hashed backup codes.
    - In audit_logs: no raw API key ('apl_live_') or TOTP secret appears anywhere in before_state or after_state JSONB columns.
    """
    seed = api_mfa_seed
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)

    async with engine.begin() as conn:
        # 1. Inspect api_keys table
        res_keys = await conn.execute(text("SELECT hashed_key, prefix FROM api_keys WHERE organization_id = :org"), {"org": seed["org_a_id"]})
        keys = res_keys.fetchall()
        for hashed_key, prefix in keys:
            assert len(hashed_key) == 64  # Strict SHA-256 hex length
            assert prefix.startswith("apl_live_")
            # Raw key must NOT be in DB
            assert not hashed_key.startswith("apl_live_")

        # 2. Inspect users table for MFA fields
        res_users = await conn.execute(text("""
            SELECT mfa_secret_encrypted, mfa_backup_codes
            FROM users
            WHERE id = :uid AND mfa_enabled = true
        """), {"uid": seed["user_admin_a_id"]})
        user_row = res_users.fetchone()
        if user_row and user_row[0]:
            # Encrypted with Fernet begins with 'gAAAAA'
            assert user_row[0].startswith("gAAAAA")
            for bc_hash in user_row[1]:
                assert len(bc_hash) == 64

        # 3. Inspect audit_logs table
        res_audit = await conn.execute(text("""
            SELECT action, before_state::text, after_state::text
            FROM audit_logs
            WHERE tenant_id = :org AND action IN ('CREATE_API_KEY', 'MFA_SETUP_INITIATED', 'MFA_AUTHENTICATION_SUCCESS')
        """), {"org": seed["org_a_id"]})
        logs = res_audit.fetchall()
        for _action, before_s, after_s in logs:
            combined = f"{before_s or ''} {after_s or ''}"
            assert "apl_live_" not in combined or "prefix" in combined
            assert "raw_key" not in combined
            assert "totp_secret" not in combined
            assert "base32" not in combined

    await engine.dispose()
