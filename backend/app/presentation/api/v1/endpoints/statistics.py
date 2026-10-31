import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.player import PlayerLeaderboardResponse
from app.application.dtos.statistics import StandingResponse
from app.application.services.notification_service import notification_service
from app.infrastructure.redis_client import redis_service
from app.infrastructure.repositories.stats_repository import StatsRepository
from app.infrastructure.repositories.tournament_repository import TournamentRepository
from app.presentation.dependencies.auth_deps import AuthContext, get_auth_context, get_tenant_db

router = APIRouter(prefix="/statistics", tags=["Estadísticas & Tablas Oficiales"])

@router.get("/standings/{tournament_id}", response_model=list[StandingResponse])
async def get_tournament_standings(
    tournament_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Retorna la tabla oficial de posiciones recalculada automáticamente.
    Garantiza aislamiento multitenant tanto en BD como en namespace de Redis.
    """
    tourn_repo = TournamentRepository(db)
    tourn = await tourn_repo.get_by_id(tournament_id)
    if not tourn or tourn.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torneo no encontrado")

    cache_key = f"standings_response:{auth.tenant_id}:{tournament_id}"
    if redis_service:
        cached = await redis_service.get(cache_key)
        if cached:
            return cached

    repo = StatsRepository(db)
    standings = await repo.get_standings_by_tournament(tournament_id)

    out = []
    for s in standings:
        out.append(StandingResponse(
            position=s.position,
            team_id=s.team_id,
            team_name=s.team.name if s.team else "Club",
            team_short=s.team.short_code if s.team else "ESC",
            team_color=s.team.primary_color if s.team else "#1a4fd6",
            team_logo=s.team.logo_url if s.team else None,
            played=s.played,
            won=s.won,
            drawn=s.drawn,
            lost=s.lost,
            goals_for=s.goals_for,
            goals_against=s.goals_against,
            goal_difference=s.goal_difference,
            points=s.points,
            form=s.form
        ))

    if redis_service and out:
        await redis_service.set(cache_key, [o.model_dump(mode="json") for o in out], expire_seconds=60)

    return out

@router.get("/scorers/{tournament_id}", response_model=list[PlayerLeaderboardResponse])
async def get_top_scorers(
    tournament_id: uuid.UUID,
    limit: int = 15,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Retorna la tabla de máximos goleadores del campeonato del tenant activo."""
    tourn_repo = TournamentRepository(db)
    tourn = await tourn_repo.get_by_id(tournament_id)
    if not tourn or tourn.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torneo no encontrado")

    repo = StatsRepository(db)
    results = await repo.get_top_scorers(tournament_id, limit=limit)

    out = []
    for stat, player, team in results:
        out.append(PlayerLeaderboardResponse(
            player_id=player.id,
            full_name=f"{player.first_name} {player.last_name}",
            jersey_number=player.jersey_number,
            team_name=team.name,
            team_short=team.short_code,
            team_color=team.primary_color,
            goals=stat.goals,
            assists=stat.assists,
            yellow_cards=stat.yellow_cards,
            red_cards=stat.red_cards
        ))
    return out

@router.get("/share-whatsapp/{tournament_id}")
async def get_whatsapp_broadcast_text(
    tournament_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Genera el mensaje estructurado de WhatsApp para el torneo del tenant activo."""
    tourn_repo = TournamentRepository(db)
    tourn = await tourn_repo.get_by_id(tournament_id)
    if not tourn or tourn.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Torneo no encontrado")

    repo = StatsRepository(db)
    standings = await repo.get_standings_by_tournament(tournament_id)
    text = notification_service.format_standings_share_message(tourn.name, standings)
    return {"formatted_text": text}
