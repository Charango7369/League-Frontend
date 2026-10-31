import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.match import MatchEventCreate, MatchUpdate
from app.application.services.audit_service import AuditService
from app.application.services.rbac_service import RBACService
from app.application.services.stats_engine import StatsEngine
from app.config import settings
from app.domain.permissions import PermissionName
from app.infrastructure.models.match import Match, MatchEvent
from app.infrastructure.models.player import PlayerStatistic
from app.infrastructure.models.user import User
from app.infrastructure.repositories.match_repository import MatchRepository
from app.infrastructure.websocket_manager import match_live_hub

# Canonical State Machine Transitions for Match Lifecycle
VALID_MATCH_STATUS_TRANSITIONS: dict[str, set[str]] = {
    "SCHEDULED": {
        "SCHEDULED", "WARMUP", "CALENTAMIENTO", "LIVE", "EN_JUEGO",
        "FIRST_HALF", "POSTPONED", "POSTERGADO", "CANCELLED", "CANCELADO",
        "FINALIZADO", "FINISHED"
    },
    "WARMUP": {
        "WARMUP", "CALENTAMIENTO", "LIVE", "EN_JUEGO", "FIRST_HALF",
        "CANCELLED", "CANCELADO", "POSTPONED", "POSTERGADO"
    },
    "CALENTAMIENTO": {
        "WARMUP", "CALENTAMIENTO", "LIVE", "EN_JUEGO", "FIRST_HALF",
        "CANCELLED", "CANCELADO", "POSTPONED", "POSTERGADO"
    },
    "LIVE": {
        "LIVE", "EN_JUEGO", "FIRST_HALF", "HALF_TIME", "DESCANSO",
        "SECOND_HALF", "FINALIZADO", "FINISHED", "SUSPENDED", "SUSPENDIDO",
        "CANCELLED", "CANCELADO"
    },
    "EN_JUEGO": {
        "LIVE", "EN_JUEGO", "FIRST_HALF", "HALF_TIME", "DESCANSO",
        "SECOND_HALF", "FINALIZADO", "FINISHED", "SUSPENDED", "SUSPENDIDO",
        "CANCELLED", "CANCELADO"
    },
    "FIRST_HALF": {
        "FIRST_HALF", "HALF_TIME", "DESCANSO", "LIVE", "EN_JUEGO",
        "SUSPENDED", "SUSPENDIDO", "CANCELLED", "CANCELADO"
    },
    "HALF_TIME": {
        "HALF_TIME", "DESCANSO", "SECOND_HALF", "LIVE", "EN_JUEGO",
        "FINALIZADO", "FINISHED", "SUSPENDED", "SUSPENDIDO", "CANCELLED", "CANCELADO"
    },
    "DESCANSO": {
        "HALF_TIME", "DESCANSO", "SECOND_HALF", "LIVE", "EN_JUEGO",
        "FINALIZADO", "FINISHED", "SUSPENDED", "SUSPENDIDO", "CANCELLED", "CANCELADO"
    },
    "SECOND_HALF": {
        "SECOND_HALF", "LIVE", "EN_JUEGO", "FINALIZADO", "FINISHED",
        "SUSPENDED", "SUSPENDIDO", "CANCELLED", "CANCELADO"
    },
    "FINALIZADO": {
        "FINALIZADO", "FINISHED", "SEALED", "CERRADO"
    },
    "FINISHED": {
        "FINALIZADO", "FINISHED", "SEALED", "CERRADO"
    },
    "SEALED": set(),
    "CERRADO": set(),
    "POSTPONED": {
        "POSTPONED", "POSTERGADO", "SCHEDULED", "PROGRAMADO", "CANCELLED", "CANCELADO"
    },
    "POSTERGADO": {
        "POSTPONED", "POSTERGADO", "SCHEDULED", "PROGRAMADO", "CANCELLED", "CANCELADO"
    },
    "CANCELLED": set(),
    "CANCELADO": set(),
    "SUSPENDED": {
        "SUSPENDED", "SUSPENDIDO", "LIVE", "EN_JUEGO", "FINALIZADO", "FINISHED", "CANCELLED"
    },
    "SUSPENDIDO": {
        "SUSPENDED", "SUSPENDIDO", "LIVE", "EN_JUEGO", "FINALIZADO", "FINISHED", "CANCELLED"
    },
}

FINISHED_STATUSES = frozenset({"FINALIZADO", "FINISHED", "SEALED", "CERRADO"})
IN_PROGRESS_STATUSES = frozenset({
    "LIVE", "EN_JUEGO", "FIRST_HALF", "HALF_TIME", "DESCANSO",
    "SECOND_HALF", "WARMUP", "CALENTAMIENTO"
})


def validate_status_transition(current_status: str, new_status: str) -> None:
    curr = current_status.strip().upper()
    nxt = new_status.strip().upper()
    if curr == nxt:
        return

    allowed = VALID_MATCH_STATUS_TRANSITIONS.get(curr)
    if allowed is not None and nxt not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Transición de estado inválida: no se permite cambiar de '{current_status}' a '{new_status}'."
        )


class MatchService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repo = MatchRepository(session)
        self.stats_engine = StatsEngine(session)

    async def check_match_editing_window(
        self,
        match: Match,
        actor_user: User | None,
        justification: str | None = None,
    ) -> bool:
        """
        Validates referee match sheet editing permissions based on match state and server-clock time window.

        Rules:
        - If match is IN_PROGRESS (LIVE / EN_JUEGO / HALF_TIME): editing is permitted for referees.
        - If match is FINISHED / FINALIZADO / SEALED:
          - Computed strictly against server clock in UTC (datetime.now(timezone.utc)).
          - If elapsed time <= settings.MATCH_GRACE_PERIOD_MINUTES: allowed within grace period.
          - If elapsed time > settings.MATCH_GRACE_PERIOD_MINUTES: match sheet is in strict read-only mode.
            Editing requires elevated permission 'partidos:corregir_acta_cerrada' AND a non-empty justification.
            If missing permission or justification, logs security block in immutable audit and denies access.

        Returns True if an administrative override was applied.
        """
        curr_status = match.status.strip().upper()
        if curr_status not in FINISHED_STATUSES:
            return False

        # Match has finished. Calculate elapsed time strictly against server clock in UTC
        now_utc = datetime.now(UTC)
        ref_time = match.finished_at or match.updated_at or now_utc
        if ref_time.tzinfo is None:
            ref_time = ref_time.replace(tzinfo=UTC)

        elapsed_minutes = (now_utc - ref_time).total_seconds() / 60.0

        if elapsed_minutes <= settings.MATCH_GRACE_PERIOD_MINUTES:
            # Within regulatory grace period (default 120 minutes)
            return False

        # Window has expired: sheet is strictly read-only unless administrative override
        has_override = False
        if actor_user:
            if actor_user.role == "SUPER_ADMIN":
                has_override = True
            else:
                scopes = await RBACService.resolve_resource_scopes(
                    self.session, match.organization_id, {"match_id": match.id}
                )
                has_override = await RBACService.user_has_permission_in_scopes(
                    db=self.session,
                    user=actor_user,
                    tenant_id=match.organization_id,
                    permission_name=PermissionName.PARTIDOS_CORREGIR_ACTA_CERRADA.value,
                    target_scopes=scopes,
                )

        if not has_override:
            user_id = actor_user.id if actor_user else None
            await AuditService.record_mutation(
                session=self.session,
                tenant_id=match.organization_id,
                action="BLOCKED_EXPIRED_MATCH_SHEET_EDIT",
                resource_name="matches",
                resource_id=str(match.id),
                before_state={
                    "status": match.status,
                    "finished_at": match.finished_at.isoformat() if match.finished_at else None,
                    "elapsed_minutes": round(elapsed_minutes, 2),
                },
                after_state={
                    "attempted_by": str(user_id) if user_id else None,
                    "reason": f"Ventana de gracia reglamentaria ({settings.MATCH_GRACE_PERIOD_MINUTES} min) ha expirado. Requiere permiso '{PermissionName.PARTIDOS_CORREGIR_ACTA_CERRADA.value}'.",
                },
                user_id=user_id,
            )
            await self.session.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"La ventana reglamentaria de gracia ({settings.MATCH_GRACE_PERIOD_MINUTES} min) ha expirado. "
                    f"El acta oficial está en modo solo lectura. Se requiere el permiso '{PermissionName.PARTIDOS_CORREGIR_ACTA_CERRADA.value}' "
                    f"y una justificación formal para aplicar correcciones."
                ),
            )

        # User has override permission; verify mandatory justification
        if not justification or len(justification.strip()) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Se requiere una justificación formal obligatoria ('justification') para corregir un acta de partido cerrada fuera de la ventana de gracia.",
            )

        return True

    async def update_match_status(
        self,
        match_id: uuid.UUID,
        data: MatchUpdate,
        actor_user_id: uuid.UUID | None = None,
        actor_user: User | None = None,
    ) -> Match:
        match = await self.repo.get_match_with_details(match_id)
        if not match:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

        if not actor_user and actor_user_id:
            from app.infrastructure.repositories.user_repository import UserRepository
            user_repo = UserRepository(self.session)
            actor_user = await user_repo.get_by_id(actor_user_id)
        actual_user_id = actor_user.id if actor_user else actor_user_id

        # 1. State machine transition check
        if data.status:
            validate_status_transition(match.status, data.status)

        # 2. Check editing window & grace period
        is_override = await self.check_match_editing_window(
            match=match,
            actor_user=actor_user,
            justification=data.justification,
        )

        before_state = {
            "status": match.status,
            "home_score": match.home_score,
            "away_score": match.away_score,
            "current_minute": match.current_minute,
            "venue_id": str(match.venue_id) if match.venue_id else None,
            "finished_at": match.finished_at.isoformat() if match.finished_at else None,
        }

        # Apply state updates
        now_utc = datetime.now(UTC)
        if data.status:
            match.status = data.status
            new_st = data.status.strip().upper()
            if new_st in ("LIVE", "EN_JUEGO", "FIRST_HALF") and not match.started_at:
                match.started_at = now_utc
            elif new_st in ("FINALIZADO", "FINISHED") and not match.finished_at:
                match.finished_at = now_utc

        if data.home_score is not None:
            match.home_score = data.home_score
        if data.away_score is not None:
            match.away_score = data.away_score
        if data.current_minute is not None:
            match.current_minute = data.current_minute
        if data.venue_id is not None:
            match.venue_id = data.venue_id
        if data.scheduled_at is not None:
            match.scheduled_at = data.scheduled_at

        if is_override and data.justification:
            author_desc = actor_user.email if actor_user and actor_user.email else str(actual_user_id)
            entry = f"[{now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}] ({author_desc}): {data.justification.strip()}"
            match.correction_notes = f"{match.correction_notes}\n{entry}".strip() if match.correction_notes else entry

        after_state = {
            "status": match.status,
            "home_score": match.home_score,
            "away_score": match.away_score,
            "current_minute": match.current_minute,
            "venue_id": str(match.venue_id) if match.venue_id else None,
            "finished_at": match.finished_at.isoformat() if match.finished_at else None,
            "correction_applied": is_override,
        }
        if is_override and data.justification:
            after_state["justification"] = data.justification.strip()

        action_name = "UPDATE_MATCH_SCORE_CORRECTION_OVERRIDE" if is_override else "UPDATE_MATCH_SCORE"

        # Centralized mutation audit trail
        await AuditService.record_mutation(
            session=self.session,
            tenant_id=match.organization_id,
            action=action_name,
            resource_name="matches",
            resource_id=str(match.id),
            before_state=before_state,
            after_state=after_state,
            user_id=actual_user_id,
        )

        await self.session.commit()
        await self.session.refresh(match)

        # Broadcast update to live room
        await match_live_hub.broadcast_to_match(
            str(match.id),
            {
                "type": "MATCH_STATUS_UPDATED",
                "match_id": str(match.id),
                "status": match.status,
                "current_minute": match.current_minute,
                "home_score": match.home_score,
                "away_score": match.away_score
            }
        )

        # Trigger standings update
        await self.stats_engine.recalculate_tournament_standings(match.tournament_id)
        return match

    async def record_event(
        self,
        match_id: uuid.UUID,
        data: MatchEventCreate,
        actor_user: User | None = None,
    ) -> MatchEvent:
        match = await self.repo.get_match_with_details(match_id)
        if not match:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

        # 1. Block recording events on matches that have not started
        if match.status.strip().upper() in ("SCHEDULED", "PROGRAMADO"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No se pueden registrar incidencias o eventos en un partido que aún no ha iniciado (estado SCHEDULED). Inicie el encuentro primero.",
            )

        # 2. Check editing window & grace period
        is_override = await self.check_match_editing_window(
            match=match,
            actor_user=actor_user,
            justification=data.justification,
        )

        event = MatchEvent(
            organization_id=match.organization_id,
            match_id=match.id,
            team_id=data.team_id,
            event_type=data.event_type,
            minute=data.minute,
            extra_minute=data.extra_minute,
            primary_player_id=data.primary_player_id,
            secondary_player_id=data.secondary_player_id,
            event_metadata=data.metadata
        )

        # Update Match Score if Goal
        if data.event_type in ("GOAL", "PENALTY_GOAL"):
            if data.team_id == match.home_team_id:
                match.home_score = (match.home_score or 0) + 1
            else:
                match.away_score = (match.away_score or 0) + 1
        elif data.event_type == "OWN_GOAL":
            if data.team_id == match.home_team_id:
                match.away_score = (match.away_score or 0) + 1
            else:
                match.home_score = (match.home_score or 0) + 1

        created_event = await self.repo.add_event(event)

        # Update Player individual statistics
        if data.primary_player_id:
            stats_q = select(PlayerStatistic).where(
                PlayerStatistic.player_id == data.primary_player_id,
                PlayerStatistic.tournament_id == match.tournament_id
            )
            res = await self.session.execute(stats_q)
            p_stat = res.scalar_one_or_none()
            if not p_stat:
                p_stat = PlayerStatistic(
                    player_id=data.primary_player_id,
                    tournament_id=match.tournament_id
                )
                self.session.add(p_stat)

            if data.event_type in ("GOAL", "PENALTY_GOAL"):
                p_stat.goals += 1
            elif data.event_type == "YELLOW_CARD":
                p_stat.yellow_cards += 1
            elif data.event_type == "RED_CARD":
                p_stat.red_cards += 1

        if is_override and data.justification:
            now_utc = datetime.now(UTC)
            author_desc = actor_user.email if actor_user and actor_user.email else str(actor_user.id if actor_user else "")
            entry = f"[{now_utc.strftime('%Y-%m-%d %H:%M:%S UTC')}] ({author_desc}) [EVENT {data.event_type} min {data.minute}]: {data.justification.strip()}"
            match.correction_notes = f"{match.correction_notes}\n{entry}".strip() if match.correction_notes else entry

        # Audit mutation
        await AuditService.record_mutation(
            session=self.session,
            tenant_id=match.organization_id,
            action="RECORD_MATCH_EVENT_CORRECTION_OVERRIDE" if is_override else "RECORD_MATCH_EVENT",
            resource_name="matches",
            resource_id=str(match.id),
            before_state=None,
            after_state={
                "event_id": str(created_event.id),
                "event_type": created_event.event_type,
                "minute": created_event.minute,
                "team_id": str(created_event.team_id),
                "primary_player_id": str(created_event.primary_player_id) if created_event.primary_player_id else None,
                "correction_applied": is_override,
                "justification": data.justification if is_override else None,
            },
            user_id=actor_user.id if actor_user else None,
        )

        await self.session.commit()

        # Recalculate Standings
        await self.stats_engine.recalculate_tournament_standings(match.tournament_id)

        # Broadcast to WebSocket Room
        player_name = "Jugador"
        if created_event.primary_player:
            player_name = f"{created_event.primary_player.first_name} {created_event.primary_player.last_name}"

        await match_live_hub.broadcast_to_match(
            str(match.id),
            {
                "type": "MATCH_EVENT_OCCURRED",
                "match_id": str(match.id),
                "event_type": created_event.event_type,
                "minute": created_event.minute,
                "team_id": str(created_event.team_id),
                "player_name": player_name,
                "home_score": match.home_score,
                "away_score": match.away_score
            }
        )

        return created_event
