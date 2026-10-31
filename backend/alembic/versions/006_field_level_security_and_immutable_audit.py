"""006_field_level_security_and_immutable_audit

Revision ID: 006_field_level_security_and_immutable_audit
Revises: 005_rbac_permissions_and_roles
Create Date: 2026-10-31 12:00:00.000000

"""
import uuid

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = '006_field_level_security_and_immutable_audit'
down_revision = '005_rbac_permissions_and_roles'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------
    # 1. Alter players: sensitive fields for FLS and encryption
    # -------------------------------------------------------------
    op.add_column('players', sa.Column('medical_notes', sa.Text(), nullable=True))
    op.add_column('players', sa.Column('guardian_phone', sa.String(40), nullable=True))
    op.add_column('players', sa.Column('bank_account', sa.String(255), nullable=True))

    # -------------------------------------------------------------
    # 2. Refactor audit_logs to conform to canonical schema
    # -------------------------------------------------------------
    # Drop existing RLS policy referencing organization_id before renaming
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;")

    # Rename columns to match exact canonical requirements
    op.alter_column('audit_logs', 'organization_id', new_column_name='tenant_id')
    op.alter_column('audit_logs', 'resource_type', new_column_name='resource_name')
    op.alter_column('audit_logs', 'payload_before', new_column_name='before_state')
    op.alter_column('audit_logs', 'payload_after', new_column_name='after_state')

    # Add user_agent
    op.add_column('audit_logs', sa.Column('user_agent', sa.String(255), nullable=True))

    # Enforce NOT NULL on tenant_id
    op.alter_column('audit_logs', 'tenant_id', nullable=False)

    # Indices
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('ix_audit_logs_resource_name', 'audit_logs', ['resource_name'])

    # Recreate RLS policy for audit_logs using tenant_id
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON audit_logs FOR ALL TO app_user
        USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)

    # -------------------------------------------------------------
    # 3. Database-level immutability for audit_logs
    # -------------------------------------------------------------
    # Layer A: Discretionary Access Control - Revoke UPDATE, DELETE, TRUNCATE from application user
    op.execute("REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM app_user;")

    # Layer B: Immutability Triggers - raise exception even if executed by superuser or table owner
    op.execute("""
        CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs es una tabla inmutable de solo insercion (no se permite UPDATE, DELETE ni TRUNCATE)';
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON audit_logs;")
    op.execute("""
        CREATE TRIGGER trg_immutable_audit_logs
        BEFORE UPDATE OR DELETE ON audit_logs
        FOR EACH ROW
        EXECUTE FUNCTION prevent_audit_log_modification();
    """)

    op.execute("DROP TRIGGER IF EXISTS trg_immutable_audit_logs_truncate ON audit_logs;")
    op.execute("""
        CREATE TRIGGER trg_immutable_audit_logs_truncate
        BEFORE TRUNCATE ON audit_logs
        FOR EACH STATEMENT
        EXECUTE FUNCTION prevent_audit_log_modification();
    """)

    # -------------------------------------------------------------
    # 4. Table inscriptions (Finances / Registrations)
    # -------------------------------------------------------------
    op.create_table(
        'inscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('tournament_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False, server_default='0.00'),
        sa.Column('currency', sa.String(10), nullable=False, server_default='BOB'),
        sa.Column('status', sa.String(30), nullable=False, server_default='PENDING'),
        sa.Column('receipt_url', sa.String(300), nullable=True),
        sa.Column('bank_account', sa.String(255), nullable=True),
        sa.Column('registered_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
    )

    op.execute("ALTER TABLE inscriptions ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE inscriptions FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON inscriptions FOR ALL TO app_user
        USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON inscriptions TO app_user;")


def downgrade() -> None:
    # 4. Drop inscriptions
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON inscriptions;")
    op.drop_table('inscriptions')

    # 3. Drop immutability triggers and restore grants
    op.execute("DROP TRIGGER IF EXISTS trg_immutable_audit_logs_truncate ON audit_logs;")
    op.execute("DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON audit_logs;")
    op.execute("DROP FUNCTION IF EXISTS prevent_audit_log_modification();")
    op.execute("GRANT UPDATE, DELETE, TRUNCATE ON audit_logs TO app_user;")

    # 2. Revert audit_logs
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON audit_logs;")
    op.drop_index('ix_audit_logs_resource_name', 'audit_logs')
    op.drop_index('ix_audit_logs_created_at', 'audit_logs')
    op.drop_column('audit_logs', 'user_agent')
    op.alter_column('audit_logs', 'tenant_id', nullable=True)
    op.alter_column('audit_logs', 'tenant_id', new_column_name='organization_id')
    op.alter_column('audit_logs', 'resource_name', new_column_name='resource_type')
    op.alter_column('audit_logs', 'before_state', new_column_name='payload_before')
    op.alter_column('audit_logs', 'after_state', new_column_name='payload_after')

    op.execute("""
        CREATE POLICY tenant_isolation_policy ON audit_logs FOR ALL TO app_user
        USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)

    # 1. Revert players
    op.drop_column('players', 'bank_account')
    op.drop_column('players', 'guardian_phone')
    op.drop_column('players', 'medical_notes')
