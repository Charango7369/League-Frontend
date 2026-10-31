import contextlib
import contextvars
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, with_loader_criteria

from app.config import settings

# Thread-safe/Async-safe context variable for current active tenant
current_tenant_var: contextvars.ContextVar[uuid.UUID | None] = contextvars.ContextVar(
    "current_tenant_var", default=None
)

# Application Engine (Runs as app_user with NOBYPASSRLS for runtime RLS enforcement)
engine = create_async_engine(
    settings.APP_DATABASE_URL or settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True
)

# Admin Engine (Runs as postgres owner for schema migrations, test fixtures and DDL)
admin_engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

AsyncAdminSessionLocal = async_sessionmaker(
    bind=admin_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

class Base(DeclarativeBase):
    pass

# Import TenantMixin after Base is defined
from app.infrastructure.models.base import TenantMixin


# --------------------------------------------------------------------------
# Defense-in-depth: ORM-level tenant filtering on queries
# --------------------------------------------------------------------------
@event.listens_for(Session, "do_orm_execute")
def _add_tenant_filtering_criteria(execute_state: Any) -> None:
    if (
        execute_state.is_select
        and not execute_state.execution_options.get("skip_tenant_filter", False)
    ):
        active_tenant = current_tenant_var.get()
        if active_tenant is not None:
            execute_state.statement = execute_state.statement.options(
                with_loader_criteria(
                    TenantMixin,
                    lambda cls: cls.organization_id == active_tenant,
                    include_aliases=True
                )
            )

# --------------------------------------------------------------------------
# Defense-in-depth: ORM-level tenant validation and assignment on inserts
# --------------------------------------------------------------------------
@event.listens_for(Session, "before_flush")
def _validate_tenant_inserts(session: Session, flush_context: Any, instances: Any) -> None:
    active_tenant = current_tenant_var.get()
    if active_tenant is not None:
        for obj in session.new:
            if isinstance(obj, TenantMixin):
                if getattr(obj, "organization_id", None) is None:
                    obj.organization_id = active_tenant
                elif obj.organization_id != active_tenant:
                    raise ValueError(
                        f"Cross-tenant insert prohibited: object has tenant {obj.organization_id}, "
                        f"active session tenant is {active_tenant}"
                    )

async def set_session_tenant(session: AsyncSession, tenant_id: uuid.UUID | None) -> None:
    """Sets tenant context for both the ORM filter and PostgreSQL transaction-local setting."""
    current_tenant_var.set(tenant_id)
    tenant_str = str(tenant_id) if tenant_id else ""
    await session.execute(
        text("SELECT set_config('app.current_tenant_id', :t, true)"),
        {"t": tenant_str}
    )

async def reset_session_tenant(session: AsyncSession) -> None:
    """Cleans up tenant context on session completion."""
    current_tenant_var.set(None)
    with contextlib.suppress(Exception):
        if session.is_active:
            await session.execute(text("SELECT set_config('app.current_tenant_id', '', true)"))

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await reset_session_tenant(session)
            await session.close()
