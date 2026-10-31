"""Test Suite for Phase 4: State/Time Access Governance & Segregation of Duties (SoD / 4-Eyes Principle).

Acceptance Criteria:
1. Referee Official Sheet Editing:
   - Permitted while match is in progress (EN_JUEGO / LIVE).
   - Permitted within regulatory grace period (default 120 minutes) following match completion (FINALIZADO / FINISHED).
   - Past grace period: transition to strict read-only.
   - Editing past grace period requires explicit permission ('partidos:corregir_acta_cerrada') AND mandatory justification.
   - Omission of justification by administrator returns 400 Bad Request.
   - Missing permission returns 403 Forbidden and records BLOCKED_EXPIRED_MATCH_SHEET_EDIT in audit logs.
2. Server Clock Integrity:
   - Grace window calculation is strictly anchored to server clock in UTC and database finished_at.
   - Client-sent headers (Date, X-Client-Timestamp) or payload parameters are completely ignored.
3. Match State Machine Transitions:
   - Valid lifecycle transitions succeed (SCHEDULED -> LIVE -> FINALIZADO).
   - Invalid transitions (e.g. FINALIZADO -> SCHEDULED, CANCELLED -> LIVE) rejected with 400 Bad Request.
   - Recording match events on unstarted (SCHEDULED) matches rejected with 400 Bad Request.
4. Segregation of Duties (SoD / 4-Eyes Principle):
   - The user who registers/submits a payment voucher (registered_by) CANNOT approve/validate it.
   - Applies equally to Administrators and Team Delegates.
   - Violations are blocked with 403 Forbidden and recorded in audit logs as BLOCKED_SOD_VIOLATION.
   - Database-level CHECK constraint (chk_inscriptions_sod_4eyes) blocks direct SQL inserts with registered_by == approved_by.
   - Legitimate workflow where User A registers and User B approves succeeds with 200 OK.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.domain.permissions import SystemRole
from app.infrastructure.database import get_db, reset_session_tenant
from app.infrastructure.security import create_access_token
from app.main import app

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def state_sod_seed():
    """Seeds a controlled multi-user environment with roles, tournament, and matches."""
    org_id = uuid.uuid4()
    season_id = uuid.uuid4()
    tourn_id = uuid.uuid4()
    matchday_id = uuid.uuid4()
    team_home_id = uuid.uuid4()
    team_away_id = uuid.uuid4()
    match_live_id = uuid.uuid4()
    match_finished_id = uuid.uuid4()
    match_scheduled_id = uuid.uuid4()

    user_admin_id = uuid.uuid4()
    user_referee_id = uuid.uuid4()
    user_treasurer_id = uuid.uuid4()
    user_del_id = uuid.uuid4()

    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        # 1. Organization
        await conn.execute(text("""
            INSERT INTO organizations (id, name, slug, primary_color, theme_branding, status, created_at, updated_at, is_deleted)
            VALUES (:id, 'Liga Deportiva Apolo SoD', :slug, '#1a4fd6', '{}', 'ACTIVE', now(), now(), false);
        """), {
            "id": org_id,
            "slug": f"liga-sod-{str(org_id)[:8]}",
        })

        # 2. Users
        await conn.execute(text("""
            INSERT INTO users (id, organization_id, email, password_hash, full_name, role, is_active, created_at, updated_at, is_deleted)
            VALUES
                (:u_adm, :org, :e_adm, 'hashed', 'Admin SoD', 'ADMIN_LIGA', true, now(), now(), false),
                (:u_ref, :org, :e_ref, 'hashed', 'Arbitro FBF', 'ARBITRO', true, now(), now(), false),
                (:u_tre, :org, :e_tre, 'hashed', 'Tesorero Liga', 'GESTOR_FINANCIERO', true, now(), now(), false),
                (:u_del, :org, :e_del, 'hashed', 'Delegado Equipo', 'DELEGADO_EQUIPO', true, now(), now(), false);
        """), {
            "u_adm": user_admin_id, "e_adm": f"admin_sod_{str(uuid.uuid4())[:8]}@test.com", "org": org_id,
            "u_ref": user_referee_id, "e_ref": f"referee_sod_{str(uuid.uuid4())[:8]}@test.com",
            "u_tre": user_treasurer_id, "e_tre": f"treasurer_sod_{str(uuid.uuid4())[:8]}@test.com",
            "u_del": user_del_id, "e_del": f"del_sod_{str(uuid.uuid4())[:8]}@test.com",
        })

        # 3. Memberships
        await conn.execute(text("""
            INSERT INTO tenant_memberships (id, user_id, tenant_id, status, role, created_at, updated_at, is_deleted)
            VALUES
                (gen_random_uuid(), :u_adm, :org, 'ACTIVE', 'ADMIN_LIGA', now(), now(), false),
                (gen_random_uuid(), :u_ref, :org, 'ACTIVE', 'ARBITRO', now(), now(), false),
                (gen_random_uuid(), :u_tre, :org, 'ACTIVE', 'GESTOR_FINANCIERO', now(), now(), false),
                (gen_random_uuid(), :u_del, :org, 'ACTIVE', 'DELEGADO_EQUIPO', now(), now(), false);
        """), {
            "u_adm": user_admin_id, "u_ref": user_referee_id,
            "u_tre": user_treasurer_id, "u_del": user_del_id, "org": org_id
        })

        # 4. Role Assignments (User Roles)
        role_rows = await conn.execute(text("SELECT id, slug FROM roles WHERE organization_id IS NULL;"))
        role_map = {r[1]: r[0] for r in role_rows.fetchall()}

        await conn.execute(text("""
            INSERT INTO user_roles (id, user_id, role_id, tenant_id, scope_type, scope_id, created_at, updated_at)
            VALUES
                (gen_random_uuid(), :u_adm, :r_adm, :org, 'LEAGUE', NULL, now(), now()),
                (gen_random_uuid(), :u_ref, :r_ref, :org, 'LEAGUE', NULL, now(), now()),
                (gen_random_uuid(), :u_tre, :r_tre, :org, 'LEAGUE', NULL, now(), now()),
                (gen_random_uuid(), :u_del, :r_del, :org, 'TEAM', :t_home, now(), now());
        """), {
            "u_adm": user_admin_id, "r_adm": role_map[SystemRole.ADMIN_LIGA.value], "org": org_id,
            "u_ref": user_referee_id, "r_ref": role_map[SystemRole.ARBITRO.value],
            "u_tre": user_treasurer_id, "r_tre": role_map[SystemRole.GESTOR_FINANCIERO.value],
            "u_del": user_del_id, "r_del": role_map[SystemRole.DELEGADO_EQUIPO.value], "t_home": team_home_id
        })

        # 5. Tournament & Teams
        await conn.execute(text("""
            INSERT INTO seasons (id, organization_id, name, year, is_current, created_at, updated_at, is_deleted)
            VALUES (:s_id, :org, 'Temporada Clausura 2026', 2026, true, now(), now(), false);
        """), {"s_id": season_id, "org": org_id})

        await conn.execute(text("""
            INSERT INTO tournaments (id, organization_id, season_id, name, slug, sport_format, match_duration, points_for_win, points_for_draw, points_for_loss, status, created_at, updated_at, is_deleted)
            VALUES (:t_id, :org, :s_id, 'Torneo Apertura 2026', :slug_t, 'LEAGUE_ROUND_ROBIN', 90, 3, 1, 0, 'ACTIVE', now(), now(), false);
        """), {"t_id": tourn_id, "org": org_id, "s_id": season_id, "slug_t": f"torneo-sod-{str(tourn_id)[:8]}"})

        await conn.execute(text("""
            INSERT INTO matchdays (id, organization_id, tournament_id, number, name, round_type, created_at, updated_at, is_deleted)
            VALUES (:md_id, :org, :t_id, 1, 'Fecha 1', 'REGULAR', now(), now(), false);
        """), {"md_id": matchday_id, "org": org_id, "t_id": tourn_id})

        await conn.execute(text("""
            INSERT INTO teams (id, organization_id, name, short_code, primary_color, secondary_color, city, created_at, updated_at, is_deleted)
            VALUES
                (:t1, :org, 'Club Libertad Apolo', 'LIB', '#112233', '#ffffff', 'Apolo', now(), now(), false),
                (:t2, :org, 'Deportivo Franz Tamayo', 'DFT', '#445566', '#000000', 'Franz Tamayo', now(), now(), false);
        """), {"t1": team_home_id, "t2": team_away_id, "org": org_id})

        # 6. Matches with different initial states
        now_utc = datetime.now(UTC)
        # Match A: LIVE (in progress)
        await conn.execute(text("""
            INSERT INTO matches (id, organization_id, tournament_id, matchday_id, home_team_id, away_team_id, status, home_score, away_score, current_minute, is_referee_signed, scheduled_at, started_at, created_at, updated_at, is_deleted)
            VALUES (:m_id, :org, :t_id, :md_id, :t1, :t2, 'LIVE', 1, 1, 65, false, :now, :now, now(), now(), false);
        """), {"m_id": match_live_id, "org": org_id, "t_id": tourn_id, "md_id": matchday_id, "t1": team_home_id, "t2": team_away_id, "now": now_utc})

        # Match B: FINALIZADO (finished recently)
        await conn.execute(text("""
            INSERT INTO matches (id, organization_id, tournament_id, matchday_id, home_team_id, away_team_id, status, home_score, away_score, current_minute, is_referee_signed, scheduled_at, started_at, finished_at, created_at, updated_at, is_deleted)
            VALUES (:m_id, :org, :t_id, :md_id, :t1, :t2, 'FINALIZADO', 2, 1, 90, false, :now, :now, :fin, now(), now(), false);
        """), {"m_id": match_finished_id, "org": org_id, "t_id": tourn_id, "md_id": matchday_id, "t1": team_home_id, "t2": team_away_id, "now": now_utc - timedelta(hours=2), "fin": now_utc})

        # Match C: SCHEDULED
        await conn.execute(text("""
            INSERT INTO matches (id, organization_id, tournament_id, matchday_id, home_team_id, away_team_id, status, home_score, away_score, current_minute, is_referee_signed, scheduled_at, created_at, updated_at, is_deleted)
            VALUES (:m_id, :org, :t_id, :md_id, :t1, :t2, 'SCHEDULED', 0, 0, 0, false, :now, now(), now(), false);
        """), {"m_id": match_scheduled_id, "org": org_id, "t_id": tourn_id, "md_id": matchday_id, "t1": team_home_id, "t2": team_away_id, "now": now_utc + timedelta(days=2)})

    await engine.dispose()

    tokens = {
        "admin": create_access_token({"sub": str(user_admin_id), "tenant_id": str(org_id), "role": "ADMIN_LIGA", "type": "access"}),
        "referee": create_access_token({"sub": str(user_referee_id), "tenant_id": str(org_id), "role": "ARBITRO", "type": "access"}),
        "treasurer": create_access_token({"sub": str(user_treasurer_id), "tenant_id": str(org_id), "role": "GESTOR_FINANCIERO", "type": "access"}),
        "delegate": create_access_token({"sub": str(user_del_id), "tenant_id": str(org_id), "role": "DELEGADO_EQUIPO", "type": "access"}),
    }

    return {
        "org_id": org_id,
        "tourn_id": tourn_id,
        "team_home_id": team_home_id,
        "team_away_id": team_away_id,
        "match_live_id": match_live_id,
        "match_finished_id": match_finished_id,
        "match_scheduled_id": match_scheduled_id,
        "user_admin_id": user_admin_id,
        "user_referee_id": user_referee_id,
        "user_treasurer_id": user_treasurer_id,
        "user_del_id": user_del_id,
        "tokens": tokens,
    }


@pytest.fixture
def test_client():
    engine_test = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(engine_test, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as s:
            try:
                yield s
            finally:
                await reset_session_tenant(s)
                await s.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


# -----------------------------------------------------------------------------
# 1. Match Official Sheet: Referee editing during LIVE & Within Grace Period
# -----------------------------------------------------------------------------
async def test_referee_edits_match_sheet_while_live(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Árbitro edita acta EN_JUEGO / LIVE -> 200 OK.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ref_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['referee']}"}
        m_id = state_sod_seed["match_live_id"]

        update_payload = {"home_score": 2, "away_score": 1, "current_minute": 70}
        res = await client.put(f"/api/v1/matches/{m_id}", json=update_payload, headers=ref_headers)
        assert res.status_code == 200, f"Expected 200 for referee editing live match, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["home_score"] == 2
        assert data["away_score"] == 1
        assert data["current_minute"] == 70


async def test_referee_edits_match_sheet_within_grace_period(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Árbitro edita acta dentro de la ventana de gracia reglamentaria (15 min tras cierre <= 120 min) -> 200 OK.
    """
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    # Set match finished_at to 15 minutes ago
    async with engine.begin() as conn:
        recent_finish = datetime.now(UTC) - timedelta(minutes=15)
        await conn.execute(text("UPDATE matches SET finished_at = :fin WHERE id = :id;"), {
            "fin": recent_finish, "id": state_sod_seed["match_finished_id"]
        })
    await engine.dispose()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ref_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['referee']}"}
        m_id = state_sod_seed["match_finished_id"]

        update_payload = {"home_score": 3, "away_score": 1}
        res = await client.put(f"/api/v1/matches/{m_id}", json=update_payload, headers=ref_headers)
        assert res.status_code == 200, f"Expected 200 within grace period, got {res.status_code}: {res.text}"
        assert res.json()["home_score"] == 3


# -----------------------------------------------------------------------------
# 2. Match Official Sheet: Expired Grace Period (> 120 min) & Server Clock
# -----------------------------------------------------------------------------
async def test_referee_blocked_after_grace_period_expired(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Simular 3 horas tras el cierre (180 min > 120 min):
    - Actualización de marcador por árbitro -> 403 Forbidden.
    - Se registra intento bloqueado en auditoría (BLOCKED_EXPIRED_MATCH_SHEET_EDIT).
    """
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        expired_finish = datetime.now(UTC) - timedelta(hours=3)  # 180 minutes ago
        await conn.execute(text("UPDATE matches SET finished_at = :fin WHERE id = :id;"), {
            "fin": expired_finish, "id": state_sod_seed["match_finished_id"]
        })
    await engine.dispose()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ref_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['referee']}"}
        m_id = state_sod_seed["match_finished_id"]

        update_payload = {"home_score": 4, "away_score": 1}
        res = await client.put(f"/api/v1/matches/{m_id}", json=update_payload, headers=ref_headers)
        assert res.status_code == 403, f"Expected 403 for expired grace period, got {res.status_code}: {res.text}"
        assert "ventana reglamentaria de gracia" in res.json()["detail"].lower()

        # Verify audit log captures the blocked attempt
        admin_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['admin']}"}
        res_audit = await client.get("/api/v1/audit/?resource_name=matches", headers=admin_headers)
        assert res_audit.status_code == 200
        logs = res_audit.json()
        blocked_log = next((log_item for log_item in logs if log_item["action"] == "BLOCKED_EXPIRED_MATCH_SHEET_EDIT" and log_item["resource_id"] == str(m_id)), None)
        assert blocked_log is not None, "Expected BLOCKED_EXPIRED_MATCH_SHEET_EDIT in audit logs"
        assert blocked_log["user_id"] == str(state_sod_seed["user_referee_id"])


async def test_client_headers_or_payload_timestamps_cannot_bypass_grace_period(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Manipular cabeceras (Date, X-Client-Timestamp) o campos enviados por el cliente
    no altera la decisión del servidor (se basa estrictamente en server clock y finished_at).
    """
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        expired_finish = datetime.now(UTC) - timedelta(hours=3)
        await conn.execute(text("UPDATE matches SET finished_at = :fin WHERE id = :id;"), {
            "fin": expired_finish, "id": state_sod_seed["match_finished_id"]
        })
    await engine.dispose()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ref_headers = {
            "Authorization": f"Bearer {state_sod_seed['tokens']['referee']}",
            "Date": "Wed, 21 Oct 2026 07:28:00 GMT",
            "X-Client-Timestamp": "2026-10-31T12:00:00Z",
            "X-Client-Timezone": "America/La_Paz",
        }
        m_id = state_sod_seed["match_finished_id"]

        update_payload = {
            "home_score": 5,
            "away_score": 1,
            "client_timestamp": datetime.now(UTC).isoformat(),
        }
        res = await client.put(f"/api/v1/matches/{m_id}", json=update_payload, headers=ref_headers)
        assert res.status_code == 403, "Client header manipulation MUST NOT bypass server grace check"


# -----------------------------------------------------------------------------
# 3. Administrative Override with 'partidos:corregir_acta_cerrada' & Justification
# -----------------------------------------------------------------------------
async def test_admin_with_permission_and_justification_can_correct_closed_match(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Rol con 'partidos:corregir_acta_cerrada' edita tras ventana de gracia CON justificación:
    - 200 OK.
    - correction_notes actualizado con autor y justificación.
    - Auditoría registra UPDATE_MATCH_SCORE_CORRECTION_OVERRIDE con justificación.
    """
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        expired_finish = datetime.now(UTC) - timedelta(hours=4)
        await conn.execute(text("UPDATE matches SET finished_at = :fin WHERE id = :id;"), {
            "fin": expired_finish, "id": state_sod_seed["match_finished_id"]
        })
    await engine.dispose()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['admin']}"}
        m_id = state_sod_seed["match_finished_id"]

        justification_text = "Corrección oficial por resolución del Tribunal de Penas TP-014/2026"
        update_payload = {
            "home_score": 3,
            "away_score": 0,
            "justification": justification_text,
        }
        res = await client.put(f"/api/v1/matches/{m_id}", json=update_payload, headers=admin_headers)
        assert res.status_code == 200, f"Expected 200 for admin with justification, got {res.status_code}: {res.text}"
        data = res.json()
        assert data["home_score"] == 3
        assert data["away_score"] == 0
        assert data["correction_notes"] is not None
        assert justification_text in data["correction_notes"]

        # Check audit trail
        res_audit = await client.get("/api/v1/audit/?resource_name=matches", headers=admin_headers)
        logs = res_audit.json()
        corr_log = next((log_item for log_item in logs if log_item["action"] == "UPDATE_MATCH_SCORE_CORRECTION_OVERRIDE" and log_item["resource_id"] == str(m_id)), None)
        assert corr_log is not None
        assert corr_log["after_state"]["justification"] == justification_text


async def test_admin_without_justification_rejected_with_400(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Rol con permiso intenta corregir fuera de gracia SIN justificación -> 400 Bad Request.
    """
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        expired_finish = datetime.now(UTC) - timedelta(hours=3)
        await conn.execute(text("UPDATE matches SET finished_at = :fin WHERE id = :id;"), {
            "fin": expired_finish, "id": state_sod_seed["match_finished_id"]
        })
    await engine.dispose()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['admin']}"}
        m_id = state_sod_seed["match_finished_id"]

        # Missing justification
        res = await client.put(f"/api/v1/matches/{m_id}", json={"home_score": 3}, headers=admin_headers)
        assert res.status_code == 400
        assert "justificación formal obligatoria" in res.json()["detail"].lower()


# -----------------------------------------------------------------------------
# 4. Match State Machine Transitions
# -----------------------------------------------------------------------------
async def test_state_machine_invalid_reversion_rejected(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Transiciones de estado inválidas (ej: FINALIZADO -> SCHEDULED) son rechazadas con 400.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['admin']}"}
        m_id = state_sod_seed["match_finished_id"]

        # Reverting a finished match back to SCHEDULED
        res = await client.put(
            f"/api/v1/matches/{m_id}",
            json={"status": "SCHEDULED", "justification": "Reapertura no autorizada"},
            headers=admin_headers
        )
        assert res.status_code == 400
        assert "transición de estado inválida" in res.json()["detail"].lower()


async def test_record_events_on_unstarted_match_rejected(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Registrar incidencias (goles, tarjetas) en un partido en estado SCHEDULED -> 400 Bad Request.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        ref_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['referee']}"}
        m_id = state_sod_seed["match_scheduled_id"]

        event_payload = {
            "team_id": str(state_sod_seed["team_home_id"]),
            "event_type": "GOAL",
            "minute": 10,
        }
        res = await client.post(f"/api/v1/matches/{m_id}/events", json=event_payload, headers=ref_headers)
        assert res.status_code == 400
        assert "aún no ha iniciado" in res.json()["detail"]


# -----------------------------------------------------------------------------
# 5. Segregation of Duties (SoD / 4-Eyes Principle) in Finances & Inscriptions
# -----------------------------------------------------------------------------
async def test_admin_cannot_approve_own_registration_voucher(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Admin registra un comprobante de inscripción e intenta autoaprobarlo:
    - Servicio bloquea con 403 Forbidden.
    - Se registra auditoría BLOCKED_SOD_VIOLATION.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['admin']}"}

        # 1. Admin registers inscription voucher
        reg_payload = {
            "team_id": str(state_sod_seed["team_home_id"]),
            "tournament_id": str(state_sod_seed["tourn_id"]),
            "amount": "500.00",
            "currency": "BOB",
            "bank_account": "100000123456",
            "receipt_url": "https://storage.apolodigital.bo/receipts/rec-adm.jpg",
            "notes": "Comprobante registrado por Admin",
        }
        res_reg = await client.post("/api/v1/finances/inscriptions", json=reg_payload, headers=admin_headers)
        assert res_reg.status_code == 201
        inscr_id = res_reg.json()["id"]

        # 2. Admin attempts self-approval
        res_val = await client.post(
            f"/api/v1/finances/inscriptions/{inscr_id}/validate-payment",
            json={"notes": "Auto-validación por admin"},
            headers=admin_headers
        )
        assert res_val.status_code == 403, f"Expected 403 SoD violation, got {res_val.status_code}: {res_val.text}"
        assert "segregación de funciones" in res_val.json()["detail"].lower()

        # 3. Verify audit log captures SoD violation
        res_audit = await client.get("/api/v1/audit/?resource_name=inscriptions", headers=admin_headers)
        logs = res_audit.json()
        sod_log = next((log_item for log_item in logs if log_item["action"] == "BLOCKED_SOD_VIOLATION" and log_item["resource_id"] == str(inscr_id)), None)
        assert sod_log is not None, "Expected BLOCKED_SOD_VIOLATION audit log entry"
        assert sod_log["user_id"] == str(state_sod_seed["user_admin_id"])


async def test_delegate_cannot_approve_own_registration_voucher(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Delegado que registró comprobante no puede autoaprobarlo.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        del_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['delegate']}"}

        # 1. Delegate registers inscription
        reg_payload = {
            "team_id": str(state_sod_seed["team_home_id"]),
            "tournament_id": str(state_sod_seed["tourn_id"]),
            "amount": "400.00",
            "currency": "BOB",
            "bank_account": "100000789012",
            "receipt_url": "https://storage.apolodigital.bo/receipts/rec-del.jpg",
            "notes": "Comprobante de depósito de cuota de inscripción",
        }
        res_reg = await client.post("/api/v1/finances/inscriptions", json=reg_payload, headers=del_headers)
        assert res_reg.status_code == 201
        inscr_id = res_reg.json()["id"]

        # 2. Delegate attempts self-validation -> Denied (also lacks permission, but SoD protects)
        res_val = await client.post(
            f"/api/v1/finances/inscriptions/{inscr_id}/validate-payment",
            json={"notes": "Intento de auto-validación"},
            headers=del_headers
        )
        assert res_val.status_code == 403


async def test_four_eyes_legitimate_flow_succeeds(state_sod_seed, test_client):
    """
    Acceptance Criteria:
    Principio de 4 Ojos legítimo:
    - Usuario A (Delegado) registra comprobante.
    - Usuario B (Tesorero o Admin) valida y aprueba comprobante -> 200 OK.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        del_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['delegate']}"}
        treasurer_headers = {"Authorization": f"Bearer {state_sod_seed['tokens']['treasurer']}"}

        # 1. User A (Delegate) registers
        reg_payload = {
            "team_id": str(state_sod_seed["team_home_id"]),
            "tournament_id": str(state_sod_seed["tourn_id"]),
            "amount": "600.00",
            "currency": "BOB",
            "bank_account": "100000654321",
            "receipt_url": "https://storage.apolodigital.bo/receipts/rec-valid.jpg",
            "notes": "Pago de inscripción completado",
        }
        res_reg = await client.post("/api/v1/finances/inscriptions", json=reg_payload, headers=del_headers)
        assert res_reg.status_code == 201
        inscr_id = res_reg.json()["id"]

        # 2. User B (Treasurer) approves
        res_val = await client.post(
            f"/api/v1/finances/inscriptions/{inscr_id}/validate-payment",
            json={"notes": "Comprobante verificado con extracto bancario BNB"},
            headers=treasurer_headers
        )
        assert res_val.status_code == 200
        data = res_val.json()
        assert data["status"] == "VALIDATED"
        assert data["registered_by"] == str(state_sod_seed["user_del_id"])
        assert data["approved_by"] == str(state_sod_seed["user_treasurer_id"])


async def test_raw_database_check_constraint_blocks_self_approval(state_sod_seed):
    """
    Acceptance Criteria:
    A nivel de Base de Datos, el constraint 'chk_inscriptions_sod_4eyes'
    impide cualquier inserción directa donde approved_by == registered_by.
    """
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    user_id = state_sod_seed["user_admin_id"]
    org_id = state_sod_seed["org_id"]
    team_id = state_sod_seed["team_home_id"]
    tourn_id = state_sod_seed["tourn_id"]

    with pytest.raises(IntegrityError) as exc_info:
        async with engine.begin() as conn:
            await conn.execute(text("""
                INSERT INTO inscriptions (
                    id, organization_id, team_id, tournament_id, amount, currency, status,
                    registered_by, approved_by, created_at, updated_at, is_deleted
                ) VALUES (
                    gen_random_uuid(), :org, :team, :tourn, 100.00, 'BOB', 'VALIDATED',
                    :uid, :uid, now(), now(), false
                );
            """), {
                "org": org_id,
                "team": team_id,
                "tourn": tourn_id,
                "uid": user_id,
            })

    assert "chk_inscriptions_sod_4eyes" in str(exc_info.value).lower()
    await engine.dispose()
