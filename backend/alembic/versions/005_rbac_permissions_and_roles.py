"""005_rbac_permissions_and_roles

Revision ID: 005_rbac_permissions_and_roles
Revises: 004_row_level_security
Create Date: 2026-10-31 11:15:00.000000

"""
import uuid

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op
from app.domain.permissions import (
    ROLE_PERMISSIONS_MATRIX,
    PermissionName,
    SystemRole,
)

# revision identifiers, used by Alembic.
revision = '005_rbac_permissions_and_roles'
down_revision = '004_row_level_security'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --------------------------------------------------------------------------
    # 1. Create table `permissions`
    # --------------------------------------------------------------------------
    op.create_table(
        'permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('module', sa.String(length=50), nullable=False),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.UniqueConstraint('name', name='uq_permission_name')
    )
    op.create_index('ix_permissions_name', 'permissions', ['name'])
    op.create_index('ix_permissions_module', 'permissions', ['module'])

    # --------------------------------------------------------------------------
    # 2. Create table `roles`
    # --------------------------------------------------------------------------
    op.create_table(
        'roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=True),
        sa.Column('name', sa.String(length=60), nullable=False),
        sa.Column('slug', sa.String(length=60), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('is_system', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
    )
    op.create_index('ix_roles_organization_id', 'roles', ['organization_id'])
    op.create_index('ix_roles_slug', 'roles', ['slug'])
    op.create_index('uq_roles_system_slug', 'roles', ['slug'], unique=True, postgresql_where=sa.text('organization_id IS NULL'))
    op.create_index('uq_roles_tenant_slug', 'roles', ['organization_id', 'slug'], unique=True, postgresql_where=sa.text('organization_id IS NOT NULL'))

    # --------------------------------------------------------------------------
    # 3. Create table `role_permissions`
    # --------------------------------------------------------------------------
    op.create_table(
        'role_permissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('roles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('permissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permission')
    )
    op.create_index('ix_role_permissions_role_id', 'role_permissions', ['role_id'])
    op.create_index('ix_role_permissions_permission_id', 'role_permissions', ['permission_id'])

    # --------------------------------------------------------------------------
    # 4. Create table `user_roles`
    # --------------------------------------------------------------------------
    op.create_table(
        'user_roles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('roles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('scope_type', sa.String(length=30), nullable=False),
        sa.Column('scope_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), server_default=sa.text('false'), nullable=False),
        sa.CheckConstraint(
            "(scope_type = 'LEAGUE' AND scope_id IS NULL) OR (scope_type IN ('TOURNAMENT', 'TEAM') AND scope_id IS NOT NULL)",
            name='chk_user_role_scope_validity'
        )
    )
    op.create_index('ix_user_roles_user_id', 'user_roles', ['user_id'])
    op.create_index('ix_user_roles_role_id', 'user_roles', ['role_id'])
    op.create_index('ix_user_roles_tenant_id', 'user_roles', ['tenant_id'])
    op.create_index('ix_user_roles_scope_id', 'user_roles', ['scope_id'])
    op.execute(
        "CREATE UNIQUE INDEX uq_user_roles_assignment ON user_roles "
        "(user_id, role_id, tenant_id, scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid));"
    )

    # --------------------------------------------------------------------------
    # 5. Row Level Security & Privileges for app_user
    # --------------------------------------------------------------------------
    op.execute("GRANT SELECT ON permissions TO app_user;")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON roles, role_permissions, user_roles TO app_user;")

    # permissions RLS (read-only for all app_user)
    op.execute("ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE permissions FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY permissions_read_policy ON permissions
        FOR SELECT TO app_user USING (true);
    """)

    # roles RLS (system roles + tenant-specific roles)
    op.execute("ALTER TABLE roles ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE roles FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY roles_isolation_policy ON roles
        AS RESTRICTIVE
        FOR ALL TO app_user
        USING (
            organization_id IS NULL OR
            organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
            organization_id IS NOT NULL AND
            organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );
    """)

    # role_permissions RLS
    op.execute("ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY role_permissions_isolation_policy ON role_permissions
        AS RESTRICTIVE
        FOR ALL TO app_user
        USING (
            EXISTS (
                SELECT 1 FROM roles
                WHERE roles.id = role_permissions.role_id
                AND (
                    roles.organization_id IS NULL OR
                    roles.organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
                )
            )
        );
    """)

    # user_roles RLS
    op.execute("ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;")
    op.execute("ALTER TABLE user_roles FORCE ROW LEVEL SECURITY;")
    op.execute("""
        CREATE POLICY user_roles_isolation_policy ON user_roles
        AS RESTRICTIVE
        FOR ALL TO app_user
        USING (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
        WITH CHECK (
            tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        );
    """)

    # --------------------------------------------------------------------------
    # 6. Seed Canonical Data
    # --------------------------------------------------------------------------
    conn = op.get_bind()

    # Seed permissions
    perm_id_map = {}
    for perm in PermissionName:
        module, action = perm.value.split(":", 1)
        perm_id = uuid.uuid4()
        perm_id_map[perm.value] = perm_id
        conn.execute(
            sa.text(
                "INSERT INTO permissions (id, name, module, action, description, created_at, updated_at) "
                "VALUES (:id, :name, :module, :action, :desc, now(), now()) "
                "ON CONFLICT (name) DO UPDATE SET updated_at = now() RETURNING id;"
            ),
            {"id": perm_id, "name": perm.value, "module": module, "action": action, "desc": f"Permiso atómico para {module} ({action})"}
        )

    # Seed System Roles
    role_descriptions = {
        SystemRole.SUPER_ADMIN: "Acceso total y gobierno federativo global",
        SystemRole.ADMIN_LIGA: "Administración integral de la liga/organización deportiva",
        SystemRole.GESTOR_FINANCIERO: "Gestión de ingresos, conciliación de pagos y balances",
        SystemRole.ARBITRO: "Oficialización y arbitraje de partidos con firma criptográfica",
        SystemRole.DELEGADO_EQUIPO: "Representante y gestor técnico de delegación/club",
        SystemRole.JUGADOR: "Deportista habilitado con consulta de fixtures y estadísticas",
        SystemRole.ESPECTADOR: "Afición con acceso de solo lectura pública a estadísticas y fixtures",
    }

    role_id_map = {}
    for sys_role in SystemRole:
        existing = conn.execute(
            sa.text("SELECT id FROM roles WHERE slug = :slug AND organization_id IS NULL;"),
            {"slug": sys_role.value}
        ).fetchone()
        if existing:
            role_id = existing[0]
        else:
            role_id = uuid.uuid4()
            conn.execute(
                sa.text(
                    "INSERT INTO roles (id, organization_id, name, slug, description, is_system, created_at, updated_at) "
                    "VALUES (:id, NULL, :name, :slug, :desc, true, now(), now());"
                ),
                {
                    "id": role_id,
                    "name": sys_role.value.replace("_", " ").title(),
                    "slug": sys_role.value,
                    "desc": role_descriptions[sys_role]
                }
            )
        role_id_map[sys_role] = role_id

    # Seed role_permissions
    for sys_role, perms in ROLE_PERMISSIONS_MATRIX.items():
        r_id = role_id_map[sys_role]
        for p in perms:
            p_id = perm_id_map.get(p.value)
            if p_id:
                conn.execute(
                    sa.text(
                        "INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at) "
                        "VALUES (:id, :role_id, :permission_id, now(), now()) "
                        "ON CONFLICT (role_id, permission_id) DO NOTHING;"
                    ),
                    {"id": uuid.uuid4(), "role_id": r_id, "permission_id": p_id}
                )

    # --------------------------------------------------------------------------
    # 7. Backfill user_roles for existing users
    # --------------------------------------------------------------------------
    # Map legacy role names to SystemRole
    legacy_role_mapping = {
        "SUPER_ADMIN": SystemRole.SUPER_ADMIN,
        "ORGANIZATION_ADMIN": SystemRole.ADMIN_LIGA,
        "TOURNAMENT_ADMIN": SystemRole.ADMIN_LIGA,
        "REFEREE": SystemRole.ARBITRO,
        "TEAM_MANAGER": SystemRole.DELEGADO_EQUIPO,
        "PLAYER": SystemRole.JUGADOR,
        "PUBLIC_USER": SystemRole.ESPECTADOR,
    }

    users_res = conn.execute(sa.text("SELECT id, organization_id, role FROM users WHERE organization_id IS NOT NULL;")).fetchall()
    for row in users_res:
        u_id, org_id, legacy_role = row[0], row[1], row[2]
        target_sys_role = legacy_role_mapping.get(legacy_role, SystemRole.ESPECTADOR)
        r_id = role_id_map.get(target_sys_role)
        if r_id and org_id:
            conn.execute(
                sa.text(
                    "INSERT INTO user_roles (id, user_id, role_id, tenant_id, scope_type, scope_id, created_at, updated_at) "
                    "VALUES (:id, :user_id, :role_id, :tenant_id, 'LEAGUE', NULL, now(), now()) "
                    "ON CONFLICT DO NOTHING;"
                ),
                {
                    "id": uuid.uuid4(),
                    "user_id": u_id,
                    "role_id": r_id,
                    "tenant_id": org_id,
                }
            )


def downgrade() -> None:
    # Drop policies
    op.execute("DROP POLICY IF EXISTS user_roles_isolation_policy ON user_roles;")
    op.execute("DROP POLICY IF EXISTS role_permissions_isolation_policy ON role_permissions;")
    op.execute("DROP POLICY IF EXISTS roles_isolation_policy ON roles;")
    op.execute("DROP POLICY IF EXISTS permissions_read_policy ON permissions;")

    # Drop tables
    op.drop_table('user_roles')
    op.drop_table('role_permissions')
    op.drop_table('roles')
    op.drop_table('permissions')
