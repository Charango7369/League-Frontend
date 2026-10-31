import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.application.dtos.rbac import (
    PermissionResponse,
    RoleResponse,
    UserRoleAssignmentRequest,
    UserRoleAssignmentResponse,
)
from app.application.services.rbac_service import RBACService
from app.domain.permissions import PermissionName
from app.infrastructure.models.rbac import Permission, Role, UserRole
from app.infrastructure.models.user import User
from app.presentation.dependencies.auth_deps import (
    AuthContext,
    get_auth_context,
    get_tenant_db,
    require_permission,
)

router = APIRouter(prefix="/roles", tags=["Roles & Permisos"])


@router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.ROLES_VER)),
) -> Any:
    """Lists canonical system permissions."""
    res = await db.execute(select(Permission).order_by(Permission.module, Permission.name))
    return res.scalars().all()


@router.get("/", response_model=list[RoleResponse])
async def list_roles(
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.ROLES_VER)),
) -> Any:
    """Lists accessible roles (system roles and tenant custom roles) with their permissions."""
    stmt = (
        select(Role)
        .where(
            (Role.organization_id.is_(None)) | (Role.organization_id == auth.tenant_id)
        )
        .options(selectinload(Role.permissions))
        .order_by(Role.is_system.desc(), Role.name)
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/users/{user_id}", response_model=list[UserRoleAssignmentResponse])
async def list_user_roles(
    user_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.ROLES_VER)),
) -> Any:
    """Lists roles assigned to a user in the active tenant."""
    stmt = (
        select(UserRole)
        .where(
            UserRole.user_id == user_id,
            UserRole.tenant_id == auth.tenant_id,
        )
        .order_by(UserRole.created_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/assign", response_model=UserRoleAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def assign_role(
    data: UserRoleAssignmentRequest,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.ROLES_GESTIONAR)),
) -> Any:
    """
    Assigns a role to a user within a specified scope.
    Enforces anti-privilege escalation (cannot self-assign, cannot grant unheld permissions).
    """
    try:
        assignment = await RBACService.assign_user_role(
            db=db,
            actor=current_user,
            tenant_id=auth.tenant_id,
            target_user_id=data.user_id,
            role_id=data.role_id,
            scope_type=data.scope_type,
            scope_id=data.scope_id,
        )
        return assignment
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        ) from e


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_role(
    assignment_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.ROLES_GESTIONAR)),
) -> None:
    """Revokes a user role assignment."""
    try:
        await RBACService.revoke_user_role(
            db=db,
            actor=current_user,
            tenant_id=auth.tenant_id,
            user_role_id=assignment_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        ) from e
