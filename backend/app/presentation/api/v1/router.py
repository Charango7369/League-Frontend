from fastapi import APIRouter

from app.presentation.api.v1.endpoints import (
    admin,
    ai,
    audit,
    auth,
    discipline,
    finances,
    integrations,
    matches,
    notifications,
    organizations,
    referees,
    roles,
    statistics,
    teams,
    tournaments,
    websocket,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(organizations.router)
api_router.include_router(tournaments.router)
api_router.include_router(teams.router)
api_router.include_router(matches.router)
api_router.include_router(referees.router)
api_router.include_router(discipline.router)
api_router.include_router(notifications.router)
api_router.include_router(statistics.router)
api_router.include_router(websocket.router)
api_router.include_router(ai.router)
api_router.include_router(roles.router)
api_router.include_router(finances.router)
api_router.include_router(audit.router)
api_router.include_router(admin.router)
api_router.include_router(integrations.router)
