"""Complete base schema tables

Revision ID: 002_complete_base_tables
Revises: 001_initial_schema
Create Date: 2026-10-31 10:00:00.000000

"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = '002_complete_base_tables'
down_revision = '001_initial_schema'
branch_labels = None
depends_on = None

def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    # 1. venues
    if 'venues' not in existing_tables:
        op.create_table(
            'venues',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('name', sa.String(120), nullable=False),
            sa.Column('city', sa.String(80), nullable=False, default='Apolo'),
            sa.Column('address', sa.String(200), nullable=True),
            sa.Column('surface_type', sa.String(40), nullable=False, default='NATURAL_GRASS'),
            sa.Column('has_lighting', sa.Boolean(), nullable=False, default=False),
            sa.Column('capacity', sa.Integer(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        )

    # 2. matchdays
    if 'matchdays' not in existing_tables:
        op.create_table(
            'matchdays',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('tournament_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('number', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(60), nullable=False),
            sa.Column('round_type', sa.String(30), nullable=False, default='REGULAR'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        )

    # 3. matches
    if 'matches' not in existing_tables:
        op.create_table(
            'matches',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('tournament_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('matchday_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('matchdays.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('home_team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='RESTRICT'), nullable=False, index=True),
            sa.Column('away_team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='RESTRICT'), nullable=False, index=True),
            sa.Column('venue_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('venues.id', ondelete='SET NULL'), nullable=True),
            sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('home_score', sa.Integer(), nullable=True),
            sa.Column('away_score', sa.Integer(), nullable=True),
            sa.Column('status', sa.String(30), nullable=False, default='SCHEDULED', index=True),
            sa.Column('current_minute', sa.Integer(), nullable=False, default=0),
            sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('referee_notes', sa.String(500), nullable=True),
            sa.Column('is_referee_signed', sa.Boolean(), nullable=False, default=False),
            sa.Column('referee_signature_hash', sa.String(128), nullable=True),
            sa.Column('referee_signed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        )

    # 4. players
    if 'players' not in existing_tables:
        op.create_table(
            'players',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('first_name', sa.String(80), nullable=False),
            sa.Column('last_name', sa.String(80), nullable=False),
            sa.Column('jersey_number', sa.Integer(), nullable=False, default=10),
            sa.Column('position', sa.String(30), nullable=False, default='FORWARD'),
            sa.Column('document_id', sa.String(40), nullable=True),
            sa.Column('date_of_birth', sa.Date(), nullable=True),
            sa.Column('photo_url', sa.String(300), nullable=True),
            sa.Column('is_eligible', sa.Boolean(), nullable=False, default=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        )

    # 5. match_events
    if 'match_events' not in existing_tables:
        op.create_table(
            'match_events',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('match_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('matches.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('team_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('teams.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('primary_player_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('players.id', ondelete='SET NULL'), nullable=True),
            sa.Column('secondary_player_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('players.id', ondelete='SET NULL'), nullable=True),
            sa.Column('event_type', sa.String(40), nullable=False, index=True),
            sa.Column('minute', sa.Integer(), nullable=False),
            sa.Column('extra_minute', sa.Integer(), nullable=False, default=0),
            sa.Column('event_metadata', postgresql.JSONB(), nullable=False, server_default='{}'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        )

    # 6. referees
    if 'referees' not in existing_tables:
        op.create_table(
            'referees',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('first_name', sa.String(80), nullable=False),
            sa.Column('last_name', sa.String(80), nullable=False),
            sa.Column('license_number', sa.String(50), nullable=True),
            sa.Column('category', sa.String(40), nullable=False, default='REGIONAL'),
            sa.Column('phone', sa.String(30), nullable=True),
            sa.Column('association', sa.String(120), nullable=False, default='Colegio de Árbitros Franz Tamayo'),
            sa.Column('role_primary', sa.String(40), nullable=False, default='PRINCIPAL'),
            sa.Column('matches_count', sa.Integer(), nullable=False, default=0),
            sa.Column('yellow_cards_count', sa.Integer(), nullable=False, default=0),
            sa.Column('red_cards_count', sa.Integer(), nullable=False, default=0),
            sa.Column('status', sa.String(30), nullable=False, default='ACTIVE'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        )

    # 7. referee_assignments
    if 'referee_assignments' not in existing_tables:
        op.create_table(
            'referee_assignments',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('match_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('matches.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('referee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('referees.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('role', sa.String(40), nullable=False, default='MAIN'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        )

    # 8. player_statistics
    if 'player_statistics' not in existing_tables:
        op.create_table(
            'player_statistics',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('player_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('players.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('tournament_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tournaments.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('matches_played', sa.Integer(), nullable=False, default=0),
            sa.Column('goals', sa.Integer(), nullable=False, default=0),
            sa.Column('assists', sa.Integer(), nullable=False, default=0),
            sa.Column('yellow_cards', sa.Integer(), nullable=False, default=0),
            sa.Column('red_cards', sa.Integer(), nullable=False, default=0),
            sa.Column('minutes_played', sa.Integer(), nullable=False, default=0),
            sa.Column('mvp_count', sa.Integer(), nullable=False, default=0),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('is_deleted', sa.Boolean(), nullable=False, default=False),
        )

    # 9. audit_logs
    if 'audit_logs' not in existing_tables:
        op.create_table(
            'audit_logs',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True),
            sa.Column('action', sa.String(80), nullable=False),
            sa.Column('resource_type', sa.String(80), nullable=False),
            sa.Column('resource_id', sa.String(80), nullable=True),
            sa.Column('payload_before', postgresql.JSONB(), nullable=True),
            sa.Column('payload_after', postgresql.JSONB(), nullable=True),
            sa.Column('ip_address', sa.String(50), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        )

def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('player_statistics')
    op.drop_table('referee_assignments')
    op.drop_table('referees')
    op.drop_table('match_events')
    op.drop_table('players')
    op.drop_table('matches')
    op.drop_table('matchdays')
    op.drop_table('venues')
