import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.tournament import TournamentCreate, TournamentResponse
from app.application.services.tournament_service import TournamentService
from app.domain.permissions import PermissionName
from app.infrastructure.models.user import User
from app.infrastructure.repositories.tournament_repository import TournamentRepository
from app.presentation.dependencies.auth_deps import (
    AuthContext,
    get_auth_context,
    get_tenant_db,
    require_permission,
)

router = APIRouter(prefix="/tournaments", tags=["Torneos & Calendarios"])

@router.get("/", response_model=list[TournamentResponse])
async def list_tournaments(
    organization_slug: str | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Lista todos los torneos oficiales registrados para la organización activa del usuario.
    El alcance está estrictamente fijado por el JWT verificado (cualquier slug externo es ignorado).
    """
    repo = TournamentRepository(db)
    return await repo.list_by_organization(auth.tenant_id)

@router.post("/", response_model=TournamentResponse, status_code=status.HTTP_201_CREATED)
async def create_tournament(
    data: TournamentCreate,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.TORNEOS_CREAR)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Crea una nueva competición o torneo dentro de la organización activa."""
    service = TournamentService(db)
    return await service.create_tournament(auth.tenant_id, data)

@router.post("/{tournament_id}/generate-fixtures", status_code=status.HTTP_201_CREATED)
async def generate_fixtures(
    tournament_id: uuid.UUID,
    include_return_leg: bool = False,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.TORNEOS_EDITAR)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Genera automáticamente el fixture con Algoritmo de Berger.
    Valida pertenencia estricta del torneo al tenant activo (404 si es de otro tenant).
    """
    repo = TournamentRepository(db)
    tourn = await repo.get_by_id(tournament_id)
    if not tourn or tourn.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torneo no encontrado")

    service = TournamentService(db)
    matches = await service.generate_berger_fixtures(
        auth.tenant_id,
        tournament_id,
        start_date=datetime.utcnow(),
        include_return_leg=include_return_leg
    )
    return {
        "message": "Fixture generado exitosamente con Algoritmo de Berger",
        "matches_count": len(matches),
        "include_return_leg": include_return_leg
    }
