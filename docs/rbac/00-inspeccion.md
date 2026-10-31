# FASE 0: INSPECCIÓN Y LÍNEA BASE DEL SISTEMA
**Proyecto:** ApoloDigital League  
**Fecha de inspección:** 31 de Octubre de 2026  
**Auditor / Arquitecto:** Lead Security & Backend Architect  
**Repositorio local:** `D:\Apps\Apolodigital-League`

---

## 1. RESUMEN EJECUTIVO

Se ha ejecutado la **FASE 0** del plan de implementación de seguridad RBAC y multitenancy conforme a `PROMPT_RBAC_v2.md`. 
El análisis técnico confirma que el sistema cuenta con una arquitectura base FastAPI + PostgreSQL 16 + Redis + SQLAlchemy 2.0 (async), pero presenta **brechas estructurales críticas de multitenancy, autenticación y autorización**:

1. **Sin repositorio Git:** El directorio de trabajo no es un repositorio Git (`fatal: not a git repository`), lo que bloquea la creación de ramas de trabajo (`feat/rbac-fase-N`) hasta su inicialización.
2. **Desincronización de migraciones:** Alembic contiene únicamente la revisión inicial `001_initial_schema.py` (7 tablas). Las restantes 10 tablas se crearon al vuelo mediante `Base.metadata.create_all` en el lifespan de la app. `alembic check` reporta diferencias críticas de esquema e índices.
3. **Ausencia de RLS y usuario superadministrador en BD:** La aplicación se conecta como `postgres` (Superusuario con `BYPASSRLS`), lo cual desactiva cualquier política de Row-Level Security en PostgreSQL.
4. **Fuga y manipulación de datos cross-tenant (IDOR):** Múltiples endpoints reciben `tournament_id`, `team_id`, `match_id` sin validar la pertenencia a la organización del usuario autenticado. Además, endpoints de alta sensibilidad (sanciones, árbitros, actas y notificaciones masivas) están **completamente abiertos sin autenticación** o funcionan con colecciones en memoria compartidas globalmente.
5. **Herramientas de calidad ausentes:** `ruff` y `mypy` no forman parte de `requirements.txt` ni están instaladas en el contenedor de ejecución.

---

## 2. STACK TECNOLÓGICO CONFIRMADO

| Componente | Esperado según Prompt | Detectado en el Repo | Estado / Discrepancia |
|---|---|---|---|
| **Lenguaje** | Python 3.11+ | Python 3.11.18 en contenedor (`apolo_backend`), Python 3.14.4 en host | ✅ Conforme en contenedor |
| **Framework Web** | FastAPI | `fastapi==0.115.0`, `uvicorn==0.32.0` | ✅ Conforme |
| **Validación** | Pydantic v2 | `pydantic==2.9.2`, `pydantic-settings==2.6.0` | ⚠️ Uso de `Config` obsoleto en DTO `organization.py` |
| **ORM & Driver** | SQLAlchemy 2.x async + asyncpg | `sqlalchemy==2.0.36`, `asyncpg==0.30.0` | ✅ Conforme |
| **Migraciones** | Alembic | `alembic==1.13.3` | ⚠️ Solo 1 migración (`001`), desalineado con modelos |
| **Base de Datos** | PostgreSQL 16 | PostgreSQL 16.10 Alpine en puerto 5435 (Docker) | ⚠️ Conexión actual como superusuario `postgres` |
| **Cache / Cola** | Redis | Redis 7.2 Alpine en puerto 6379 (Docker) | ✅ Conforme |
| **Criptografía/Auth**| JWT, Passlib, Bcrypt | `python-jose==3.3.0`, `passlib==1.7.4`, `bcrypt==4.0.1` | ⚠️ Decodificación sin validar `iss`/`aud` ni algoritmo estricto |
| **Testing** | pytest, pytest-asyncio, httpx | `pytest==8.2.0`, `pytest-asyncio==0.24.0`, `httpx==0.27.2` | ✅ Conforme (18 tests pasan, 0 tests de BD/RLS) |
| **Linter / Tipado** | ruff, mypy --strict | No instalados en contenedor ni host | ❌ Falta instalar en entorno |
| **Control Versiones**| Git (ramas aisladas) | No inicializado en `D:\Apps\Apolodigital-League` | ❌ Requiere `git init` |

---

## 3. MAPA DE TABLAS: COMPARTIDAS VS. GLOBALES

### 3.1 Tablas actualmente en PostgreSQL (17 tablas)

| Tabla | Naturaleza | Columna Tenant actual | Evaluación de Aislamiento |
|---|---|---|---|
| `organizations` | **Entidad Tenant** | `id` (PK) | Tabla raíz de organizaciones/ligas. |
| `subscriptions` | Compartida | `organization_id` (FK NOT NULL) | Aislada por organización (1:1). |
| `users` | Compartida / Global | `organization_id` (FK NULLABLE) | ⚠️ 1:N directo. Falta tabla `tenant_memberships` para permitir pertenencia a múltiples ligas. |
| `seasons` | Compartida | `organization_id` (FK NOT NULL) | Aislada por organización. |
| `tournaments` | Compartida | `organization_id` (FK NOT NULL) | Aislada por organización. |
| `teams` | Compartida | `organization_id` (FK NOT NULL) | Aislada por organización. |
| `venues` | Compartida | `organization_id` (FK NOT NULL) | Aislada por organización. |
| `matches` | Compartida | `organization_id` (FK NOT NULL) | Aislada por organización. |
| `match_events` | Compartida | `organization_id` (FK NOT NULL) | Aislada por organización. |
| `players` | Compartida | `organization_id` (FK NOT NULL) | Aislada por organización. Expone `document_id` sin FLS. |
| `referees` | Compartida | `organization_id` (FK NOT NULL) | Aislada en BD, pero endpoints de creación permiten saltar tenant. |
| `audit_logs` | Compartida | `organization_id` (NULLABLE) | ⚠️ Requiere ajuste de esquema (`before_state`/`after_state`), inmutabilidad y RLS. |
| `matchdays` | **Compartida (Riesgo)**| **NO TIENE** | ❌ Solo tiene `tournament_id`. Requiere `tenant_id`/`organization_id` para RLS directo. |
| `standings` | **Compartida (Riesgo)**| **NO TIENE** | ❌ Solo tiene `tournament_id` y `team_id`. Requiere `tenant_id` para RLS. |
| `player_statistics`| **Compartida (Riesgo)**| **NO TIENE** | ❌ Solo tiene `player_id` y `tournament_id`. Requiere `tenant_id` para RLS. |
| `referee_assignments`| **Compartida (Riesgo)**| **NO TIENE** | ❌ Solo tiene `match_id` y `referee_id`. Requiere `tenant_id` para RLS. |
| `alembic_version` | Global | N/A | Tabla de control de migraciones. |

### 3.2 Entidades en Memoria (No persistidas ni aisladas)
- `_SANCTIONS_DB` (`app/presentation/api/v1/endpoints/discipline.py`): Mock en memoria compartido para todas las organizaciones; no implementa aislamiento ni persistencia.
- `_NOTIFICATIONS_STORE` (`app/presentation/api/v1/endpoints/notifications.py`): Mock en memoria global sin discriminación por organización.

### 3.3 Tablas Requeridas para Fases 1 a 5 (Pendientes de creación)
1. `tenant_memberships` (`user_id`, `tenant_id`, `status`, `created_at`, `updated_at`)
2. `permissions` (`id`, `code`, `module`, `action`, `description`)
3. `roles` (`id`, `tenant_id`, `name`, `code`, `is_system`, `description`)
4. `role_permissions` (`role_id`, `permission_id`)
5. `user_roles` (`user_id`, `role_id`, `tenant_id`, `scope_type`, `scope_id`)
6. `api_keys` (`id`, `tenant_id`, `name`, `key_prefix`, `hashed_key`, `scopes`, `expires_at`, `revoked_at`)
7. `user_totp` (`user_id`, `secret_encrypted`, `is_enabled`, `backup_codes_hash`)

---

## 4. SUPERFICIE DE RIESGO: IDOR, FUGA CROSS-TENANT Y RUTAS DESPROTEGIDAS

### 4.1 Endpoints que aceptan identificación de Tenant desde el Cliente
1. `GET /api/v1/tournaments/?organization_slug=...`: Acepta `organization_slug` por Query Param.
2. `GET /api/v1/teams/?organization_slug=...`: Acepta `organization_slug` por Query Param.
3. `GET /api/v1/referees/?organization_id=...`: Acepta `organization_id` por Query Param.
4. `POST /api/v1/referees/`: Acepta `organization_id` en el cuerpo JSON del request (`RefereeCreate`).
5. Dependencia `get_tenant_from_header` (`auth_deps.py`): Lee la cabecera HTTP `X-Organization-Slug` enviada por el cliente.
> **Violación de la Regla de Diseño:** El `tenant_id` debe provenir **exclusivamente del JWT verificado**, nunca de body, query, path ni cabeceras no autenticadas.

### 4.2 Endpoints con Riesgo Severo de IDOR (Sin verificación de propiedad)
1. `POST /api/v1/tournaments/{tournament_id}/generate-fixtures`: Recibe `tournament_id` en el Path. No verifica si el torneo pertenece a la organización del usuario autenticado; podría generar y corromper partidos en torneos ajenos.
2. `POST /api/v1/teams/{team_id}/players`: Recibe `team_id` en el Path. No valida si el equipo pertenece a la organización activa del usuario.
3. `PUT /api/v1/matches/{match_id}`: Recibe `match_id` en el Path. El servicio `MatchService.update_match_status` actualiza el resultado y estado sin verificar `match.organization_id == current_user.organization_id`.
4. `POST /api/v1/matches/{match_id}/events`: Recibe `match_id` en el Path. Permite registrar goles, tarjetas o expulsiones sobre partidos de otra organización.
5. `POST /api/v1/ai/chronicle`: Recibe `match_id` en el body. Redacta crónicas y extrae datos de cualquier partido.

### 4.3 Endpoints Críticos Completamente Abiertos (Públicos sin autenticación)
1. `POST /api/v1/referees/`: Sin dependencia de autenticación; cualquiera puede inyectar árbitros colegiados.
2. `POST /api/v1/referees/matches/{match_id}/assignments`: Sin autenticación; cualquiera puede asignar árbitros a partidos de cualquier liga.
3. `POST /api/v1/referees/matches/{match_id}/sign`: Sin autenticación; cualquiera puede firmar y sellar digitalmente un acta arbitral oficial.
4. `GET/POST/PUT/DELETE /api/v1/discipline/sanctions*`: Sin autenticación ni autorización. Cualquier persona en internet puede crear, modificar o eliminar fallos disciplinarios del Tribunal de Penas.
5. `POST /api/v1/notifications/broadcast`: Sin autenticación; permite ejecutar envíos masivos por WhatsApp y registrar comunicados oficiales.

### 4.4 Exposición de Datos Personales y Sensibles (FLS pendiente)
1. `GET /api/v1/teams/players/{player_id}`: Retorna públicamente el DNI/CI boliviano (`document_id`) y fecha de nacimiento de los jugadores sin control de acceso por campo.
2. `GET /api/v1/referees/{referee_id}`: Retorna número de teléfono personal y datos federativos de árbitros a cualquier cliente sin autenticación.

---

## 5. LÍNEA BASE DE PRUEBAS (TEST SUITE)

### 5.1 Ejecución Actual
- **Comando:** `docker exec apolo_backend pytest -v`
- **Total ejecutados:** 18
- **Resultado:** **18 pasados (100%), 0 fallos, 2 advertencias**
- **Tiempo:** 2.95 segundos
- **Detalle de pruebas:**
  - `tests/test_auth.py`: 2 passed (`test_password_hashing`, `test_jwt_generation_and_decode`)
  - `tests/test_berger_algorithm.py`: 1 passed (`test_berger_pairing_logic`)
  - `tests/test_discipline.py`: 2 passed (`test_sanction_dto_validation`, `test_sanction_resolution_code_format`)
  - `tests/test_notifications.py`: 8 passed (Validaciones DTO y TestClient contra store en memoria)
  - `tests/test_official_sheet.py`: 1 passed (`test_match_official_sheet_dto`)
  - `tests/test_referees.py`: 2 passed (`test_referee_dto_validation`, `test_cryptographic_match_seal_generation`)
  - `tests/test_stats_engine.py`: 1 passed (`test_standings_formula`)

### 5.2 Brechas de la Suite de Pruebas
1. **0% de pruebas contra base de datos real:** Todos los tests actuales son de lógica pura en memoria o usan el mock store.
2. **0% de pruebas de aislamiento multitenant:** No existe ningún test que cree datos para una "Liga A" y una "Liga B" y verifique el aislamiento.
3. **0% de pruebas de autorización / RBAC:** No se prueban restricciones de roles (`require_roles`), denegación por falta de permisos o scopes contextuales.
4. **0% de pruebas de RLS / inyección de contexto de sesión:** No se verifica la sesión de PostgreSQL ni la variable `app.current_tenant_id`.

---

## 6. PREGUNTAS ABIERTAS Y DECISIONES PARA EL USUARIO (BLOQUEANTES PARA FASE 1)

1. **Inicialización de Git:**
   El proyecto no tiene un repositorio Git inicializado (`fatal: not a git repository`). Para cumplir la Regla 2 ("Trabajar en `feat/rbac-fase-N`"), ¿autorizas inicializar el repositorio local con `git init` y crear el commit inicial base antes de crear la rama `feat/rbac-fase-1`?

2. **Nomenclatura del Identificador Tenant:**
   En los modelos actuales de SQLAlchemy y la base de datos se utiliza `organization_id` (y la tabla `organizations`), mientras que las especificaciones de `PROMPT_RBAC_v2.md` utilizan el término `tenant_id` y `tenant_memberships`.
   - **Opción A (Recomendada):** Mantener `organization_id` en las tablas existentes y crear `tenant_memberships` con `tenant_id` como FK a `organizations.id`, exponiendo `tenant_id` en el JWT y el contexto de sesión.
   - **Opción B:** Renombrar todas las columnas de `organization_id` a `tenant_id` en una migración de esquema.

3. **Configuración de RLS y Roles en PostgreSQL:**
   Actualmente la conexión en `docker-compose.yml` usa el usuario `postgres`, que al ser superusuario **ignora completamente las políticas de Row Level Security (`BYPASSRLS`)**.
   Para la Fase 1: ¿aprobamos crear el usuario de base de datos `app_user` (con privilegios estándar y `NOBYPASSRLS`) para la app, manteniendo el rol `postgres` exclusivamente para que Alembic aplique migraciones DDL?

4. **Instalación de Ruff y Mypy:**
   Para validar la Puerta de Salida obligatoria (Regla 6: `pytest`, `ruff`, `mypy --strict`), ¿procedemos a agregar `ruff` y `mypy` en `requirements.txt` (o `requirements-dev.txt`) del backend?

5. **Entidades en Memoria (`discipline` y `notifications`):**
   Las sanciones del Tribunal de Penas y las Notificaciones están almacenadas en listas en memoria globales (`_SANCTIONS_DB` y `_NOTIFICATIONS_STORE`), por lo que no tienen soporte multitenant ni persistencia en BD. ¿Confirmamos persistirlas en modelos SQLAlchemy con sus respectivas migraciones en las fases correspondientes (Fase 2/3)?

---

## 7. CRITERIO DE CIERRE DE LA FASE 0

- [x] Inspección completa de dependencias, configuración y modelos.
- [x] Mapa de tablas clasificadas entre compartidas, globales y faltantes.
- [x] Inventario de endpoints con riesgo IDOR, recepción de tenant de cliente y rutas desprotegidas.
- [x] Línea base de pruebas ejecutada y documentada (18 pasadas en contenedor Docker).
- [x] Documento entregado en `docs/rbac/00-inspeccion.md`.
- [x] Preguntas abiertas listadas para decisión del usuario.

**Estado:** FASE 0 completada. Esperando retroalimentación y aprobación para iniciar la FASE 1.