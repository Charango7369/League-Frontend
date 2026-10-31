from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.organization import OrganizationResponse, OrganizationUpdate
from app.infrastructure.database import get_db
from app.infrastructure.models.user import User
from app.infrastructure.repositories.organization_repository import OrganizationRepository
from app.presentation.dependencies.auth_deps import require_roles

router = APIRouter(prefix="/organizations", tags=["Organizaciones"])

@router.get("/{slug}", response_model=OrganizationResponse)
async def get_organization_public(slug: str, db: AsyncSession = Depends(get_db)):
    """Obtiene los detalles públicos de una liga u organización para el portal aficionado (SEO)."""
    repo = OrganizationRepository(db)
    org = await repo.get_by_slug(slug)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organización no encontrada")
    return org

@router.put("/me/branding", response_model=OrganizationResponse)
async def update_organization_branding(
    data: OrganizationUpdate,
    current_user: User = Depends(require_roles(["SUPER_ADMIN", "ORGANIZATION_ADMIN"])),
    db: AsyncSession = Depends(get_db)
):
    """Actualiza la identidad visual, logo y colores oficiales de la liga."""
    if not current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuario no asociado a una organización")

    repo = OrganizationRepository(db)
    org = await repo.get_by_id(current_user.organization_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organización no encontrada")

    if data.name:
        org.name = data.name
    if data.logo_url:
        org.logo_url = data.logo_url
    if data.primary_color:
        org.primary_color = data.primary_color
    if data.theme_branding:
        org.theme_branding = {**org.theme_branding, **data.theme_branding}

    updated = await repo.update(org)
    return updated
