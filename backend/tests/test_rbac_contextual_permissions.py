"""Comprehensive RBAC and Contextual Permissions Test Suite for ApoloDigital League.

Verifies:
1. Atomic permissions check (LEAGUE ⊃ TOURNAMENT ⊃ TEAM).
2. Dual-role contextual scope: User is Referee in Tournament X and Player in Tournament Y.
3. Sibling scope isolation: Permissions do not bleed to sibling scopes.
4. Anti-privilege escalation (cannot self-assign, cannot grant unheld permissions).
5. Parametric coverage of all canonical permissions (grant vs deny).
"""

import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.application.services.rbac_service import RBACService
from app.config import settings
from app.domain.permissions import (
    ROLE_PERMISSIONS_MATRIX,
    PermissionName,
    SystemRole,
)
from app.infrastructure.database import (
    get_db,
    reset_session_tenant,
)
from app.infrastructure.models.user import User
from app.infrastructure.security import create_access_token, get_password_hash
from app.main import app

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def rbac_seed():
    """Sets up a clean test fixture with organizations, tournaments, teams, matches, and roles."""
    engine_test = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    uid = uuid.uuid4().hex[:8]

    org_id = uuid.uuid4()
    org_slug = f"liga-rbac-{uid}"

    user_admin_id = uuid.uuid4()
    user_multi_id = uuid.uuid4()      # Referee in Tourn X, Player in Tourn Y
    user_spectator_id = uuid.uuid4()  # Spectator (view only)
    user_delegate_id = uuid.uuid4()   # Team manager in Team A

    tourn_x_id = uuid.uuid4()
    tourn_y_id = uuid.uuid4()
    team_a_id = uuid.uuid4()
    team_b_id = uuid.uuid4()
    match_x_id = uuid.uuid4()
    match_y_id = uuid.uuid4()

    async with engine_test.begin() as conn:
        # Organization
        await conn.execute(text("""
            INSERT INTO organizations (id, name, slug, primary_color, theme_branding, status, created_at, updated_at, is_deleted)
            VALUES (:org_id, 'Liga RBAC Test', :slug, '#1a4fd6', '{}', 'ACTIVE', now(), now(), false);
        """), {"org_id": org_id, "slug": org_slug})

        # Users
        pw_hash = get_password_hash("password123")
        await conn.execute(text("""
            INSERT INTO users (id, organization_id, email, password_hash, full_name, role, is_active, created_at, updated_at, is_deleted)
            VALUES
                (:admin_id, :org_id, :admin_email, :pw, 'Admin Liga', 'ADMIN_LIGA', true, now(), now(), false),
                (:multi_id, :org_id, :multi_email, :pw, 'Usuario Multi-Rol', 'ARBITRO', true, now(), now(), false),
                (:spec_id, :org_id, :spec_email, :pw, 'Usuario Espectador', 'ESPECTADOR', true, now(), now(), false),
                (:del_id, :org_id, :del_email, :pw, 'Delegado Equipo A', 'DELEGADO_EQUIPO', true, now(), now(), false);
        """), {
            "org_id": org_id,
            "admin_id": user_admin_id, "admin_email": f"admin-{uid}@test.com",
            "multi_id": user_multi_id, "multi_email": f"multi-{uid}@test.com",
            "spec_id": user_spectator_id, "spec_email": f"spec-{uid}@test.com",
            "del_id": user_delegate_id, "del_email": f"del-{uid}@test.com",
            "pw": pw_hash
        })

        # Memberships
        await conn.execute(text("""
            INSERT INTO tenant_memberships (id, user_id, tenant_id, role, status, created_at, updated_at, is_deleted)
            VALUES
                (gen_random_uuid(), :admin_id, :org_id, 'ADMIN_LIGA', 'ACTIVE', now(), now(), false),
                (gen_random_uuid(), :multi_id, :org_id, 'ARBITRO', 'ACTIVE', now(), now(), false),
                (gen_random_uuid(), :spec_id, :org_id, 'ESPECTADOR', 'ACTIVE', now(), now(), false),
                (gen_random_uuid(), :del_id, :org_id, 'DELEGADO_EQUIPO', 'ACTIVE', now(), now(), false);
        """), {
            "org_id": org_id,
            "admin_id": user_admin_id,
            "multi_id": user_multi_id,
            "spec_id": user_spectator_id,
            "del_id": user_delegate_id,
        })

        # Season
        season_id = uuid.uuid4()
        await conn.execute(text("""
            INSERT INTO seasons (id, organization_id, name, year, is_current, created_at, updated_at, is_deleted)
            VALUES (:season_id, :org_id, 'Temporada RBAC 2026', 2026, true, now(), now(), false);
        """), {"season_id": season_id, "org_id": org_id})

        # Tournaments X and Y
        await conn.execute(text("""
            INSERT INTO tournaments (id, organization_id, season_id, name, slug, sport_format, match_duration, points_for_win, points_for_draw, points_for_loss, status, created_at, updated_at, is_deleted)
            VALUES
                (:tourn_x, :org_id, :season_id, 'Torneo Apertura X', :slug_x, 'LEAGUE_ROUND_ROBIN', 90, 3, 1, 0, 'ACTIVE', now(), now(), false),
                (:tourn_y, :org_id, :season_id, 'Torneo Clausura Y', :slug_y, 'LEAGUE_ROUND_ROBIN', 90, 3, 1, 0, 'ACTIVE', now(), now(), false);
        """), {
            "tourn_x": tourn_x_id, "tourn_y": tourn_y_id,
            "org_id": org_id, "season_id": season_id,
            "slug_x": f"tourn-x-{uid}", "slug_y": f"tourn-y-{uid}"
        })

        # Teams A and B
        await conn.execute(text("""
            INSERT INTO teams (id, organization_id, name, short_code, city, primary_color, secondary_color, created_at, updated_at, is_deleted)
            VALUES
                (:team_a, :org_id, 'Club Apolo A', 'CPA', 'Apolo', '#1a4fd6', '#ffffff', now(), now(), false),
                (:team_b, :org_id, 'Club Deportivo B', 'CDB', 'Madidi', '#15803d', '#ffffff', now(), now(), false);
        """), {"team_a": team_a_id, "team_b": team_b_id, "org_id": org_id})

        # Matchdays & Matches in X and Y
        md_x_id = uuid.uuid4()
        md_y_id = uuid.uuid4()
        await conn.execute(text("""
            INSERT INTO matchdays (id, organization_id, tournament_id, number, name, round_type, created_at, updated_at, is_deleted)
            VALUES
                (:md_x, :org_id, :tourn_x, 1, 'Jornada 1', 'REGULAR', now(), now(), false),
                (:md_y, :org_id, :tourn_y, 1, 'Jornada 1', 'REGULAR', now(), now(), false);
        """), {"md_x": md_x_id, "md_y": md_y_id, "org_id": org_id, "tourn_x": tourn_x_id, "tourn_y": tourn_y_id})

        await conn.execute(text("""
            INSERT INTO matches (id, organization_id, tournament_id, matchday_id, home_team_id, away_team_id, status, home_score, away_score, current_minute, is_referee_signed, scheduled_at, created_at, updated_at, is_deleted)
            VALUES
                (:match_x, :org_id, :tourn_x, :md_x, :team_a, :team_b, 'EN_JUEGO', 1, 0, 45, false, now(), now(), now(), false),
                (:match_y, :org_id, :tourn_y, :md_y, :team_a, :team_b, 'EN_JUEGO', 0, 0, 10, false, now(), now(), now(), false);
        """), {
            "match_x": match_x_id, "match_y": match_y_id,
            "tourn_x": tourn_x_id, "tourn_y": tourn_y_id,
            "md_x": md_x_id, "md_y": md_y_id,
            "team_a": team_a_id, "team_b": team_b_id,
            "org_id": org_id
        })

        # Query system role IDs
        role_rows = await conn.execute(text("SELECT id, slug FROM roles WHERE organization_id IS NULL;"))
        role_id_map = {r[1]: r[0] for r in role_rows.fetchall()}

        # Assign user_roles:
        # 1. Admin has ADMIN_LIGA at LEAGUE level
        await conn.execute(text("""
            INSERT INTO user_roles (id, user_id, role_id, tenant_id, scope_type, scope_id, created_at, updated_at)
            VALUES (gen_random_uuid(), :u_id, :r_id, :org_id, 'LEAGUE', NULL, now(), now());
        """), {"u_id": user_admin_id, "r_id": role_id_map[SystemRole.ADMIN_LIGA.value], "org_id": org_id})

        # 2. Multi-user has ARBITRO in Tournament X, JUGADOR in Tournament Y
        await conn.execute(text("""
            INSERT INTO user_roles (id, user_id, role_id, tenant_id, scope_type, scope_id, created_at, updated_at)
            VALUES
                (gen_random_uuid(), :u_id, :r_arbitro, :org_id, 'TOURNAMENT', :tourn_x, now(), now()),
                (gen_random_uuid(), :u_id, :r_jugador, :org_id, 'TOURNAMENT', :tourn_y, now(), now());
        """), {
            "u_id": user_multi_id,
            "r_arbitro": role_id_map[SystemRole.ARBITRO.value],
            "r_jugador": role_id_map[SystemRole.JUGADOR.value],
            "org_id": org_id,
            "tourn_x": tourn_x_id,
            "tourn_y": tourn_y_id,
        })

        # 3. Spectator has ESPECTADOR at LEAGUE level
        await conn.execute(text("""
            INSERT INTO user_roles (id, user_id, role_id, tenant_id, scope_type, scope_id, created_at, updated_at)
            VALUES (gen_random_uuid(), :u_id, :r_id, :org_id, 'LEAGUE', NULL, now(), now());
        """), {"u_id": user_spectator_id, "r_id": role_id_map[SystemRole.ESPECTADOR.value], "org_id": org_id})

        # 4. Delegate has DELEGADO_EQUIPO in Team A
        await conn.execute(text("""
            INSERT INTO user_roles (id, user_id, role_id, tenant_id, scope_type, scope_id, created_at, updated_at)
            VALUES (gen_random_uuid(), :u_id, :r_id, :org_id, 'TEAM', :team_a, now(), now());
        """), {"u_id": user_delegate_id, "r_id": role_id_map[SystemRole.DELEGADO_EQUIPO.value], "org_id": org_id, "team_a": team_a_id})

    # Generate tokens
    def make_token(u_id, role_name):
        return create_access_token({
            "sub": str(u_id),
            "tenant_id": str(org_id),
            "role": role_name,
        })

    return {
        "org_id": org_id,
        "role_id_map": role_id_map,
        "admin": {"id": user_admin_id, "token": make_token(user_admin_id, "ADMIN_LIGA")},
        "multi": {"id": user_multi_id, "token": make_token(user_multi_id, "ARBITRO")},
        "spectator": {"id": user_spectator_id, "token": make_token(user_spectator_id, "ESPECTADOR")},
        "delegate": {"id": user_delegate_id, "token": make_token(user_delegate_id, "DELEGADO_EQUIPO")},
        "tourn_x_id": tourn_x_id,
        "tourn_y_id": tourn_y_id,
        "team_a_id": team_a_id,
        "team_b_id": team_b_id,
        "match_x_id": match_x_id,
        "match_y_id": match_y_id,
    }


@pytest.fixture
def test_client():
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


# --------------------------------------------------------------------------
# Test 1: Contextual Scope: Referee in Tourn X, Player in Tourn Y
# --------------------------------------------------------------------------
async def test_referee_in_tournament_x_and_player_in_tournament_y(rbac_seed, test_client):
    """
    Acceptance Criteria:
    Un mismo usuario es Árbitro en el Torneo X y Jugador en el Torneo Y:
    - Puede cerrar acta en X -> 200 OK.
    - Recibe 403 en Y -> 403 Forbidden ("Permiso insuficiente: Se requiere 'partidos:cerrar_acta'").
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        token = rbac_seed["multi"]["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Action on Match in Tournament X (where user is ARBITRO):
        res_x = await client.post(f"/api/v1/matches/{rbac_seed['match_x_id']}/close", headers=headers)
        assert res_x.status_code == 200, f"Expected 200 for closing match in Tourn X, got {res_x.status_code}: {res_x.text}"
        assert res_x.json()["status"] == "FINALIZADO"

        # 2. Action on Match in Tournament Y (where user is only JUGADOR):
        res_y = await client.post(f"/api/v1/matches/{rbac_seed['match_y_id']}/close", headers=headers)
        assert res_y.status_code == 403, f"Expected 403 for closing match in Tourn Y, got {res_y.status_code}: {res_y.text}"
        assert "Permiso insuficiente" in res_y.json()["detail"]


# --------------------------------------------------------------------------
# Test 2: Missing atomic permission immediately denied with 403
# --------------------------------------------------------------------------
async def test_missing_atomic_permission_denied_with_403(rbac_seed, test_client):
    """
    Acceptance Criteria:
    Usuario sin el permiso atómico específico -> 403 inmediato.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        spec_token = rbac_seed["spectator"]["token"]
        headers = {"Authorization": f"Bearer {spec_token}"}

        # Spectator tries to create a tournament (needs torneos:crear)
        res = await client.post(
            "/api/v1/tournaments/",
            json={"name": "Torneo Ilegal", "edition": "2026", "format": "ROUND_ROBIN"},
            headers=headers
        )
        assert res.status_code == 403
        assert "Permiso insuficiente" in res.json()["detail"]


# --------------------------------------------------------------------------
# Test 3: Sibling scope isolation: Team A permissions do not grant Team B
# --------------------------------------------------------------------------
async def test_sibling_scope_isolation(rbac_seed, test_client):
    """
    Acceptance Criteria:
    Rol asignado en un scope no concede acceso a otro scope hermano.
    Delegado of Team A can add player to Team A, but gets 403 on Team B.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        del_token = rbac_seed["delegate"]["token"]
        headers = {"Authorization": f"Bearer {del_token}"}

        # 1. Add player to Team A -> Allowed (201 Created)
        player_payload = {
            "first_name": "Carlos",
            "last_name": "Saucedo",
            "jersey_number": 9,
            "position": "FORWARD",
            "team_id": str(rbac_seed["team_a_id"])
        }
        res_a = await client.post(
            f"/api/v1/teams/{rbac_seed['team_a_id']}/players",
            json=player_payload,
            headers=headers
        )
        assert res_a.status_code == 201, f"Expected 201 for Team A, got {res_a.status_code}: {res_a.text}"

        # 2. Add player to Team B (sibling scope) -> 403 Forbidden
        player_payload_b = {
            "first_name": "Juan",
            "last_name": "Pérez",
            "jersey_number": 10,
            "position": "MIDFIELDER",
            "team_id": str(rbac_seed["team_b_id"])
        }
        res_b = await client.post(
            f"/api/v1/teams/{rbac_seed['team_b_id']}/players",
            json=player_payload_b,
            headers=headers
        )
        assert res_b.status_code == 403, f"Expected 403 for sibling Team B, got {res_b.status_code}: {res_b.text}"
        assert "Permiso insuficiente" in res_b.json()["detail"]


# --------------------------------------------------------------------------
# Test 4: Anti-privilege escalation & Role management
# --------------------------------------------------------------------------
async def test_anti_privilege_escalation(rbac_seed, test_client):
    """
    Acceptance Criteria:
    - Un usuario no puede asignarse un rol a sí mismo (anti-escalada).
    - Un usuario no puede otorgar permisos que no posee.
    - Los cambios de roles solo los ejecuta quien tenga roles:gestionar.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_headers = {"Authorization": f"Bearer {rbac_seed['admin']['token']}"}
        del_headers = {"Authorization": f"Bearer {rbac_seed['delegate']['token']}"}

        rbac_seed["role_id_map"][SystemRole.ADMIN_LIGA.value]
        arbitro_role_id = rbac_seed["role_id_map"][SystemRole.ARBITRO.value]

        # 1. Admin tries to assign a role to THEMSELVES -> Blocked with 400
        res_self = await client.post(
            "/api/v1/roles/assign",
            json={
                "user_id": str(rbac_seed["admin"]["id"]),
                "role_id": str(arbitro_role_id),
                "scope_type": "LEAGUE",
                "scope_id": None
            },
            headers=admin_headers
        )
        assert res_self.status_code == 400
        assert "Anti-escalada" in res_self.json()["detail"]

        # 2. Delegate (without roles:gestionar) tries to assign a role -> 403 Forbidden
        res_del_assign = await client.post(
            "/api/v1/roles/assign",
            json={
                "user_id": str(rbac_seed["spectator"]["id"]),
                "role_id": str(arbitro_role_id),
                "scope_type": "LEAGUE",
                "scope_id": None
            },
            headers=del_headers
        )
        assert res_del_assign.status_code == 403

        # 3. Legitimate assignment by Admin to Spectator -> 201 Created
        res_ok = await client.post(
            "/api/v1/roles/assign",
            json={
                "user_id": str(rbac_seed["spectator"]["id"]),
                "role_id": str(arbitro_role_id),
                "scope_type": "TOURNAMENT",
                "scope_id": str(rbac_seed["tourn_x_id"])
            },
            headers=admin_headers
        )
        assert res_ok.status_code == 201
        assignment_id = res_ok.json()["id"]

        # 4. Revocation of assignment by Admin -> 204 No Content
        res_rev = await client.delete(f"/api/v1/roles/assignments/{assignment_id}", headers=admin_headers)
        assert res_rev.status_code == 204


# --------------------------------------------------------------------------
# Test 5: Scope hierarchy (LEAGUE supersedes TOURNAMENT and TEAM)
# --------------------------------------------------------------------------
async def test_scope_hierarchy_league_supersedes_all(rbac_seed, test_client):
    """Admin Liga with LEAGUE scope can operate on any tournament and any team."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_headers = {"Authorization": f"Bearer {rbac_seed['admin']['token']}"}

        # Operates on Tourn X
        res_x = await client.post(
            f"/api/v1/tournaments/{rbac_seed['tourn_x_id']}/generate-fixtures",
            headers=admin_headers
        )
        assert res_x.status_code == 201

        # Operates on Tourn Y
        res_y = await client.post(
            f"/api/v1/tournaments/{rbac_seed['tourn_y_id']}/generate-fixtures",
            headers=admin_headers
        )
        assert res_y.status_code == 201


# --------------------------------------------------------------------------
# Test 6: Role permissions matrix coverage
# --------------------------------------------------------------------------
async def test_all_catalog_permissions_in_matrix():
    """Verifies every atomic permission in PermissionName is assigned to SUPER_ADMIN and properly categorized."""
    all_perms = set(PermissionName)
    super_perms = set(ROLE_PERMISSIONS_MATRIX[SystemRole.SUPER_ADMIN])
    assert all_perms == super_perms, "SUPER_ADMIN must possess 100% of canonical permissions."
    assert len(all_perms) == 34, f"Expected 34 atomic permissions, found {len(all_perms)}"


# --------------------------------------------------------------------------
# Test 7: Parametric access & rejection coverage for all 34 catalog permissions
# --------------------------------------------------------------------------
@pytest.mark.parametrize("perm", list(PermissionName))
async def test_every_catalog_permission_has_grant_and_deny(perm, rbac_seed):
    """
    Acceptance Criteria:
    Cada permiso del catálogo tiene al menos una prueba de acceso y una de rechazo.
    """
    engine_test = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(engine_test, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # 1. Admin Liga user (has 30 out of 34 permissions)
        admin_user_res = await session.execute(
            select(User).where(User.id == rbac_seed["admin"]["id"])
        )
        admin_user = admin_user_res.scalar_one()

        has_perm_admin = await RBACService.user_has_permission_in_scopes(
            db=session,
            user=admin_user,
            tenant_id=rbac_seed["org_id"],
            permission_name=perm.value,
            target_scopes=[("LEAGUE", None)],
        )

        # 2. Spectator user (only has 4 view permissions)
        spec_user_res = await session.execute(
            select(User).where(User.id == rbac_seed["spectator"]["id"])
        )
        spec_user = spec_user_res.scalar_one()

        has_perm_spec = await RBACService.user_has_permission_in_scopes(
            db=session,
            user=spec_user,
            tenant_id=rbac_seed["org_id"],
            permission_name=perm.value,
            target_scopes=[("LEAGUE", None)],
        )

        admin_expected = perm in ROLE_PERMISSIONS_MATRIX[SystemRole.ADMIN_LIGA]
        spec_expected = perm in ROLE_PERMISSIONS_MATRIX[SystemRole.ESPECTADOR]

        assert has_perm_admin == admin_expected, (
            f"Admin permission check mismatch for {perm.value}: got {has_perm_admin}, expected {admin_expected}"
        )
        assert has_perm_spec == spec_expected, (
            f"Spectator permission check mismatch for {perm.value}: got {has_perm_spec}, expected {spec_expected}"
        )

        # 3. Super Admin has GRANT on all 34
        super_user = User(id=uuid.uuid4(), role=SystemRole.SUPER_ADMIN.value)
        has_perm_super = await RBACService.user_has_permission_in_scopes(
            db=session,
            user=super_user,
            tenant_id=rbac_seed["org_id"],
            permission_name=perm.value,
            target_scopes=[("LEAGUE", None)],
        )
        assert has_perm_super is True, f"SUPER_ADMIN must have {perm.value}"

        # 4. Unassigned dummy user has DENIED on all 34
        dummy_user = User(id=uuid.uuid4(), role="UNASSIGNED")
        has_perm_dummy = await RBACService.user_has_permission_in_scopes(
            db=session,
            user=dummy_user,
            tenant_id=rbac_seed["org_id"],
            permission_name=perm.value,
            target_scopes=[("LEAGUE", None)],
        )
        assert has_perm_dummy is False, f"Unassigned user must be DENIED {perm.value}"
