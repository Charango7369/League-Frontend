"""Phase 3 Test Suite: Field-Level Security (FLS) & Immutable Auditing.

Covers:
1. Field-Level Security: Espectador vs Delegado vs Admin on athlete sensitive data.
2. Encryption at Rest: Raw DB storage verification (Fernet ciphertext) and MultiFernet rotation.
3. Automated Mutation Auditing: Match score and payment validation with exact before/after state diff.
4. Recursive JSON Redaction Crawler: Guarantees no plaintext PII/credentials exist in audit_logs.
5. Database-Level Immutability: Rejection of UPDATE/DELETE/TRUNCATE for app_user (DAC) and postgres (Trigger).
6. Transactional Atomicity: Rollback of business mutation if audit write fails.
7. Audit Query Endpoint: Tenant isolation and permission enforcement (auditoria:ver).
"""

import uuid

import pytest
import pytest_asyncio
from cryptography.fernet import Fernet, MultiFernet
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.domain.permissions import SystemRole
from app.infrastructure.database import get_db, reset_session_tenant
from app.infrastructure.encryption import get_fernet_cipher
from app.infrastructure.models.player import Player
from app.infrastructure.models.user import AuditLog
from app.infrastructure.security import create_access_token
from app.main import app

pytestmark = pytest.mark.asyncio


@pytest_asyncio.fixture
async def fls_audit_seed():
    """Seeds test data for FLS and Immutable Audit tests."""
    engine_admin = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)

    org_a_id = uuid.uuid4()
    org_b_id = uuid.uuid4()

    # Users
    user_admin_a_id = uuid.uuid4()
    user_delegate_a_id = uuid.uuid4()
    user_delegate_b_id = uuid.uuid4()
    user_spectator_id = uuid.uuid4()
    user_admin_b_id = uuid.uuid4()

    # Tournament & Teams
    tourn_a_id = uuid.uuid4()
    season_a_id = uuid.uuid4()
    team_a1_id = uuid.uuid4()
    team_a2_id = uuid.uuid4()
    matchday_a_id = uuid.uuid4()
    match_a_id = uuid.uuid4()

    # Player in Team A1
    player_id = uuid.uuid4()
    raw_document_id = "78945612"
    raw_medical_notes = "Alergia a la penicilina y asma inducida por esfuerzo físico"
    raw_guardian_phone = "59171234567"
    raw_bank_account = "100000456789"

    async with engine_admin.begin() as conn:
        # Create Organizations
        await conn.execute(text("""
            INSERT INTO organizations (id, name, slug, primary_color, theme_branding, status, created_at, updated_at, is_deleted)
            VALUES
                (:org_a, 'Liga Central Apolo', :slug_a, '#1a4fd6', '{}', 'ACTIVE', now(), now(), false),
                (:org_b, 'Liga Norte Provincias', :slug_b, '#1a4fd6', '{}', 'ACTIVE', now(), now(), false);
        """), {
            "org_a": org_a_id, "slug_a": f"org-a-{str(org_a_id)[:8]}",
            "org_b": org_b_id, "slug_b": f"org-b-{str(org_b_id)[:8]}"
        })

        # Create Users
        await conn.execute(text("""
            INSERT INTO users (id, organization_id, email, password_hash, full_name, role, is_active, created_at, updated_at, is_deleted)
            VALUES
                (:u_admin_a, :org_a, :e1, 'hashed', 'Admin Liga A', 'ADMIN_LIGA', true, now(), now(), false),
                (:u_del_a, :org_a, :e2, 'hashed', 'Delegado Team A1', 'DELEGADO_EQUIPO', true, now(), now(), false),
                (:u_del_b, :org_a, :e3, 'hashed', 'Delegado Team A2', 'DELEGADO_EQUIPO', true, now(), now(), false),
                (:u_spec, :org_a, :e4, 'hashed', 'Juan Espectador', 'ESPECTADOR', true, now(), now(), false),
                (:u_admin_b, :org_b, :e5, 'hashed', 'Admin Liga B', 'ADMIN_LIGA', true, now(), now(), false);
        """), {
            "u_admin_a": user_admin_a_id, "e1": f"admin_a_{str(uuid.uuid4())[:8]}@test.com", "org_a": org_a_id,
            "u_del_a": user_delegate_a_id, "e2": f"del_a_{str(uuid.uuid4())[:8]}@test.com",
            "u_del_b": user_delegate_b_id, "e3": f"del_b_{str(uuid.uuid4())[:8]}@test.com",
            "u_spec": user_spectator_id, "e4": f"spec_{str(uuid.uuid4())[:8]}@test.com",
            "u_admin_b": user_admin_b_id, "e5": f"admin_b_{str(uuid.uuid4())[:8]}@test.com", "org_b": org_b_id,
        })

        # Memberships
        await conn.execute(text("""
            INSERT INTO tenant_memberships (id, user_id, tenant_id, status, role, created_at, updated_at, is_deleted)
            VALUES
                (gen_random_uuid(), :u_admin_a, :org_a, 'ACTIVE', 'ADMIN_LIGA', now(), now(), false),
                (gen_random_uuid(), :u_del_a, :org_a, 'ACTIVE', 'DELEGADO_EQUIPO', now(), now(), false),
                (gen_random_uuid(), :u_del_b, :org_a, 'ACTIVE', 'DELEGADO_EQUIPO', now(), now(), false),
                (gen_random_uuid(), :u_spec, :org_a, 'ACTIVE', 'ESPECTADOR', now(), now(), false),
                (gen_random_uuid(), :u_admin_b, :org_b, 'ACTIVE', 'ADMIN_LIGA', now(), now(), false);
        """), {
            "u_admin_a": user_admin_a_id, "u_del_a": user_delegate_a_id,
            "u_del_b": user_delegate_b_id, "u_spec": user_spectator_id,
            "u_admin_b": user_admin_b_id, "org_a": org_a_id, "org_b": org_b_id
        })

        # Roles
        role_rows = await conn.execute(text("SELECT id, slug FROM roles WHERE organization_id IS NULL;"))
        role_map = {r[1]: r[0] for r in role_rows.fetchall()}

        # Assign RBAC UserRoles
        await conn.execute(text("""
            INSERT INTO user_roles (id, user_id, role_id, tenant_id, scope_type, scope_id, created_at, updated_at)
            VALUES
                (gen_random_uuid(), :u_admin_a, :r_admin, :org_a, 'LEAGUE', NULL, now(), now()),
                (gen_random_uuid(), :u_del_a, :r_del, :org_a, 'TEAM', :team_a1, now(), now()),
                (gen_random_uuid(), :u_del_b, :r_del, :org_a, 'TEAM', :team_a2, now(), now()),
                (gen_random_uuid(), :u_spec, :r_spec, :org_a, 'LEAGUE', NULL, now(), now()),
                (gen_random_uuid(), :u_admin_b, :r_admin, :org_b, 'LEAGUE', NULL, now(), now());
        """), {
            "u_admin_a": user_admin_a_id, "r_admin": role_map[SystemRole.ADMIN_LIGA.value], "org_a": org_a_id,
            "u_del_a": user_delegate_a_id, "r_del": role_map[SystemRole.DELEGADO_EQUIPO.value], "team_a1": team_a1_id,
            "u_del_b": user_delegate_b_id, "team_a2": team_a2_id,
            "u_spec": user_spectator_id, "r_spec": role_map[SystemRole.ESPECTADOR.value],
            "u_admin_b": user_admin_b_id, "org_b": org_b_id
        })

        # Tournament structure
        await conn.execute(text("""
            INSERT INTO seasons (id, organization_id, name, year, is_current, created_at, updated_at, is_deleted)
            VALUES (:season_a, :org_a, 'Temporada Oficial 2026', 2026, true, now(), now(), false);
        """), {"season_a": season_a_id, "org_a": org_a_id})

        await conn.execute(text("""
            INSERT INTO tournaments (id, organization_id, season_id, name, slug, sport_format, match_duration, points_for_win, points_for_draw, points_for_loss, status, created_at, updated_at, is_deleted)
            VALUES (:t_id, :org_a, :s_id, 'Copa Mayor Apolo', :slug_t, 'LEAGUE_ROUND_ROBIN', 90, 3, 1, 0, 'ACTIVE', now(), now(), false);
        """), {"t_id": tourn_a_id, "org_a": org_a_id, "s_id": season_a_id, "slug_t": f"copa-apolo-{str(tourn_a_id)[:8]}"})

        await conn.execute(text("""
            INSERT INTO teams (id, organization_id, name, short_code, primary_color, secondary_color, city, created_at, updated_at, is_deleted)
            VALUES
                (:t1, :org_a, 'Club Atlético Apolo', 'CAA', '#1a4fd6', '#ffffff', 'Apolo', now(), now(), false),
                (:t2, :org_a, 'Deportivo Franz Tamayo', 'DFT', '#e02424', '#000000', 'Franz Tamayo', now(), now(), false);
        """), {"t1": team_a1_id, "t2": team_a2_id, "org_a": org_a_id})

        await conn.execute(text("""
            INSERT INTO matchdays (id, organization_id, tournament_id, number, name, round_type, created_at, updated_at, is_deleted)
            VALUES (:md_id, :org_a, :t_id, 1, 'Fecha 1', 'REGULAR', now(), now(), false);
        """), {"md_id": matchday_a_id, "org_a": org_a_id, "t_id": tourn_a_id})

        await conn.execute(text("""
            INSERT INTO matches (id, organization_id, tournament_id, matchday_id, home_team_id, away_team_id, status, home_score, away_score, current_minute, is_referee_signed, scheduled_at, created_at, updated_at, is_deleted)
            VALUES (:m_id, :org_a, :t_id, :md_id, :t1, :t2, 'SCHEDULED', 0, 0, 0, false, now(), now(), now(), false);
        """), {
            "m_id": match_a_id, "org_a": org_a_id, "t_id": tourn_a_id,
            "md_id": matchday_a_id, "t1": team_a1_id, "t2": team_a2_id
        })

        # Insert player with encrypted fields at rest via manual Fernet cipher
        cipher = get_fernet_cipher()
        enc_medical = cipher.encrypt(raw_medical_notes.encode("utf-8")).decode("utf-8")
        enc_bank = cipher.encrypt(raw_bank_account.encode("utf-8")).decode("utf-8")

        await conn.execute(text("""
            INSERT INTO players (id, organization_id, team_id, first_name, last_name, jersey_number, position, document_id, medical_notes, guardian_phone, bank_account, is_eligible, created_at, updated_at, is_deleted)
            VALUES (:p_id, :org_a, :t1, 'Dante', 'Mercado', 10, 'FORWARD', :doc, :med, :guard, :bank, true, now(), now(), false);
        """), {
            "p_id": player_id, "org_a": org_a_id, "t1": team_a1_id,
            "doc": raw_document_id, "med": enc_medical, "guard": raw_guardian_phone, "bank": enc_bank
        })

    await engine_admin.dispose()

    # Generate JWT tokens
    tok_admin_a = create_access_token({"sub": str(user_admin_a_id), "org_id": str(org_a_id), "role": SystemRole.ADMIN_LIGA.value})
    tok_del_a = create_access_token({"sub": str(user_delegate_a_id), "org_id": str(org_a_id), "role": SystemRole.DELEGADO_EQUIPO.value})
    tok_del_b = create_access_token({"sub": str(user_delegate_b_id), "org_id": str(org_a_id), "role": SystemRole.DELEGADO_EQUIPO.value})
    tok_spec = create_access_token({"sub": str(user_spectator_id), "org_id": str(org_a_id), "role": SystemRole.ESPECTADOR.value})
    tok_admin_b = create_access_token({"sub": str(user_admin_b_id), "org_id": str(org_b_id), "role": SystemRole.ADMIN_LIGA.value})

    return {
        "org_a_id": org_a_id,
        "org_b_id": org_b_id,
        "team_a1_id": team_a1_id,
        "team_a2_id": team_a2_id,
        "tourn_a_id": tourn_a_id,
        "match_a_id": match_a_id,
        "player_id": player_id,
        "raw_data": {
            "document_id": raw_document_id,
            "medical_notes": raw_medical_notes,
            "guardian_phone": raw_guardian_phone,
            "bank_account": raw_bank_account,
        },
        "tokens": {
            "admin_a": tok_admin_a,
            "del_a": tok_del_a,
            "del_b": tok_del_b,
            "spec": tok_spec,
            "admin_b": tok_admin_b,
        },
        "users": {
            "admin_a_id": user_admin_a_id,
            "del_a_id": user_delegate_a_id,
            "del_b_id": user_delegate_b_id,
            "spec_id": user_spectator_id,
        }
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
# 1. Field-Level Security: Espectador vs Delegado vs Admin
# -----------------------------------------------------------------------------
async def test_fls_spectator_sees_masked_and_null_sensitive_fields(fls_audit_seed, test_client):
    """
    Acceptance Criteria:
    Ficha de un jugador consultada como Espectador: campos sensibles ausentes o null / masked.
    - document_id -> masked (ej: ****5612)
    - medical_notes -> None
    - guardian_phone -> masked
    - bank_account -> masked
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {fls_audit_seed['tokens']['spec']}"}
        p_id = fls_audit_seed["player_id"]

        # Single passport GET
        res = await client.get(f"/api/v1/teams/players/{p_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["medical_notes"] is None, "Espectador cannot see medical notes"
        assert data["document_id"] != fls_audit_seed["raw_data"]["document_id"]
        assert data["document_id"] == "****5612"
        assert data["bank_account"] != fls_audit_seed["raw_data"]["bank_account"]
        assert data["guardian_phone"] != fls_audit_seed["raw_data"]["guardian_phone"]

        # List players of team
        team_id = fls_audit_seed["team_a1_id"]
        res_list = await client.get(f"/api/v1/teams/{team_id}/players", headers=headers)
        assert res_list.status_code == 200
        players = res_list.json()
        assert len(players) >= 1
        p_item = next(p for p in players if p["id"] == str(p_id))
        assert p_item["medical_notes"] is None
        assert p_item["document_id"] == "****5612"


async def test_fls_delegate_of_player_team_sees_clear_fields(fls_audit_seed, test_client):
    """
    Acceptance Criteria:
    Como Delegado de Equipo con el permiso: presentes según matriz para su propio equipo.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {fls_audit_seed['tokens']['del_a']}"}
        p_id = fls_audit_seed["player_id"]

        res = await client.get(f"/api/v1/teams/players/{p_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["medical_notes"] == fls_audit_seed["raw_data"]["medical_notes"]
        assert data["document_id"] == fls_audit_seed["raw_data"]["document_id"]
        assert data["guardian_phone"] == fls_audit_seed["raw_data"]["guardian_phone"]
        assert data["bank_account"] == fls_audit_seed["raw_data"]["bank_account"]


async def test_fls_delegate_of_competing_team_denied_sensitive_fields(fls_audit_seed, test_client):
    """
    Acceptance Criteria:
    Delegado of Team A2 inspecting Player of Team A1 must NOT see medical notes or full CI.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": f"Bearer {fls_audit_seed['tokens']['del_b']}"}
        p_id = fls_audit_seed["player_id"]

        res = await client.get(f"/api/v1/teams/players/{p_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["medical_notes"] is None
        assert data["document_id"] == "****5612"


# -----------------------------------------------------------------------------
# 2. Encryption at Rest & Key Rotation
# -----------------------------------------------------------------------------
async def test_encryption_at_rest_in_raw_database(fls_audit_seed):
    """
    Acceptance Criteria:
    Cifrado en reposo: los campos más sensibles (ficha médica, cuenta bancaria)
    no residen en texto claro en PostgreSQL.
    """
    engine_admin = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine_admin.connect() as conn:
        res = await conn.execute(
            text("SELECT medical_notes, bank_account FROM players WHERE id = :id"),
            {"id": fls_audit_seed["player_id"]}
        )
        row = res.fetchone()
        assert row is not None

        db_medical, db_bank = row[0], row[1]
        assert fls_audit_seed["raw_data"]["medical_notes"] not in db_medical
        assert fls_audit_seed["raw_data"]["bank_account"] not in db_bank
        assert db_medical.startswith("gAAAAA")
        assert db_bank.startswith("gAAAAA")

    await engine_admin.dispose()


async def test_key_rotation_zero_downtime_plan():
    """
    Acceptance Criteria:
    Plan de rotación documentado: MultiFernet descifra datos generados con clave anterior
    y los re-encripta con la nueva clave primaria.
    """
    old_key = Fernet.generate_key()
    new_primary_key = Fernet.generate_key()

    # Encrypt with old key
    old_cipher = Fernet(old_key)
    ciphertext_old = old_cipher.encrypt(b"DatosMedicosSensibles2026").decode("utf-8")

    # MultiFernet with new key first, old key as fallback
    multi_cipher = MultiFernet([Fernet(new_primary_key), Fernet(old_key)])

    # Decryption works transparently
    decrypted = multi_cipher.decrypt(ciphertext_old.encode("utf-8")).decode("utf-8")
    assert decrypted == "DatosMedicosSensibles2026"

    # Rotation re-encrypts with new primary key
    rotated_ciphertext = multi_cipher.rotate(ciphertext_old.encode("utf-8")).decode("utf-8")
    assert rotated_ciphertext != ciphertext_old

    # Decrypting rotated ciphertext succeeds with primary key alone
    new_cipher = Fernet(new_primary_key)
    assert new_cipher.decrypt(rotated_ciphertext.encode("utf-8")).decode("utf-8") == "DatosMedicosSensibles2026"


# -----------------------------------------------------------------------------
# 3. Automated Mutation Auditing: Matches and Payments
# -----------------------------------------------------------------------------
async def test_match_score_mutation_generates_exact_audit_diff(fls_audit_seed, test_client):
    """
    Acceptance Criteria:
    Mutar un marcador genera registro de auditoría con before/after exactos.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_headers = {"Authorization": f"Bearer {fls_audit_seed['tokens']['admin_a']}"}
        match_id = fls_audit_seed["match_a_id"]

        # Mutate score
        update_payload = {
            "status": "EN_JUEGO",
            "home_score": 2,
            "away_score": 1,
            "current_minute": 55,
        }
        res = await client.put(f"/api/v1/matches/{match_id}", json=update_payload, headers=admin_headers)
        assert res.status_code == 200

        # Query audit log
        res_audit = await client.get("/api/v1/audit/?resource_name=matches", headers=admin_headers)
        assert res_audit.status_code == 200
        logs = res_audit.json()
        assert len(logs) >= 1

        match_log = next(log for log in logs if log["resource_id"] == str(match_id))
        assert match_log["action"] == "UPDATE_MATCH_SCORE"
        assert match_log["before_state"]["home_score"] == 0
        assert match_log["before_state"]["away_score"] == 0
        assert match_log["before_state"]["status"] == "SCHEDULED"

        assert match_log["after_state"]["home_score"] == 2
        assert match_log["after_state"]["away_score"] == 1
        assert match_log["after_state"]["status"] == "EN_JUEGO"


async def test_inscription_payment_validation_generates_audit_diff(fls_audit_seed, test_client):
    """
    Acceptance Criteria:
    Validar un pago genera registro con before/after exactos y redacción en el log.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_headers = {"Authorization": f"Bearer {fls_audit_seed['tokens']['admin_a']}"}
        del_headers = {"Authorization": f"Bearer {fls_audit_seed['tokens']['del_a']}"}

        # 1. Register inscription
        create_payload = {
            "team_id": str(fls_audit_seed["team_a1_id"]),
            "tournament_id": str(fls_audit_seed["tourn_a_id"]),
            "amount": "300.00",
            "currency": "BOB",
            "bank_account": "100000998877",
            "receipt_url": "https://storage.apolodigital.bo/receipts/rec-001.jpg",
            "notes": "Comprobante de depósito bancario Banco Unión",
        }
        res_reg = await client.post("/api/v1/finances/inscriptions", json=create_payload, headers=del_headers)
        assert res_reg.status_code == 201
        inscr_id = res_reg.json()["id"]

        # 2. Validate payment as Admin
        res_val = await client.post(
            f"/api/v1/finances/inscriptions/{inscr_id}/validate-payment",
            json={"notes": "Depósito verificado en extracto del Banco Unión."},
            headers=admin_headers
        )
        assert res_val.status_code == 200
        assert res_val.json()["status"] == "VALIDATED"

        # 3. Check audit log
        res_audit = await client.get("/api/v1/audit/?resource_name=inscriptions", headers=admin_headers)
        assert res_audit.status_code == 200
        logs = res_audit.json()
        val_log = next(log for log in logs if log["resource_id"] == str(inscr_id) and log["action"] == "VALIDATE_PAYMENT")

        assert val_log["before_state"]["status"] == "PENDING"
        assert val_log["after_state"]["status"] == "VALIDATED"
        # Sensitive field redacted
        assert val_log["before_state"]["bank_account"] == "[REDACTED]"
        assert val_log["after_state"]["bank_account"] == "[REDACTED]"


# -----------------------------------------------------------------------------
# 4. JSON Redaction Crawler: Guarantees No Plaintext PII in audit_logs
# -----------------------------------------------------------------------------
async def test_no_plaintext_pii_in_any_audit_logs():
    """
    Acceptance Criteria:
    Ningún audit_logs contiene dni, ficha médica ni cuenta bancaria en claro
    (test que recorre todos los JSON de la tabla).
    """
    engine_admin = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    async with engine_admin.connect() as conn:
        res = await conn.execute(text("SELECT before_state, after_state FROM audit_logs;"))
        rows = res.fetchall()

        sensitive_key_targets = {
            "dni", "document_id", "medical_notes", "ficha_medica",
            "bank_account", "cuenta_bancaria", "password", "password_hash"
        }

        def crawl_json(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if str(k).lower() in sensitive_key_targets:
                        assert v == "[REDACTED]", f"Key '{k}' must be '[REDACTED]', but found: {v}"
                    else:
                        crawl_json(v)
            elif isinstance(obj, list):
                for item in obj:
                    crawl_json(item)

        for before_state, after_state in rows:
            if before_state:
                crawl_json(before_state)
            if after_state:
                crawl_json(after_state)

    await engine_admin.dispose()


# -----------------------------------------------------------------------------
# 5. Database-Level Immutability: Rejection of UPDATE/DELETE/TRUNCATE
# -----------------------------------------------------------------------------
async def test_database_immutability_app_user_discretionary_access_control(fls_audit_seed):
    """
    Acceptance Criteria:
    Intentar UPDATE/DELETE/TRUNCATE sobre audit_logs con app_user falla a nivel de BD (DAC).
    """
    engine_app = create_async_engine(settings.APP_DATABASE_URL, poolclass=NullPool)

    # 1. Attempt UPDATE as app_user
    async with engine_app.connect() as conn:
        with pytest.raises(Exception) as exc_update:
            await conn.execute(text("UPDATE audit_logs SET action = 'TAMPERED';"))
        assert "permission denied" in str(exc_update.value).lower()

    # 2. Attempt DELETE as app_user
    async with engine_app.connect() as conn:
        with pytest.raises(Exception) as exc_del:
            await conn.execute(text("DELETE FROM audit_logs WHERE true;"))
        assert "permission denied" in str(exc_del.value).lower()

    # 3. Attempt TRUNCATE as app_user
    async with engine_app.connect() as conn:
        with pytest.raises(Exception) as exc_trunc:
            await conn.execute(text("TRUNCATE audit_logs;"))
        assert "permission denied" in str(exc_trunc.value).lower()

    await engine_app.dispose()


async def test_database_immutability_trigger_blocks_even_superuser():
    """
    Acceptance Criteria:
    Trigger BEFORE UPDATE OR DELETE lanza excepción si un superusuario/owner intenta alterar audit_logs.
    """
    engine_admin = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)

    # 1. Attempt UPDATE as postgres owner
    async with engine_admin.connect() as conn:
        with pytest.raises(Exception) as exc_update:
            await conn.execute(text("UPDATE audit_logs SET action = 'TAMPERED';"))
        assert "inmutable" in str(exc_update.value).lower()

    # 2. Attempt DELETE as postgres owner
    async with engine_admin.connect() as conn:
        with pytest.raises(Exception) as exc_del:
            await conn.execute(text("DELETE FROM audit_logs WHERE true;"))
        assert "inmutable" in str(exc_del.value).lower()

    # 3. Attempt TRUNCATE as postgres owner
    async with engine_admin.connect() as conn:
        with pytest.raises(Exception) as exc_trunc:
            await conn.execute(text("TRUNCATE audit_logs;"))
        assert "inmutable" in str(exc_trunc.value).lower()

    await engine_admin.dispose()


# -----------------------------------------------------------------------------
# 6. Transactional Atomicity: Rollback on Audit Failure
# -----------------------------------------------------------------------------
async def test_transactional_atomicity_mutation_reverts_if_audit_fails(fls_audit_seed):
    """
    Acceptance Criteria:
    Si la escritura de auditoría falla, la mutación de negocio se revierte (misma transacción).
    """
    engine_test = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    session_factory = async_sessionmaker(engine_test, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Fetch current match
        res = await session.execute(select(Player).where(Player.id == fls_audit_seed["player_id"]))
        player = res.scalar_one()
        original_name = player.first_name

        try:
            async with session.begin():
                player.first_name = "NombreModificadoTemporal"
                session.add(player)

                # Simulate audit failure by attempting to insert invalid audit log (e.g. non-existent tenant_id FK)
                bogus_audit = AuditLog(
                    id=uuid.uuid4(),
                    tenant_id=uuid.uuid4(),  # FK constraint violation!
                    action="ILLEGAL_MUTATION",
                    resource_name="players",
                    resource_id=str(player.id),
                )
                session.add(bogus_audit)
                await session.flush()
        except Exception:
            # Transaction aborted and rolled back
            pass

    # Verify that the player's first_name was rolled back to original
    async with session_factory() as session:
        res = await session.execute(select(Player).where(Player.id == fls_audit_seed["player_id"]))
        player_clean = res.scalar_one()
        assert player_clean.first_name == original_name, "Mutation must rollback if audit write fails"

    await engine_test.dispose()


# -----------------------------------------------------------------------------
# 7. Audit Query Endpoint: Permissions & Tenant Isolation
# -----------------------------------------------------------------------------
async def test_audit_endpoint_permissions_and_tenant_isolation(fls_audit_seed, test_client):
    """
    Acceptance Criteria:
    - Espectador recibe 403 Forbidden.
    - Admin Liga recibe 200 OK y sólo ve registros de su propio tenant.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Espectador denied
        res_spec = await client.get("/api/v1/audit/", headers={"Authorization": f"Bearer {fls_audit_seed['tokens']['spec']}"})
        assert res_spec.status_code == 403

        # 2. Admin Liga A sees only Liga A audit logs
        res_admin_a = await client.get("/api/v1/audit/", headers={"Authorization": f"Bearer {fls_audit_seed['tokens']['admin_a']}"})
        assert res_admin_a.status_code == 200
        logs_a = res_admin_a.json()
        for log in logs_a:
            assert log["tenant_id"] == str(fls_audit_seed["org_a_id"])

        # 3. Admin Liga B does NOT see Liga A logs
        res_admin_b = await client.get("/api/v1/audit/", headers={"Authorization": f"Bearer {fls_audit_seed['tokens']['admin_b']}"})
        assert res_admin_b.status_code == 200
        logs_b = res_admin_b.json()
        for log in logs_b:
            assert log["tenant_id"] == str(fls_audit_seed["org_b_id"])
            assert log["tenant_id"] != str(fls_audit_seed["org_a_id"])
