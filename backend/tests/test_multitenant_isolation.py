import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from jose import jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.infrastructure.database import get_db, reset_session_tenant, set_session_tenant
from app.infrastructure.models.team import Team
from app.infrastructure.security import create_access_token, get_password_hash
from app.main import app

pytestmark = pytest.mark.asyncio

@pytest_asyncio.fixture
async def test_db_engines():
    test_admin_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    test_app_engine = create_async_engine(settings.APP_DATABASE_URL or settings.DATABASE_URL, poolclass=NullPool)
    yield test_admin_engine, test_app_engine
    await test_admin_engine.dispose()
    await test_app_engine.dispose()

@pytest_asyncio.fixture(autouse=True)
async def override_db_dependency(test_db_engines):
    _, test_app_eng = test_db_engines
    TestSessionLocal = async_sessionmaker(
        bind=test_app_eng,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False
    )
    async def _test_get_db():
        async with TestSessionLocal() as session:
            try:
                yield session
            finally:
                await reset_session_tenant(session)
                await session.close()

    app.dependency_overrides[get_db] = _test_get_db
    yield
    app.dependency_overrides.pop(get_db, None)

@pytest_asyncio.fixture
async def multitenant_seed(test_db_engines):
    """Seeds two distinct leagues (Liga A and Liga B) with respective users, teams and tournaments."""
    admin_eng, _ = test_db_engines

    uid = uuid.uuid4().hex[:8]
    org_a_id = uuid.uuid4()
    org_b_id = uuid.uuid4()
    user_a_id = uuid.uuid4()
    user_b_id = uuid.uuid4()
    user_cross_id = uuid.uuid4()

    slug_a = f"liga-a-{uid}"
    slug_b = f"liga-b-{uid}"
    email_a = f"admin-{uid}@liga-a.test"
    email_b = f"admin-{uid}@liga-b.test"
    email_cross = f"multiliga-{uid}@test.com"

    async with admin_eng.begin() as conn:
        # Create Organizations
        await conn.execute(text("""
            INSERT INTO organizations (id, name, slug, primary_color, theme_branding, status, created_at, updated_at, is_deleted)
            VALUES
                (:org_a_id, :name_a, :slug_a, '#1a4fd6', '{}', 'ACTIVE', now(), now(), false),
                (:org_b_id, :name_b, :slug_b, '#15803d', '{}', 'ACTIVE', now(), now(), false);
        """), {
            "org_a_id": org_a_id, "name_a": f"Liga A {uid}", "slug_a": slug_a,
            "org_b_id": org_b_id, "name_b": f"Liga B {uid}", "slug_b": slug_b
        })

        # Create Users
        pwd_hash = get_password_hash("TestPassword2026!")
        await conn.execute(text("""
            INSERT INTO users (id, organization_id, email, password_hash, full_name, role, is_active, created_at, updated_at, is_deleted)
            VALUES
                (:u_a, :org_a_id, :em_a, :pwd, 'Admin Liga A', 'ORGANIZATION_ADMIN', true, now(), now(), false),
                (:u_b, :org_b_id, :em_b, :pwd, 'Admin Liga B', 'ORGANIZATION_ADMIN', true, now(), now(), false),
                (:u_c, :org_a_id, :em_c, :pwd, 'Multi Liga User', 'ORGANIZATION_ADMIN', true, now(), now(), false);
        """), {
            "u_a": user_a_id, "u_b": user_b_id, "u_c": user_cross_id,
            "org_a_id": org_a_id, "org_b_id": org_b_id, "pwd": pwd_hash,
            "em_a": email_a, "em_b": email_b, "em_c": email_cross
        })

        # Create Memberships
        await conn.execute(text("""
            INSERT INTO tenant_memberships (id, user_id, tenant_id, status, role, created_at, updated_at, is_deleted)
            VALUES
                (gen_random_uuid(), :u_a, :org_a_id, 'ACTIVE', 'ORGANIZATION_ADMIN', now(), now(), false),
                (gen_random_uuid(), :u_b, :org_b_id, 'ACTIVE', 'ORGANIZATION_ADMIN', now(), now(), false),
                (gen_random_uuid(), :u_c, :org_a_id, 'ACTIVE', 'ORGANIZATION_ADMIN', now(), now(), false),
                (gen_random_uuid(), :u_c, :org_b_id, 'ACTIVE', 'ORGANIZATION_ADMIN', now(), now(), false);
        """), {"u_a": user_a_id, "u_b": user_b_id, "u_c": user_cross_id, "org_a_id": org_a_id, "org_b_id": org_b_id})

        # Create Seasons and Tournaments
        season_a_id = uuid.uuid4()
        season_b_id = uuid.uuid4()
        tourn_a_id = uuid.uuid4()
        tourn_b_id = uuid.uuid4()

        await conn.execute(text("""
            INSERT INTO seasons (id, organization_id, name, year, is_current, created_at, updated_at, is_deleted)
            VALUES
                (:s_a, :org_a_id, 'Temporada A 2026', 2026, true, now(), now(), false),
                (:s_b, :org_b_id, 'Temporada B 2026', 2026, true, now(), now(), false);
        """), {"s_a": season_a_id, "s_b": season_b_id, "org_a_id": org_a_id, "org_b_id": org_b_id})

        await conn.execute(text("""
            INSERT INTO tournaments (id, organization_id, season_id, name, slug, sport_format, match_duration, points_for_win, points_for_draw, points_for_loss, status, created_at, updated_at, is_deleted)
            VALUES
                (:t_a, :org_a_id, :s_a, 'Torneo Apertura Liga A', :slug_a, 'LEAGUE_ROUND_ROBIN', 90, 3, 1, 0, 'ACTIVE', now(), now(), false),
                (:t_b, :org_b_id, :s_b, 'Torneo Apertura Liga B', :slug_b, 'LEAGUE_ROUND_ROBIN', 90, 3, 1, 0, 'ACTIVE', now(), now(), false);
        """), {"t_a": tourn_a_id, "t_b": tourn_b_id, "s_a": season_a_id, "s_b": season_b_id, "org_a_id": org_a_id, "org_b_id": org_b_id, "slug_a": f"ap-a-{uid}", "slug_b": f"ap-b-{uid}"})

        # Create Teams
        team_a_id = uuid.uuid4()
        team_b_id = uuid.uuid4()
        await conn.execute(text("""
            INSERT INTO teams (id, organization_id, name, short_code, city, primary_color, secondary_color, created_at, updated_at, is_deleted)
            VALUES
                (:tm_a, :org_a_id, 'Club Deportivo Apolo A', 'CDA', 'Apolo', '#1a4fd6', '#ffffff', now(), now(), false),
                (:tm_b, :org_b_id, 'Atlético Madidi B', 'AMB', 'Madidi', '#15803d', '#f0b429', now(), now(), false);
        """), {"tm_a": team_a_id, "tm_b": team_b_id, "org_a_id": org_a_id, "org_b_id": org_b_id})

        # Create Matchdays & Matches
        md_a_id = uuid.uuid4()
        md_b_id = uuid.uuid4()
        match_a_id = uuid.uuid4()
        match_b_id = uuid.uuid4()

        await conn.execute(text("""
            INSERT INTO matchdays (id, organization_id, tournament_id, number, name, round_type, created_at, updated_at, is_deleted)
            VALUES
                (:md_a, :org_a_id, :t_a, 1, 'Jornada 1', 'REGULAR', now(), now(), false),
                (:md_b, :org_b_id, :t_b, 1, 'Jornada 1', 'REGULAR', now(), now(), false);
        """), {"md_a": md_a_id, "md_b": md_b_id, "org_a_id": org_a_id, "org_b_id": org_b_id, "t_a": tourn_a_id, "t_b": tourn_b_id})

        await conn.execute(text("""
            INSERT INTO matches (id, organization_id, tournament_id, matchday_id, home_team_id, away_team_id, scheduled_at, status, current_minute, is_referee_signed, created_at, updated_at, is_deleted)
            VALUES
                (:m_a, :org_a_id, :t_a, :md_a, :tm_a, :tm_a, now(), 'SCHEDULED', 0, false, now(), now(), false),
                (:m_b, :org_b_id, :t_b, :md_b, :tm_b, :tm_b, now(), 'SCHEDULED', 0, false, now(), now(), false);
        """), {
            "m_a": match_a_id, "m_b": match_b_id,
            "org_a_id": org_a_id, "org_b_id": org_b_id,
            "t_a": tourn_a_id, "t_b": tourn_b_id,
            "md_a": md_a_id, "md_b": md_b_id,
            "tm_a": team_a_id, "tm_b": team_b_id
        })

    return {
        "org_a_id": org_a_id,
        "org_b_id": org_b_id,
        "user_a_id": user_a_id,
        "user_b_id": user_b_id,
        "user_cross_id": user_cross_id,
        "team_a_id": team_a_id,
        "team_b_id": team_b_id,
        "tourn_a_id": tourn_a_id,
        "tourn_b_id": tourn_b_id,
        "match_a_id": match_a_id,
        "match_b_id": match_b_id,
        "slug_a": slug_a,
        "slug_b": slug_b,
        "email_a": email_a,
        "email_b": email_b,
    }

def get_tokens(data):
    token_a = create_access_token({
        "sub": str(data["user_a_id"]),
        "email": data["email_a"],
        "role": "ORGANIZATION_ADMIN",
        "tenant_id": str(data["org_a_id"]),
        "org_id": str(data["org_a_id"]),
        "org_slug": data["slug_a"]
    })
    token_b = create_access_token({
        "sub": str(data["user_b_id"]),
        "email": data["email_b"],
        "role": "ORGANIZATION_ADMIN",
        "tenant_id": str(data["org_b_id"]),
        "org_id": str(data["org_b_id"]),
        "org_slug": data["slug_b"]
    })
    token_cross = create_access_token({
        "sub": str(data["user_cross_id"]),
        "email": "multiliga@test.com",
        "role": "ORGANIZATION_ADMIN",
        "tenant_id": str(data["org_a_id"]),
        "org_id": str(data["org_a_id"]),
        "org_slug": data["slug_a"]
    })
    return token_a, token_b, token_cross

async def test_cross_tenant_isolation_returns_404(multitenant_seed):
    """
    CRITICAL ACCEPTANCE TEST:
    A user belonging to Liga A attempting to read, update or operate on Liga B's resources
    must receive strictly 404 NOT FOUND (never 200, nor 403 leaking resource existence).
    """
    token_a, _, _ = get_tokens(multitenant_seed)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. GET team of Liga B using Liga A token -> 404
        res = await client.get(f"/api/v1/teams/{multitenant_seed['team_b_id']}", headers=headers_a)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

        # 2. GET match of Liga B using Liga A token -> 404
        res = await client.get(f"/api/v1/matches/{multitenant_seed['match_b_id']}", headers=headers_a)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

        # 3. PUT match of Liga B using Liga A token -> 404
        res = await client.put(
            f"/api/v1/matches/{multitenant_seed['match_b_id']}",
            json={"status": "LIVE", "home_score": 1, "away_score": 0},
            headers=headers_a
        )
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

        # 4. POST event on Liga B match using Liga A token -> 404
        res = await client.post(
            f"/api/v1/matches/{multitenant_seed['match_b_id']}/events",
            json={"team_id": str(multitenant_seed['team_b_id']), "event_type": "GOAL", "minute": 10},
            headers=headers_a
        )
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

        # 5. GET match official sheet of Liga B -> 404
        res = await client.get(f"/api/v1/matches/{multitenant_seed['match_b_id']}/official-sheet", headers=headers_a)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

        # 6. GET matches list for Tournament B -> 404
        res = await client.get(f"/api/v1/matches/?tournament_id={multitenant_seed['tourn_b_id']}", headers=headers_a)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

        # 7. GET standings for Tournament B -> 404
        res = await client.get(f"/api/v1/statistics/standings/{multitenant_seed['tourn_b_id']}", headers=headers_a)
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

        # 8. POST AI chronicle for Liga B match -> 404
        res = await client.post(
            "/api/v1/ai/chronicle",
            json={"match_id": str(multitenant_seed['match_b_id']), "narrative_style": "EMOCIONANTE"},
            headers=headers_a
        )
        assert res.status_code == 404, f"Expected 404, got {res.status_code}: {res.text}"

async def test_listing_endpoints_strictly_scoped(multitenant_seed):
    """
    CRITICAL ACCEPTANCE TEST:
    Listings strictly return resources for the active tenant.
    Never returns cross-tenant data.
    """
    token_a, token_b, _ = get_tokens(multitenant_seed)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Liga A lists teams -> contains Team A, never Team B
        res_a = await client.get("/api/v1/teams/", headers={"Authorization": f"Bearer {token_a}"})
        assert res_a.status_code == 200
        team_ids_a = [t["id"] for t in res_a.json()]
        assert str(multitenant_seed["team_a_id"]) in team_ids_a
        assert str(multitenant_seed["team_b_id"]) not in team_ids_a

        # Liga B lists teams -> contains Team B, never Team A
        res_b = await client.get("/api/v1/teams/", headers={"Authorization": f"Bearer {token_b}"})
        assert res_b.status_code == 200
        team_ids_b = [t["id"] for t in res_b.json()]
        assert str(multitenant_seed["team_b_id"]) in team_ids_b
        assert str(multitenant_seed["team_a_id"]) not in team_ids_b

async def test_client_supplied_tenant_id_is_ignored(multitenant_seed):
    """
    CRITICAL ACCEPTANCE TEST:
    Any tenant_id / organization_slug supplied via query or header is ignored.
    The tenant scope is fixed exclusively by the JWT.
    """
    token_a, _, _ = get_tokens(multitenant_seed)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Pass organization_slug of Liga B in query params
        res = await client.get(
            f"/api/v1/teams/?organization_slug={multitenant_seed['slug_b']}",
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res.status_code == 200
        team_ids = [t["id"] for t in res.json()]
        # Must still only see Liga A's team, never Liga B
        assert str(multitenant_seed["team_a_id"]) in team_ids
        assert str(multitenant_seed["team_b_id"]) not in team_ids

async def test_raw_database_rls_with_app_user(multitenant_seed, test_db_engines):
    """
    CRITICAL ACCEPTANCE TEST:
    Direct PostgreSQL connection as app_user (NOBYPASSRLS):
    - Without setting app.current_tenant_id -> 0 rows returned.
    - Setting app.current_tenant_id to Liga A -> returns Liga A rows only.
    - Setting app.current_tenant_id to Liga B -> returns Liga B rows only.
    """
    _, test_app_eng = test_db_engines
    async with test_app_eng.connect() as conn:
        # 1. Unset variable
        await conn.execute(text("SELECT set_config('app.current_tenant_id', '', true);"))
        res = await conn.execute(text(f"SELECT count(*) FROM teams WHERE id = '{multitenant_seed['team_a_id']}';"))
        assert res.scalar() == 0, "app_user without tenant context must see 0 rows by RLS"

        # 2. Set to Liga A
        await conn.execute(text(f"SELECT set_config('app.current_tenant_id', '{multitenant_seed['org_a_id']}', true);"))
        res_a = await conn.execute(text(f"SELECT id FROM teams WHERE id = '{multitenant_seed['team_a_id']}';"))
        returned_a = [str(r[0]) for r in res_a.all()]
        assert str(multitenant_seed["team_a_id"]) in returned_a

        # 3. Set to Liga B
        await conn.execute(text(f"SELECT set_config('app.current_tenant_id', '{multitenant_seed['org_b_id']}', true);"))
        res_b = await conn.execute(text(f"SELECT id FROM teams WHERE id = '{multitenant_seed['team_a_id']}';"))
        assert len(res_b.all()) == 0, "app_user with Liga B context must not see Liga A team"

async def test_pool_connection_leakage_resistance(multitenant_seed, test_db_engines):
    """
    CRITICAL ACCEPTANCE TEST:
    Two consecutive operations:
    Session 1 configured for Liga A -> sees Team A.
    Session 2 configured for Liga B -> sees Team B, NEVER sees residual Liga A data.
    """
    _, test_app_eng = test_db_engines
    SessionMaker = async_sessionmaker(bind=test_app_eng, class_=AsyncSession, expire_on_commit=False)

    # Request 1 (Liga A)
    async with SessionMaker() as session1:
        await set_session_tenant(session1, multitenant_seed["org_a_id"])
        res1 = await session1.execute(select(Team).where(Team.id.in_([multitenant_seed["team_a_id"], multitenant_seed["team_b_id"]])))
        teams1 = [str(t.id) for t in res1.scalars().all()]
        assert str(multitenant_seed["team_a_id"]) in teams1
        assert str(multitenant_seed["team_b_id"]) not in teams1

    # Request 2 (Liga B)
    async with SessionMaker() as session2:
        await set_session_tenant(session2, multitenant_seed["org_b_id"])
        res2 = await session2.execute(select(Team).where(Team.id.in_([multitenant_seed["team_a_id"], multitenant_seed["team_b_id"]])))
        teams2 = [str(t.id) for t in res2.scalars().all()]
        assert str(multitenant_seed["team_b_id"]) in teams2
        assert str(multitenant_seed["team_a_id"]) not in teams2

async def test_token_security_and_membership_validation(multitenant_seed):
    """
    CRITICAL ACCEPTANCE TEST:
    - Expired token -> 401
    - Forged key -> 401
    - Forged tenant_id (user has no membership in tenant) -> 403
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Expired token
        expired_token = create_access_token(
            {"sub": str(multitenant_seed["user_a_id"]), "tenant_id": str(multitenant_seed["org_a_id"])},
            expires_delta=timedelta(minutes=-10)
        )
        res = await client.get("/api/v1/teams/", headers={"Authorization": f"Bearer {expired_token}"})
        assert res.status_code == 401

        # Token with forged signature
        forged_token = jwt.encode(
            {"sub": str(multitenant_seed["user_a_id"]), "tenant_id": str(multitenant_seed["org_a_id"]), "type": "access", "exp": datetime.now(UTC) + timedelta(hours=1)},
            "wrong-secret-key-123",
            algorithm="HS256"
        )
        res = await client.get("/api/v1/teams/", headers={"Authorization": f"Bearer {forged_token}"})
        assert res.status_code == 401

        # User A trying to forge a token claiming to be in Liga B
        forged_tenant_token = create_access_token({
            "sub": str(multitenant_seed["user_a_id"]),
            "email": multitenant_seed["email_a"],
            "role": "ORGANIZATION_ADMIN",
            "tenant_id": str(multitenant_seed["org_b_id"])
        })
        res = await client.get("/api/v1/teams/", headers={"Authorization": f"Bearer {forged_tenant_token}"})
        assert res.status_code == 403, "User A with token claiming Liga B without membership must be rejected with 403"

async def test_switch_tenant_endpoint(multitenant_seed):
    """
    CRITICAL ACCEPTANCE TEST:
    - switch-tenant to a league without membership -> 403
    - switch-tenant with valid multi-tenant membership -> succeeds and returns new JWT
    """
    token_a, _, token_cross = get_tokens(multitenant_seed)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # User A tries to switch to Liga B without membership -> 403
        res = await client.post(
            "/api/v1/auth/switch-tenant",
            json={"tenant_id": str(multitenant_seed["org_b_id"])},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert res.status_code == 403, f"Expected 403, got {res.status_code}: {res.text}"

        # User Cross switches from Liga A to Liga B -> 200 with new token
        res_cross = await client.post(
            "/api/v1/auth/switch-tenant",
            json={"tenant_id": str(multitenant_seed["org_b_id"])},
            headers={"Authorization": f"Bearer {token_cross}"}
        )
        assert res_cross.status_code == 200, f"Expected 200, got {res_cross.status_code}: {res_cross.text}"
        data = res_cross.json()
        new_token = data["access_token"]
        assert data["tenant_id"] == str(multitenant_seed["org_b_id"])

        # Using new token lists Liga B teams!
        res_teams = await client.get("/api/v1/teams/", headers={"Authorization": f"Bearer {new_token}"})
        assert res_teams.status_code == 200
        team_ids = [t["id"] for t in res_teams.json()]
        assert str(multitenant_seed["team_b_id"]) in team_ids
        assert str(multitenant_seed["team_a_id"]) not in team_ids
