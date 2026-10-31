"""007_match_state_machine_and_sod

Revision ID: 007_match_state_machine_and_sod
Revises: 006_field_level_security_and_immutable_audit
Create Date: 2026-10-31 13:00:00.000000

"""
import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = '007_match_state_machine_and_sod'
down_revision = '006_field_level_security_and_immutable_audit'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------------------------------------------
    # 1. Add correction_notes column to matches table for audit &
    #    administrative overrides on closed match sheets
    # -------------------------------------------------------------
    op.add_column('matches', sa.Column('correction_notes', sa.String(1000), nullable=True))

    # -------------------------------------------------------------
    # 2. Enforce Segregation of Duties (SoD / 4-Eyes Principle)
    #    at the database level for tournament inscriptions.
    #    The user who uploads/registers a payment voucher
    #    (registered_by) CANNOT be the same user who validates/approves it.
    # -------------------------------------------------------------
    op.create_check_constraint(
        'chk_inscriptions_sod_4eyes',
        'inscriptions',
        'approved_by IS NULL OR registered_by IS NULL OR approved_by <> registered_by'
    )


def downgrade() -> None:
    # 2. Drop SoD 4-Eyes CHECK constraint
    op.drop_constraint('chk_inscriptions_sod_4eyes', 'inscriptions', type_='check')

    # 1. Drop correction_notes column from matches
    op.drop_column('matches', 'correction_notes')
