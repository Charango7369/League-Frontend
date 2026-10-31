"""Initial schema creation for Apolodigital League Multi-Tenant SaaS

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-10-30 00:00:00.000000

"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Organizations
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('slug', sa.String(80), nullable=False, unique=True),
        sa.Column('custom_domain', sa.String(150), nullable=True, unique=True),
        sa.Column('logo_url', sa.String(300), nullable=True),
        sa.Column('primary_color', sa.String(20), nullable=False, default='#1a4fd6'),
        sa.Column('theme_branding', postgresql.JSONB(), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
    )
    op.create_index('ix_organizations_slug', 'organizations', ['slug'])

    # 2. Subscriptions
    op.create_table(
        'subscriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan', sa.String(30), nullable=False, default='FREE'),
        sa.Column('status', sa.String(30), nullable=False, default='ACTIVE'),
        sa.Column('max_tournaments', sa.Integer(), nullable=False, default=2),
        sa.Column('max_teams', sa.Integer(), nullable=False, default=16),
        sa.Column('whatsapp_enabled', sa.Boolean(), nullable=False, default=False),
        sa.Column('ai_reporter_enabled', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
    )

    # 3. Users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True),
        sa.Column('email', sa.String(180), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(120), nullable=False),
        sa.Column('phone', sa.String(30), nullable=True),
        sa.Column('role', sa.String(40), nullable=False, default='PUBLIC_USER'),
        sa.Column('is_active', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # 4. Tournaments & Teams
    op.create_table(
        'seasons',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(80), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False, default=2026),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=False, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
    )

    op.create_table(
        'tournaments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('season_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('seasons.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('sport_format', sa.String(40), nullable=False, default='LEAGUE_ROUND_ROBIN'),
        sa.Column('match_duration', sa.Integer(), nullable=False, default=90),
        sa.Column('points_for_win', sa.Integer(), nullable=False, default=3),
        sa.Column('points_for_draw', sa.Integer(), nullable=False, default=1),
        sa.Column('points_for_loss', sa.Integer(), nullable=False, default=0),
        sa.Column('status', sa.String(30), nullable=False, default='ACTIVE'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
    )

    op.create_table(
        'teams',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(120), nullable=False),
        sa.Column('short_code', sa.String(6), nullable=False),
        sa.Column('city', sa.String(80), nullable=False, default='Apolo'),
        sa.Column('stadium_name', sa.String(120), nullable=True),
        sa.Column('coach_name', sa.String(100), nullable=True),
        sa.Column('logo_url', sa.String(300), nullable=True),
        sa.Column('primary_color', sa.String(20), nullable=False, default='#1a4fd6'),
        sa.Column('secondary_color', sa.String(20), nullable=False, default='#f0b429'),
        sa.Column('founded_year', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
    )

    # 5. Standings
    op.create_table(
        'standings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tournament_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False),
        sa.Column('played', sa.Integer(), nullable=False, default=0),
        sa.Column('won', sa.Integer(), nullable=False, default=0),
        sa.Column('drawn', sa.Integer(), nullable=False, default=0),
        sa.Column('lost', sa.Integer(), nullable=False, default=0),
        sa.Column('goals_for', sa.Integer(), nullable=False, default=0),
        sa.Column('goals_against', sa.Integer(), nullable=False, default=0),
        sa.Column('goal_difference', sa.Integer(), nullable=False, default=0),
        sa.Column('points', sa.Integer(), nullable=False, default=0),
        sa.Column('form', sa.String(30), nullable=False, default=''),
        sa.Column('position', sa.Integer(), nullable=False, default=1),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        sa.UniqueConstraint('tournament_id', 'team_id', name='uq_tournament_team_standing')
    )

def downgrade() -> None:
    op.drop_table('standings')
    op.drop_table('teams')
    op.drop_table('tournaments')
    op.drop_table('seasons')
    op.drop_table('users')
    op.drop_table('subscriptions')
    op.drop_table('organizations')
