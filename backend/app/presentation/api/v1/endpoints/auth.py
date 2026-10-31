from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.auth import (
    LoginRequest,
    MFAEnableRequest,
    MFASetupResponse,
    MFAVerifyRequest,
    RegisterRequest,
    SwitchTenantRequest,
    TokenResponse,
    UserResponse,
)
from app.application.services.auth_service import AuthService
from app.infrastructure.database import get_db
from app.infrastructure.models.user import User
from app.presentation.dependencies.auth_deps import AuthContext, get_auth_context, get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register_tenant(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Inscribe una nueva organización (Liga, Federación o Municipio) y crea el usuario Administrador."""
    service = AuthService(db)
    return await service.register(data)

@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Inicia sesión con correo y contraseña para obtener tokens JWT."""
    service = AuthService(db)
    return await service.login(data)

@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """Retorna los datos del usuario actualmente autenticado y su rol."""
    return current_user

@router.post("/switch-tenant", response_model=TokenResponse)
async def switch_tenant(
    data: SwitchTenantRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Cambia el tenant activo del usuario autenticado previa validación de su membresía.
    Emite un nuevo JWT con el nuevo tenant_id activo.
    """
    service = AuthService(db)
    return await service.switch_tenant(current_user.id, data.tenant_id)


@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Genera el secreto TOTP para enrolamiento en Google Authenticator / Authy
    y 8 códigos de respaldo de un solo uso.
    El secreto se almacena cifrado en reposo y los códigos como hashes.
    """
    service = AuthService(db)
    return await service.setup_mfa(current_user.id, auth.tenant_id)


@router.post("/mfa/enable")
async def enable_mfa(
    data: MFAEnableRequest,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Confirma el código inicial de 6 dígitos para activar formalmente el MFA en la cuenta.
    """
    service = AuthService(db)
    await service.enable_mfa(current_user.id, data.code, auth.tenant_id)
    return {"message": "Autenticación de dos factores (MFA) habilitada exitosamente."}


@router.post("/mfa/verify", response_model=TokenResponse)
async def verify_mfa(
    data: MFAVerifyRequest,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Valida el código TOTP o código de respaldo.
    Emite un token JWT con el claim 'mfa_verified: true'.
    Un código de respaldo utilizado queda automáticamente invalidado.
    """
    service = AuthService(db)
    return await service.verify_mfa(
        user_id=current_user.id,
        code=data.code,
        backup_code=data.backup_code,
        tenant_id=auth.tenant_id,
    )
