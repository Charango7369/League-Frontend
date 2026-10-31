"""Add tenant isolation to child tables and create tenant memberships

Revision ID: 003_multitenant_schema
Revises: 002_complete_base_tables
Create Date: 2026-10-31 10:30:00.000000

"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = '003_multitenant_schema'
down_revision = '002_complete_base_tables'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # -------------------------------------------------------------
    # 1. matchdays: (a) nullable, (b) backfill, (c) validate, (d) NOT NULL + FK + index
    # -------------------------------------------------------------
    op.add_column('matchdays', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE matchdays 
        SET organization_id = tournaments.organization_id 
        FROM tournaments 
        WHERE matchdays.tournament_id = tournaments.id;
    """)
    op.execute("""
        UPDATE matchdays 
        SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid 
        WHERE organization_id IS NULL;
    """)
    op.alter_column('matchdays', 'organization_id', nullable=False)
    op.create_foreign_key(
        'fk_matchdays_organization_id',
        'matchdays', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_matchdays_organization_id', 'matchdays', ['organization_id'])

    # -------------------------------------------------------------
    # 2. standings: (a) nullable, (b) backfill, (c) validate, (d) NOT NULL + FK + index
    # -------------------------------------------------------------
    op.add_column('standings', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE standings 
        SET organization_id = tournaments.organization_id 
        FROM tournaments 
        WHERE standings.tournament_id = tournaments.id;
    """)
    op.execute("""
        UPDATE standings 
        SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid 
        WHERE organization_id IS NULL;
    """)
    op.alter_column('standings', 'organization_id', nullable=False)
    op.create_foreign_key(
        'fk_standings_organization_id',
        'standings', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_standings_organization_id', 'standings', ['organization_id'])

    # -------------------------------------------------------------
    # 3. player_statistics: (a) nullable, (b) backfill, (c) validate, (d) NOT NULL + FK + index
    # -------------------------------------------------------------
    op.add_column('player_statistics', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE player_statistics 
        SET organization_id = tournaments.organization_id 
        FROM tournaments 
        WHERE player_statistics.tournament_id = tournaments.id;
    """)
    op.execute("""
        UPDATE player_statistics 
        SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid 
        WHERE organization_id IS NULL;
    """)
    op.alter_column('player_statistics', 'organization_id', nullable=False)
    op.create_foreign_key(
        'fk_player_statistics_organization_id',
        'player_statistics', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_player_statistics_organization_id', 'player_statistics', ['organization_id'])

    # -------------------------------------------------------------
    # 4. referee_assignments: (a) nullable, (b) backfill, (c) validate, (d) NOT NULL + FK + index
    # -------------------------------------------------------------
    op.add_column('referee_assignments', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("""
        UPDATE referee_assignments 
        SET organization_id = matches.organization_id 
        FROM matches 
        WHERE referee_assignments.match_id = matches.id;
    """)
    op.execute("""
        UPDATE referee_assignments 
        SET organization_id = '00000000-0000-0000-0000-000000000001'::uuid 
        WHERE organization_id IS NULL;
    """)
    op.alter_column('referee_assignments', 'organization_id', nullable=False)
    op.create_foreign_key(
        'fk_referee_assignments_organization_id',
        'referee_assignments', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_referee_assignments_organization_id', 'referee_assignments', ['organization_id'])

    # -------------------------------------------------------------
    # 5. tenant_memberships table
    # -------------------------------------------------------------
    op.create_table(
        'tenant_memberships',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='ACTIVE'),
        sa.Column('role', sa.String(40), nullable=False, server_default='MEMBER'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.UniqueConstraint('user_id', 'tenant_id', name='uq_tenant_membership_user_tenant')
    )
    op.create_index('ix_tenant_memberships_user_id', 'tenant_memberships', ['user_id'])
    op.create_index('ix_tenant_memberships_tenant_id', 'tenant_memberships', ['tenant_id'])

    # Backfill tenant_memberships from users with organization_id
    op.execute("""
        INSERT INTO tenant_memberships (id, user_id, tenant_id, status, role, created_at, updated_at, is_deleted)
        SELECT 
            gen_random_uuid(),
            id,
            organization_id,
            'ACTIVE',
            role,
            created_at,
            updated_at,
            false
        FROM users
        WHERE organization_id IS NOT NULL
        ON CONFLICT DO NOTHING;
    """)

def downgrade() -> None:
    op.drop_table('tenant_memberships')

    op.drop_constraint('fk_referee_assignments_organization_id', 'referee_assignments', type_='foreignkey')
    op.drop_index('ix_referee_assignments_organization_id', 'referee_assignments')
    op.drop_column('referee_assignments', 'organization_id')

    op.drop_constraint('fk_player_statistics_organization_id', 'player_statistics', type_='foreignkey')
    op.drop_index('ix_player_statistics_organization_id', 'player_statistics')
    op.drop_column('player_statistics', 'organization_id')

    op.drop_constraint('fk_standings_organization_id', 'standings', type_='foreignkey')
    op.drop_index('ix_standings_organization_id', 'standings')
    op.drop_column('standings', 'organization_id')

    op.drop_constraint('fk_matchdays_organization_id', 'matchdays', type_='foreignkey')
    op.drop_index('ix_matchdays_organization_id', 'matchdays')
    op.drop_column('matchdays', 'organization_id')
