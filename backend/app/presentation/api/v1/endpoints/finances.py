import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.dtos.finance import InscriptionCreate, InscriptionResponse, PaymentValidationRequest
from app.application.services.audit_service import AuditService
from app.application.services.fls_service import mask_string
from app.domain.permissions import PermissionName, SystemRole
from app.infrastructure.models.inscription import Inscription
from app.infrastructure.models.user import User
from app.presentation.dependencies.auth_deps import (
    AuthContext,
    get_auth_context,
    get_tenant_db,
    require_permission,
)

router = APIRouter(prefix="/finances", tags=["Finanzas & Tesorería"])


@router.get("/inscriptions", response_model=list[InscriptionResponse])
async def list_inscriptions(
    tournament_id: uuid.UUID | None = None,
    team_id: uuid.UUID | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.INSCRIPCIONES_VER)),
) -> list[InscriptionResponse]:
    """Lists tournament team registrations and payment statuses for the active tenant."""
    stmt = select(Inscription).where(
        Inscription.organization_id == auth.tenant_id,
        Inscription.is_deleted.is_(False),
    )
    if tournament_id:
        stmt = stmt.where(Inscription.tournament_id == tournament_id)
    if team_id:
        stmt = stmt.where(Inscription.team_id == team_id)

    stmt = stmt.order_by(Inscription.created_at.desc())
    res = await db.execute(stmt)
    items = res.scalars().all()

    can_view_bank = auth.role in (SystemRole.SUPER_ADMIN, SystemRole.ADMIN_LIGA, SystemRole.GESTOR_FINANCIERO)

    out: list[InscriptionResponse] = []
    for item in items:
        bank_acc = item.bank_account if can_view_bank else mask_string(item.bank_account)
        out.append(
            InscriptionResponse(
                id=item.id,
                organization_id=item.organization_id,
                team_id=item.team_id,
                tournament_id=item.tournament_id,
                amount=item.amount,
                currency=item.currency,
                status=item.status,
                receipt_url=item.receipt_url,
                bank_account=bank_acc,
                registered_by=item.registered_by,
                approved_by=item.approved_by,
                notes=item.notes,
                created_at=item.created_at,
            )
        )
    return out


@router.post("/inscriptions", response_model=InscriptionResponse, status_code=status.HTTP_201_CREATED)
async def register_inscription_payment(
    data: InscriptionCreate,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.INSCRIPCIONES_REGISTRAR_COMPROBANTE)),
) -> InscriptionResponse:
    """Registers team tournament registration voucher and payment details."""
    new_inscription = Inscription(
        id=uuid.uuid4(),
        organization_id=auth.tenant_id,
        team_id=data.team_id,
        tournament_id=data.tournament_id,
        amount=data.amount,
        currency=data.currency,
        status="PENDING",
        receipt_url=data.receipt_url,
        bank_account=data.bank_account,
        registered_by=current_user.id,
        notes=data.notes,
    )
    db.add(new_inscription)

    # Immutable Audit logging with sensitive data redaction
    after_state = {
        "id": str(new_inscription.id),
        "team_id": str(new_inscription.team_id),
        "tournament_id": str(new_inscription.tournament_id),
        "amount": str(new_inscription.amount),
        "currency": new_inscription.currency,
        "status": new_inscription.status,
        "bank_account": new_inscription.bank_account,
        "receipt_url": new_inscription.receipt_url,
    }
    await AuditService.record_mutation(
        session=db,
        tenant_id=auth.tenant_id,
        action="REGISTER_INSCRIPTION_PAYMENT",
        resource_name="inscriptions",
        resource_id=str(new_inscription.id),
        before_state=None,
        after_state=after_state,
        user_id=current_user.id,
    )

    await db.commit()
    await db.refresh(new_inscription)

    return InscriptionResponse.model_validate(new_inscription)


@router.post("/inscriptions/{inscription_id}/validate-payment", response_model=InscriptionResponse)
async def validate_inscription_payment(
    inscription_id: uuid.UUID,
    data: PaymentValidationRequest | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.INSCRIPCIONES_VALIDAR_PAGO)),
) -> InscriptionResponse:
    """
    Validates and reconciles a pending inscription payment.
    Captures exact before/after mutation in immutable audit log.
    """
    stmt = select(Inscription).where(
        Inscription.id == inscription_id,
        Inscription.organization_id == auth.tenant_id,
        Inscription.is_deleted.is_(False),
    )
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inscripción no encontrada")

    # Enforce Segregation of Duties (SoD / 4-Eyes Principle)
    # The user who registered/uploaded the voucher CANNOT approve or validate it
    if item.registered_by and item.registered_by == current_user.id:
        await AuditService.record_mutation(
            session=db,
            tenant_id=auth.tenant_id,
            action="BLOCKED_SOD_VIOLATION",
            resource_name="inscriptions",
            resource_id=str(item.id),
            before_state={
                "id": str(item.id),
                "registered_by": str(item.registered_by),
                "status": item.status,
            },
            after_state={
                "attempted_by": str(current_user.id),
                "action": "VALIDATE_PAYMENT",
                "reason": "Violación de segregación de funciones (SoD / 4 ojos): el usuario que registró el comprobante no puede autoaprobarlo.",
            },
            user_id=current_user.id,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Violación de Segregación de Funciones (SoD / Principio de 4 Ojos): El usuario que registró el comprobante de pago no puede validarlo ni aprobarlo. Debe ser aprobado por otro funcionario autorizado.",
        )

    before_state = {
        "id": str(item.id),
        "status": item.status,
        "amount": str(item.amount),
        "bank_account": item.bank_account,
        "approved_by": str(item.approved_by) if item.approved_by else None,
        "notes": item.notes,
    }

    item.status = "VALIDATED"
    item.approved_by = current_user.id
    if data and data.notes:
        item.notes = f"{item.notes or ''}\nValidado: {data.notes}".strip()

    after_state = {
        "id": str(item.id),
        "status": item.status,
        "amount": str(item.amount),
        "bank_account": item.bank_account,
        "approved_by": str(item.approved_by) if item.approved_by else None,
        "notes": item.notes,
    }

    # Record exact state diff with automatic sensitive key redaction
    await AuditService.record_mutation(
        session=db,
        tenant_id=auth.tenant_id,
        action="VALIDATE_PAYMENT",
        resource_name="inscriptions",
        resource_id=str(item.id),
        before_state=before_state,
        after_state=after_state,
        user_id=current_user.id,
    )

    await db.commit()
    await db.refresh(item)
    return InscriptionResponse.model_validate(item)


@router.post("/inscriptions/{inscription_id}/reconcile", response_model=InscriptionResponse)
async def reconcile_inscription_payment(
    inscription_id: uuid.UUID,
    data: PaymentValidationRequest | None = None,
    auth: AuthContext = Depends(get_auth_context),
    db: AsyncSession = Depends(get_tenant_db),
    current_user: User = Depends(require_permission(PermissionName.FINANZAS_CONCILIAR_PAGO)),
) -> InscriptionResponse:
    """
    Reconciles an inscription payment against bank records.
    Enforces Segregation of Duties (4-Eyes Principle) and logs exact audit trail.
    """
    stmt = select(Inscription).where(
        Inscription.id == inscription_id,
        Inscription.organization_id == auth.tenant_id,
        Inscription.is_deleted.is_(False),
    )
    res = await db.execute(stmt)
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inscripción no encontrada")

    # Enforce Segregation of Duties (SoD / 4-Eyes Principle)
    if item.registered_by and item.registered_by == current_user.id:
        await AuditService.record_mutation(
            session=db,
            tenant_id=auth.tenant_id,
            action="BLOCKED_SOD_VIOLATION",
            resource_name="inscriptions",
            resource_id=str(item.id),
            before_state={
                "id": str(item.id),
                "registered_by": str(item.registered_by),
                "status": item.status,
            },
            after_state={
                "attempted_by": str(current_user.id),
                "action": "RECONCILE_PAYMENT",
                "reason": "Violación de segregación de funciones (SoD / 4 ojos): el usuario que registró el comprobante no puede conciliarlo.",
            },
            user_id=current_user.id,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Violación de Segregación de Funciones (SoD / Principio de 4 Ojos): El usuario que registró el comprobante de pago no puede conciliarlo. Debe ser conciliado por otro funcionario de tesorería.",
        )

    before_state = {
        "id": str(item.id),
        "status": item.status,
        "amount": str(item.amount),
        "bank_account": item.bank_account,
        "approved_by": str(item.approved_by) if item.approved_by else None,
        "notes": item.notes,
    }

    item.status = "RECONCILED"
    item.approved_by = current_user.id
    if data and data.notes:
        item.notes = f"{item.notes or ''}\nConciliado en banco: {data.notes}".strip()

    after_state = {
        "id": str(item.id),
        "status": item.status,
        "amount": str(item.amount),
        "bank_account": item.bank_account,
        "approved_by": str(item.approved_by) if item.approved_by else None,
        "notes": item.notes,
    }

    await AuditService.record_mutation(
        session=db,
        tenant_id=auth.tenant_id,
        action="RECONCILE_PAYMENT",
        resource_name="inscriptions",
        resource_id=str(item.id),
        before_state=before_state,
        after_state=after_state,
        user_id=current_user.id,
    )

    await db.commit()
    await db.refresh(item)
    return InscriptionResponse.model_validate(item)
