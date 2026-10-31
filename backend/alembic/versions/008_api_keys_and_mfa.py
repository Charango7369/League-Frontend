"""008_api_keys_and_mfa

Revision ID: 008_api_keys_and_mfa
Revises: 007_match_state_machine_and_sod
Create Date: 2026-10-31 14:00:00.000000

"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision = '008_api_keys_and_mfa'
down_revision = '007_match_state_machine_and_sod'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------
    # 1. Alter users table for Multi-Factor Authentication (MFA/TOTP)
    # -------------------------------------------------------------
    op.add_column('users', sa.Column('mfa_enabled', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('mfa_secret_encrypted', sa.String(500), nullable=True))
    op.add_column('users', sa.Column('mfa_backup_codes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'))
    op.add_column('users', sa.Column('mfa_failed_attempts', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('users', sa.Column('mfa_locked_until', sa.DateTime(timezone=True), nullable=True))

    # -------------------------------------------------------------
    # 2. Create api_keys table for Scoped External Integrations
    # -------------------------------------------------------------
    op.create_table(
        'api_keys',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('prefix', sa.String(16), nullable=False, index=True),
        sa.Column('hashed_key', sa.String(255), nullable=False, unique=True, index=True),
        sa.Column('scopes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true', index=True),
        sa.Column('last_used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
    )

    # Enable Row-Level Security for multi-tenant isolation
    op.execute("ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE api_keys FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY tenant_isolation_policy ON api_keys FOR ALL TO app_user
        USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
        WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON api_keys TO app_user;")


def downgrade() -> None:
    # 2. Drop api_keys table and policy
    op.execute("DROP POLICY IF EXISTS tenant_isolation_policy ON api_keys;")
    op.drop_table('api_keys')

    # 1. Drop MFA columns from users table
    op.drop_column('users', 'mfa_locked_until')
    op.drop_column('users', 'mfa_failed_attempts')
    op.drop_column('users', 'mfa_backup_codes')
    op.drop_column('users', 'mfa_secret_encrypted')
    op.drop_column('users', 'mfa_enabled')
