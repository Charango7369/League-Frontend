"""Enable Row Level Security and configure tenant isolation policies

Revision ID: 004_row_level_security
Revises: 003_multitenant_schema
Create Date: 2026-10-31 11:00:00.000000

"""
from alembic import op

revision = '004_row_level_security'
down_revision = '003_multitenant_schema'
branch_labels = None
depends_on = None

STANDARD_TENANT_TABLES = [
    'subscriptions',
    'seasons',
    'tournaments',
    'matchdays',
    'teams',
    'venues',
    'matches',
    'match_events',
    'players',
    'player_statistics',
    'referees',
    'referee_assignments',
    'standings',
    'audit_logs',
]

def upgrade() -> None:
    # 1. Ensure app_user exists and has needed permissions
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
                CREATE ROLE app_user WITH LOGIN PASSWORD 'app_user_password_2026_secure' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
            END IF;
        END
        $$;
    """)
    op.execute("GRANT USAGE ON SCHEMA public TO app_user;")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;")
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;")

    # 2. organizations table (tenant id is id)
    op.execute("ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE organizations FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON organizations;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON organizations FOR ALL TO app_user
        USING (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)

    # 3. tenant_memberships table (tenant id is tenant_id)
    op.execute("ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE tenant_memberships FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON tenant_memberships;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON tenant_memberships FOR ALL TO app_user
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)

    # 4. Standard tables with organization_id
    for tbl in STANDARD_TENANT_TABLES:
        op.execute(f"ALTER TABLE {tbl} ENABLE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} FORCE ROW LEVEL SECURITY;")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {tbl} FOR ALL TO app_user
            USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
            WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
        """)

    # 5. users table (tenant membership or direct organization_id)
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY;")
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON users;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON users FOR ALL TO app_user
        USING (
            organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR EXISTS (
                SELECT 1 FROM tenant_memberships tm
                WHERE tm.user_id = users.id
                AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
        )
        WITH CHECK (
            organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            OR EXISTS (
                SELECT 1 FROM tenant_memberships tm
                WHERE tm.user_id = users.id
                AND tm.tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
            )
        );
    """)

def downgrade() -> None:
    all_tables = ['organizations', 'tenant_memberships', 'users'] + STANDARD_TENANT_TABLES
    for tbl in all_tables:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {tbl};")
        op.execute(f"ALTER TABLE {tbl} NO FORCE ROW LEVEL SECURITY;")
        op.execute(f"ALTER TABLE {tbl} DISABLE ROW LEVEL SECURITY;")
