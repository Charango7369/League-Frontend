import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.match import (
    MatchDetailResponse,
    MatchEventCreate,
    MatchEventResponse,
    MatchOfficialSheetResponse,
    MatchResponse,
    MatchUpdate,
)
from app.application.services.match_service import MatchService
from app.domain.permissions import PermissionName
from app.infrastructure.models.user import User
from app.infrastructure.repositories.match_repository import MatchRepository
from app.infrastructure.repositories.tournament_repository import TournamentRepository
from app.presentation.dependencies.auth_deps import (
    AuthContext,
    get_auth_context,
    get_tenant_db,
    require_permission,
)

router = APIRouter(prefix="/matches", tags=["Partidos & Live Match Center"])

@router.get("/", response_model=list[MatchResponse])
async def list_matches(
    tournament_id: uuid.UUID,
    matchday_id: uuid.UUID | None = None,
    match_status: str | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Lista los encuentros de un torneo perteneciente al tenant activo."""
    tourn_repo = TournamentRepository(db)
    tourn = await tourn_repo.get_by_id(tournament_id)
    if not tourn or tourn.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torneo no encontrado")

    repo = MatchRepository(db)
    matches = await repo.list_by_tournament(tournament_id, matchday_id=matchday_id, status=match_status)

    out = []
    for m in matches:
        out.append(MatchResponse(
            id=m.id,
            tournament_id=m.tournament_id,
            matchday_id=m.matchday_id,
            home_team_id=m.home_team_id,
            away_team_id=m.away_team_id,
            home_team_name=m.home_team.name if m.home_team else "Local",
            away_team_name=m.away_team.name if m.away_team else "Visitante",
            home_team_short=m.home_team.short_code if m.home_team else "LOC",
            away_team_short=m.away_team.short_code if m.away_team else "VIS",
            home_team_color=m.home_team.primary_color if m.home_team else "#1a4fd6",
            away_team_color=m.away_team.primary_color if m.away_team else "#f0b429",
            home_score=m.home_score,
            away_score=m.away_score,
            status=m.status,
            current_minute=m.current_minute,
            scheduled_at=m.scheduled_at,
            venue_name=m.venue.name if m.venue else "Cancha Principal"
        ))
    return out

@router.get("/{match_id}", response_model=MatchDetailResponse)
async def get_match_detail(
    match_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Obtiene el acta completa de un partido perteneciente al tenant activo."""
    repo = MatchRepository(db)
    m = await repo.get_match_with_details(match_id)
    if not m or m.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    events_out = []
    for ev in m.events:
        player_name = f"{ev.primary_player.first_name} {ev.primary_player.last_name}" if ev.primary_player else None
        events_out.append(MatchEventResponse(
            id=ev.id,
            match_id=ev.match_id,
            team_id=ev.team_id,
            event_type=ev.event_type,
            minute=ev.minute,
            extra_minute=ev.extra_minute,
            primary_player_id=ev.primary_player_id,
            secondary_player_id=ev.secondary_player_id,
            primary_player_name=player_name,
            team_name=ev.team.name if ev.team else None
        ))

    return MatchDetailResponse(
        id=m.id,
        tournament_id=m.tournament_id,
        matchday_id=m.matchday_id,
        home_team_id=m.home_team_id,
        away_team_id=m.away_team_id,
        home_team_name=m.home_team.name if m.home_team else "Local",
        away_team_name=m.away_team.name if m.away_team else "Visitante",
        home_team_short=m.home_team.short_code if m.home_team else "LOC",
        away_team_short=m.away_team.short_code if m.away_team else "VIS",
        home_team_color=m.home_team.primary_color if m.home_team else "#1a4fd6",
        away_team_color=m.away_team.primary_color if m.away_team else "#f0b429",
        home_score=m.home_score,
        away_score=m.away_score,
        status=m.status,
        current_minute=m.current_minute,
        scheduled_at=m.scheduled_at,
        venue_name=m.venue.name if m.venue else "Cancha Principal",
        events=events_out
    )

@router.get("/{match_id}/official-sheet", response_model=MatchOfficialSheetResponse)
async def get_match_official_sheet(
    match_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Obtiene los datos reglamentarios completos para el Acta Oficial de Partido."""
    repo = MatchRepository(db)
    m = await repo.get_match_with_details(match_id)
    if not m or m.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    events_out = []
    for ev in m.events:
        player_name = f"{ev.primary_player.first_name} {ev.primary_player.last_name}" if ev.primary_player else None
        events_out.append(MatchEventResponse(
            id=ev.id,
            match_id=ev.match_id,
            team_id=ev.team_id,
            event_type=ev.event_type,
            minute=ev.minute,
            extra_minute=ev.extra_minute,
            primary_player_id=ev.primary_player_id,
            secondary_player_id=ev.secondary_player_id,
            primary_player_name=player_name,
            team_name=ev.team.name if ev.team else None
        ))

    officials_out = []
    if hasattr(m, 'referee_assignments') and m.referee_assignments:
        for a in m.referee_assignments:
            ref_name = f"{a.referee.first_name} {a.referee.last_name}" if a.referee else "Colegiado FBF"
            officials_out.append({
                "role": a.role,
                "referee_name": ref_name,
                "license_number": a.referee.license_number if a.referee else None,
            })

    verification_code = f"ACTA-{str(m.id)[:8].upper()}-{m.home_team.short_code if m.home_team else 'LOC'}V{m.away_team.short_code if m.away_team else 'VIS'}"

    return MatchOfficialSheetResponse(
        match_id=m.id,
        tournament_name=m.tournament.name if m.tournament else "Campeonato Oficial",
        season=m.tournament.season.name if (m.tournament and m.tournament.season) else "2026",
        round_name=f"Jornada {m.matchday.number}" if m.matchday else "Fecha Oficial",
        home_team_id=m.home_team_id,
        away_team_id=m.away_team_id,
        home_team_name=m.home_team.name if m.home_team else "Local",
        away_team_name=m.away_team.name if m.away_team else "Visitante",
        home_team_short=m.home_team.short_code if m.home_team else "LOC",
        away_team_short=m.away_team.short_code if m.away_team else "VIS",
        home_team_color=m.home_team.primary_color if m.home_team else "#1a4fd6",
        away_team_color=m.away_team.primary_color if m.away_team else "#f0b429",
        home_score=m.home_score,
        away_score=m.away_score,
        status=m.status,
        scheduled_at=m.scheduled_at,
        venue_name=m.venue.name if m.venue else "Estadio Municipal de Apolo",
        events=events_out,
        officials=officials_out,
        is_referee_signed=m.is_referee_signed,
        referee_notes=m.referee_notes,
        correction_notes=m.correction_notes,
        referee_signature_hash=m.referee_signature_hash,
        referee_signed_at=m.referee_signed_at,
        verification_code=verification_code,
    )

@router.put("/{match_id}", response_model=MatchResponse)
async def update_match_status_score(
    match_id: uuid.UUID,
    data: MatchUpdate,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.PARTIDOS_EDITAR_ACTA)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Actualiza el estado del partido asegurando aislamiento del tenant activo."""
    repo = MatchRepository(db)
    m_check = await repo.get_match_with_details(match_id)
    if not m_check or m_check.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    service = MatchService(db)
    m = await service.update_match_status(match_id, data, actor_user=current_user)
    return MatchResponse(
        id=m.id,
        tournament_id=m.tournament_id,
        matchday_id=m.matchday_id,
        home_team_id=m.home_team_id,
        away_team_id=m.away_team_id,
        home_team_name=m.home_team.name if m.home_team else "Local",
        away_team_name=m.away_team.name if m.away_team else "Visitante",
        home_team_short=m.home_team.short_code if m.home_team else "LOC",
        away_team_short=m.away_team.short_code if m.away_team else "VIS",
        home_team_color=m.home_team.primary_color if m.home_team else "#1a4fd6",
        away_team_color=m.away_team.primary_color if m.away_team else "#f0b429",
        home_score=m.home_score,
        away_score=m.away_score,
        status=m.status,
        current_minute=m.current_minute,
        scheduled_at=m.scheduled_at,
        venue_name=m.venue.name if m.venue else "Cancha Principal",
        correction_notes=m.correction_notes,
    )

@router.post("/{match_id}/events", response_model=MatchEventResponse, status_code=status.HTTP_201_CREATED)
async def record_match_event(
    match_id: uuid.UUID,
    data: MatchEventCreate,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.PARTIDOS_EDITAR_ACTA)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Registra un evento en vivo verificando que el partido pertenezca al tenant activo."""
    repo = MatchRepository(db)
    m_check = await repo.get_match_with_details(match_id)
    if not m_check or m_check.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    service = MatchService(db)
    ev = await service.record_event(match_id, data, actor_user=current_user)
    return MatchEventResponse(
        id=ev.id,
        match_id=ev.match_id,
        team_id=ev.team_id,
        event_type=ev.event_type,
        minute=ev.minute,
        extra_minute=ev.extra_minute,
        primary_player_id=ev.primary_player_id,
        secondary_player_id=ev.secondary_player_id,
        primary_player_name=f"{ev.primary_player.first_name} {ev.primary_player.last_name}" if ev.primary_player else None,
        team_name=ev.team.name if ev.team else None
    )

@router.post("/{match_id}/close", response_model=MatchResponse)
async def close_match_official_sheet(
    match_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.PARTIDOS_CERRAR_ACTA)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Cierra reglamentariamente el acta oficial del partido."""
    repo = MatchRepository(db)
    m_check = await repo.get_match_with_details(match_id)
    if not m_check or m_check.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    service = MatchService(db)
    m = await service.update_match_status(match_id, MatchUpdate(status="FINALIZADO"), actor_user=current_user)
    return MatchResponse(
        id=m.id,
        tournament_id=m.tournament_id,
        matchday_id=m.matchday_id,
        home_team_id=m.home_team_id,
        away_team_id=m.away_team_id,
        home_team_name=m.home_team.name if m.home_team else "Local",
        away_team_name=m.away_team.name if m.away_team else "Visitante",
        home_team_short=m.home_team.short_code if m.home_team else "LOC",
        away_team_short=m.away_team.short_code if m.away_team else "VIS",
        home_team_color=m.home_team.primary_color if m.home_team else "#1a4fd6",
        away_team_color=m.away_team.primary_color if m.away_team else "#f0b429",
        home_score=m.home_score,
        away_score=m.away_score,
        status=m.status,
        current_minute=m.current_minute,
        scheduled_at=m.scheduled_at,
        venue_name=m.venue.name if m.venue else "Cancha Principal",
        correction_notes=m.correction_notes,
    )
