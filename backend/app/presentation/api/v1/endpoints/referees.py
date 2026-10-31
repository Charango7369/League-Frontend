import hashlib
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.referee import (
    MatchOfficialSignRequest,
    MatchOfficialSignResponse,
    RefereeAssignmentCreate,
    RefereeAssignmentResponse,
    RefereeCreate,
    RefereeResponse,
)
from app.domain.permissions import PermissionName
from app.infrastructure.models.match import Referee
from app.infrastructure.models.user import User
from app.infrastructure.repositories.match_repository import MatchRepository
from app.infrastructure.repositories.referee_repository import RefereeRepository
from app.presentation.dependencies.auth_deps import (
    AuthContext,
    get_auth_context,
    get_tenant_db,
    require_permission,
)

router = APIRouter(prefix="/referees", tags=["Colegio de Árbitros & Designaciones"])

@router.get("/", response_model=list[RefereeResponse])
async def list_referees(
    organization_id: uuid.UUID | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Lista todos los árbitros colegiados activos del tenant autenticado."""
    repo = RefereeRepository(db)
    referees = await repo.list_all_referees(organization_id=auth.tenant_id)
    return [
        RefereeResponse(
            id=r.id,
            first_name=r.first_name,
            last_name=r.last_name,
            full_name=f"{r.first_name} {r.last_name}",
            license_number=r.license_number,
            category=r.category,
            phone=r.phone,
            association=r.association or "Colegio de Árbitros",
            role_primary=r.role_primary or "PRINCIPAL",
            matches_count=r.matches_count or 0,
            yellow_cards_count=r.yellow_cards_count or 0,
            red_cards_count=r.red_cards_count or 0,
            status=r.status or "ACTIVE",
        )
        for r in referees
    ]

@router.post("/", response_model=RefereeResponse, status_code=status.HTTP_201_CREATED)
async def create_referee(
    data: RefereeCreate,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.ARBITROS_GESTIONAR)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Registra un nuevo árbitro en el Colegio Oficial del tenant activo."""
    referee = Referee(
        first_name=data.first_name,
        last_name=data.last_name,
        license_number=data.license_number,
        category=data.category,
        phone=data.phone,
        association=data.association,
        role_primary=data.role_primary,
        organization_id=auth.tenant_id,
        matches_count=0,
        yellow_cards_count=0,
        red_cards_count=0,
        status="ACTIVE"
    )
    db.add(referee)
    await db.commit()
    await db.refresh(referee)
    return RefereeResponse(
        id=referee.id,
        first_name=referee.first_name,
        last_name=referee.last_name,
        full_name=f"{referee.first_name} {referee.last_name}",
        license_number=referee.license_number,
        category=referee.category,
        phone=referee.phone,
        association=referee.association,
        role_primary=referee.role_primary,
        matches_count=referee.matches_count,
        yellow_cards_count=referee.yellow_cards_count,
        red_cards_count=referee.red_cards_count,
        status=referee.status,
    )

@router.get("/{referee_id}", response_model=RefereeResponse)
async def get_referee(
    referee_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Consulta el expediente completo de un árbitro federado del tenant activo."""
    repo = RefereeRepository(db)
    referee = await repo.get_with_assignments(referee_id)
    if not referee or referee.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Árbitro no encontrado")

    return RefereeResponse(
        id=referee.id,
        first_name=referee.first_name,
        last_name=referee.last_name,
        full_name=f"{referee.first_name} {referee.last_name}",
        license_number=referee.license_number,
        category=referee.category,
        phone=referee.phone,
        association=referee.association,
        role_primary=referee.role_primary,
        matches_count=referee.matches_count,
        yellow_cards_count=referee.yellow_cards_count,
        red_cards_count=referee.red_cards_count,
        status=referee.status,
    )

@router.get("/matches/{match_id}/assignments", response_model=list[RefereeAssignmentResponse])
async def get_match_referees(
    match_id: uuid.UUID,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Obtiene la terna arbitral asignada a un partido oficial del tenant activo."""
    match_repo = MatchRepository(db)
    match = await match_repo.get_by_id(match_id)
    if not match or match.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    repo = RefereeRepository(db)
    assignments = await repo.get_match_assignments(match_id)
    return [
        RefereeAssignmentResponse(
            id=a.id,
            match_id=a.match_id,
            referee_id=a.referee_id,
            role=a.role,
            referee_name=f"{a.referee.first_name} {a.referee.last_name}" if a.referee else None,
            license_number=a.referee.license_number if a.referee else None,
        )
        for a in assignments
    ]

@router.post("/matches/{match_id}/assignments", response_model=list[RefereeAssignmentResponse])
async def set_match_referees(
    match_id: uuid.UUID,
    assignments: list[RefereeAssignmentCreate],
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.PARTIDOS_ASIGNAR_ARBITRO)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Designa o actualiza la terna arbitral oficial de un encuentro del tenant activo."""
    match_repo = MatchRepository(db)
    match = await match_repo.get_by_id(match_id)
    if not match or match.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    if match.is_referee_signed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El acta arbitral ya se encuentra firmada y sellada digitalmente. No se admiten modificaciones."
        )

    ref_repo = RefereeRepository(db)
    data = [{"referee_id": a.referee_id, "role": a.role, "organization_id": auth.tenant_id} for a in assignments]
    saved = await ref_repo.set_match_assignments(match_id, data)
    await db.commit()

    return [
        RefereeAssignmentResponse(
            id=a.id,
            match_id=a.match_id,
            referee_id=a.referee_id,
            role=a.role,
            referee_name=f"{a.referee.first_name} {a.referee.last_name}" if a.referee else None,
            license_number=a.referee.license_number if a.referee else None,
        )
        for a in saved
    ]

@router.post("/matches/{match_id}/sign", response_model=MatchOfficialSignResponse)
async def sign_match_sheet(
    match_id: uuid.UUID,
    payload: MatchOfficialSignRequest,
    auth: AuthContext = Depends(get_auth_context),
    current_user: User = Depends(require_permission(PermissionName.ARBITROS_FIRMAR_ACTA)),
    db: AsyncSession = Depends(get_tenant_db)
):
    """Firma digital y cierre del acta arbitral verificando pertenencia al tenant activo."""
    match_repo = MatchRepository(db)
    match = await match_repo.get_match_with_details(match_id)
    if not match or match.organization_id != auth.tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    if match.is_referee_signed:
        return MatchOfficialSignResponse(
            match_id=match.id,
            is_referee_signed=True,
            referee_signed_at=match.referee_signed_at,
            referee_signature_hash=match.referee_signature_hash,
            referee_notes=match.referee_notes,
        )

    now = datetime.now(UTC)
    seed = f"MATCH:{match.id}|HOME:{match.home_score}|AWAY:{match.away_score}|SIGNER:{payload.signed_by_name}|TIME:{now.isoformat()}|APOLODIGITAL"
    signature_hash = hashlib.sha256(seed.encode("utf-8")).hexdigest()

    ref_repo = RefereeRepository(db)
    updated = await ref_repo.sign_match_sheet(
        match_id=match_id,
        notes=payload.referee_notes,
        signature_hash=signature_hash,
        signed_at=now
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partido no encontrado")

    return MatchOfficialSignResponse(
        match_id=updated.id,
        is_referee_signed=updated.is_referee_signed,
        referee_signed_at=updated.referee_signed_at,
        referee_signature_hash=updated.referee_signature_hash,
        referee_notes=updated.referee_notes,
    )
