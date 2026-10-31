from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.ai import SportsChronicleRequest, SportsChronicleResponse
from app.application.services.ai_sports_service import AISportsService
from app.domain.permissions import PermissionName
from app.infrastructure.models.user import User
from app.infrastructure.repositories.match_repository import MatchRepository
from app.presentation.dependencies.auth_deps import (
    AuthContext,
    get_auth_context,
    get_tenant_db,
    require_permission,
)

router = APIRouter(prefix="/ai", tags=["IA Deportiva & Redacción de Crónicas"])

@router.post("/chronicle", response_model=SportsChronicleResponse)
async def generate_match_chronicle(
    data: SportsChronicleRequest,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.NOTIFICACIONES_EMITIR)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """
    Genera automáticamente una crónica deportiva profesional verificando
    que el partido pertenezca a la organización activa del usuario.
    """
    repo = MatchRepository(db)
    m = await repo.get_match_with_details(data.match_id)
    if not m or m.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    service = AISportsService(db)
    try:
        return await service.generate_match_chronicle(data.match_id, data.narrative_style)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
