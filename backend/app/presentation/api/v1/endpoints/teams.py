import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.player import PlayerCreate, PlayerResponse
from app.application.dtos.team import TeamCreate, TeamResponse
from app.application.services.fls_service import FLSService
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

router = APIRouter(prefix="/teams", tags=["Clubes & Plantillas"])

@router.get("/", response_model=list[TeamResponse])
async def list_teams(
    organization_slug: str | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Lista todos los clubes inscritos en la liga del tenant activo."""
    repo = TournamentRepository(db)
    return await repo.list_teams(auth.tenant_id)

@router.get("/{team_id}", response_model=TeamResponse)
async def get_team_detail(
    team_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Obtiene los datos detallados de un club específico del tenant activo."""
    repo = TournamentRepository(db)
    team = await repo.get_team(team_id)
    if not team or team.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")
    return team

@router.post("/", response_model=TeamResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    data: TeamCreate,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.EQUIPOS_CREAR)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Inscribe un nuevo club deportivo en la competición del tenant activo."""
    service = TournamentService(db)
    return await service.create_team(auth.tenant_id, data)

@router.get("/{team_id}/players", response_model=list[PlayerResponse])
async def list_team_players(
    team_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Obtiene la plantilla de jugadores oficial de un equipo del tenant activo."""
    repo = TournamentRepository(db)
    team = await repo.get_team(team_id)
    if not team or team.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")
    players = await repo.list_players_by_team(team_id)
    return await FLSService.mask_player_list(players, auth, db)

@router.post("/{team_id}/players", response_model=PlayerResponse, status_code=status.HTTP_201_CREATED)
async def add_player_to_roster(
    team_id: uuid.UUID,
    data: PlayerCreate,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.JUGADORES_CREAR)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Habilita un nuevo jugador con su dorsal reglamentario en la plantilla."""
    repo = TournamentRepository(db)
    team = await repo.get_team(team_id)
    if not team or team.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Club no encontrado")

    data.team_id = team_id
    service = TournamentService(db)
    player = await service.create_player(auth.tenant_id, data)
    return await FLSService.mask_player(player, auth, db)

@router.get("/players/{player_id}", response_model=PlayerResponse)
async def get_player_passport(
    player_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Retorna la ficha y pasaporte deportivo oficial de un jugador del tenant activo."""
    repo = TournamentRepository(db)
    player = await repo.get_player(player_id)
    if not player or player.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Jugador no encontrado")
    return await FLSService.mask_player(player, auth, db)
