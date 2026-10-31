import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database import get_db
from app.infrastructure.models.match import Match
from app.infrastructure.models.statistics import Standing
from app.presentation.dependencies.auth_deps import ApiKeyContext, require_api_key

router = APIRouter(prefix="/integrations", tags=["Integraciones Externas & API Pública"])


class LiveScoreUpdateRequest(BaseModel):
    match_id: uuid.UUID
    home_score: int = Field(..., ge=0)
    away_score: int = Field(..., ge=0)
    current_minute: int = Field(..., ge=0, le=130)
    notes: str | None = None


@router.get("/scores")
async def get_external_scores(
    api_ctx: ApiKeyContext = Depends(require_api_key(required_scope="api:scores:read", limit=100, window_seconds=60)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Consulta de resultados deportivos en vivo / finalizados.
    Autenticado exclusivamente mediante API Key con scope 'api:scores:read'.
    Aislado estrictamente por tenant a nivel de sesión y consulta.
    """
    stmt = (
        select(Match)
        .where(
            Match.organization_id == api_ctx.tenant_id,
            Match.is_deleted.is_(False),
        )
        .order_by(Match.scheduled_at.desc().nullslast())
        .limit(50)
    )
    res = await db.execute(stmt)
    matches = res.scalars().all()

    return {
        "tenant_id": str(api_ctx.tenant_id),
        "api_key_name": api_ctx.name,
        "count": len(matches),
        "scores": [
            {
                "match_id": str(m.id),
                "tournament_id": str(m.tournament_id),
                "home_team_id": str(m.home_team_id),
                "away_team_id": str(m.away_team_id),
                "status": m.status,
                "home_score": m.home_score,
                "away_score": m.away_score,
                "scheduled_at": m.scheduled_at.isoformat() if m.scheduled_at else None,
            }
            for m in matches
        ],
    }


@router.get("/stats")
async def get_external_statistics(
    api_ctx: ApiKeyContext = Depends(require_api_key(required_scope="api:stats:read", limit=100, window_seconds=60)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Consulta de estadísticas y tabla de posiciones.
    Autenticado exclusivamente mediante API Key con scope 'api:stats:read'.
    """
    stmt = (
        select(Standing)
        .where(
            Standing.organization_id == api_ctx.tenant_id,
            Standing.is_deleted.is_(False),
        )
        .order_by(Standing.points.desc(), Standing.goal_difference.desc())
        .limit(50)
    )
    res = await db.execute(stmt)
    standings = res.scalars().all()

    return {
        "tenant_id": str(api_ctx.tenant_id),
        "api_key_name": api_ctx.name,
        "count": len(standings),
        "standings": [
            {
                "standing_id": str(s.id),
                "tournament_id": str(s.tournament_id),
                "team_id": str(s.team_id),
                "points": s.points,
                "played": s.played,
                "won": s.won,
                "drawn": s.drawn,
                "lost": s.lost,
                "goals_for": s.goals_for,
                "goals_against": s.goals_against,
                "goal_difference": s.goal_difference,
            }
            for s in standings
        ],
    }


@router.post("/live-update", status_code=status.HTTP_200_OK)
async def post_live_match_update(
    payload: LiveScoreUpdateRequest,
    api_ctx: ApiKeyContext = Depends(require_api_key(required_scope="api:live:write", limit=30, window_seconds=60)),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Actualización telemétrica o en vivo del marcador de un partido.
    Exige scope 'api:live:write' y verifica la pertenencia del partido al tenant activo.
    """
    stmt = select(Match).where(
        Match.id == payload.match_id,
        Match.organization_id == api_ctx.tenant_id,
        Match.is_deleted.is_(False),
    )
    res = await db.execute(stmt)
    match_obj = res.scalar_one_or_none()

    if not match_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Partido no encontrado en el tenant correspondiente a esta API Key.",
        )

    match_obj.home_score = payload.home_score
    match_obj.away_score = payload.away_score
    match_obj.current_minute = payload.current_minute
    if payload.notes:
        match_obj.referee_notes = payload.notes

    await db.commit()
    await db.refresh(match_obj)

    return {
        "status": "updated",
        "match_id": str(match_obj.id),
        "home_score": match_obj.home_score,
        "away_score": match_obj.away_score,
        "current_minute": match_obj.current_minute,
        "updated_at": datetime.now(UTC).isoformat(),
        "client_api_key": api_ctx.name,
    }
