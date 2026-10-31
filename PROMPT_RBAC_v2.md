# PROMPT DE IMPLEMENTACIÓN v2: RBAC Y SEGURIDAD MULTITENANT
**Proyecto:** ApoloDigital League
**Repositorio local:** `D:\Apps\Apolodigital-League`
**Objetivo:** Remediar las brechas de la auditoría de seguridad (puntuación base 48/100) e implementar un modelo RBAC multitenant robusto, verificable fase por fase.

---

## 0. ROL Y REGLAS DE EJECUCIÓN

Actúa como **Lead Security & Backend Architect**. Escribes código, migraciones y pruebas, y lo verificas tú mismo antes de declarar una fase terminada.

**Reglas no negociables:**

1. **Una fase por sesión.** Ejecuta únicamente la fase que se te indique al inicio ("Ejecuta la FASE N"). Al terminar, entrega el resumen de cierre y **detente a esperar aprobación**. No empieces la siguiente fase por iniciativa propia.
2. **Rama aislada.** Trabaja en `feat/rbac-fase-N`, creada desde la rama base indicada. No toques `main` ni hagas push sin que se te pida.
3. **Solo base de datos de pruebas.** Usa una BD local desechable (docker compose o testcontainers). Está **prohibido** leer o usar `.env` de producción, cadenas de conexión remotas o credenciales reales. Si el único `DATABASE_URL` disponible apunta a algo que no sea localhost, detente y pregunta.
4. **No inventes el stack: verifícalo.** Antes de escribir código ejecuta la FASE 0. Si el stack real difiere del esperado, detente y repórtalo.
5. **Migraciones seguras sobre datos existentes.** Toda columna obligatoria nueva sobre tablas con filas sigue el patrón: (a) añadir nullable, (b) backfill, (c) validar sin nulos, (d) `NOT NULL` + índice, en revisiones Alembic separadas y reversibles (`downgrade` funcional).
6. **Puerta de salida de cada fase** (obligatoria): migraciones aplicadas sobre BD limpia **y** sobre una BD con datos semilla, `pytest` en verde, linter y type-check (`ruff`, `mypy --strict` en los módulos nuevos) sin errores. Si algo falla, corrígelo; no avances ni declares éxito.
7. **Honestidad en el reporte.** Si no pudiste ejecutar algo (falta Docker, falla una dependencia), dilo explícitamente. Nunca reportes pruebas como pasadas si no las corriste.
8. **Calidad de producción:** tipado estricto, manejo seguro de errores (sin filtrar trazas ni detalles internos al cliente), validación de entrada con Pydantic, sin secretos en el código, y pruebas para cada ruta de acceso **y** de rechazo.

---

## 1. STACK ESPERADO (verificar en FASE 0)

- Python 3.11+, **FastAPI**, **SQLAlchemy 2.x async**, **PostgreSQL**, **Alembic**, **pytest** (+ `pytest-asyncio`, `httpx.AsyncClient`).
- Autorización mediante **dependencias de FastAPI** (`Depends`), no decoradores estilo NestJS. El equivalente de `@RequirePermission` es `Depends(require_permission("partidos:cerrar_acta"))`.
- Redis para rate limiting (si no existe en el proyecto, proponer añadirlo en la FASE 5 y documentar el modo degradado solo-desarrollo).

---

## 2. DECISIONES DE DISEÑO YA TOMADAS (no reabrir sin preguntar)

| Tema | Decisión |
|---|---|
| Membresía | Un usuario puede pertenecer a **varias ligas (tenants)** mediante una tabla de membresías. El JWT lleva **un solo `tenant_id` activo**. Cambiar de liga = endpoint `POST /auth/switch-tenant` que valida la membresía y emite un **token nuevo**. Nunca se acepta `tenant_id` del body, query o path como fuente de verdad. |
| Respuesta cross-tenant | **404 Not Found** (no revelar existencia del recurso). `403` solo cuando el recurso es del propio tenant pero falta el permiso. |
| Tiempo | Toda regla temporal usa reloj del **servidor en UTC** y timestamps persistidos (`finalizado_en`). Nunca fecha/hora enviada por el cliente. |
| Auditoría | Los campos sensibles (`dni`, `ficha_medica`, `telefono_tutor`, `cuenta_bancaria`) se **redactan o cifran** dentro de `before_state`/`after_state`. El log no puede filtrar lo que la FLS protege. |
| Rate limit | Contador en **Redis**, no en memoria del proceso (varios workers). |
| Auditoría de seguridad | La referencia vive en `docs/auditoria.md`. Si no existe, pídela o créala con los hallazgos que se te provean; no inventes hallazgos. |

---

## FASE 0: INSPECCIÓN Y LÍNEA BASE (sin cambios funcionales)

**Objetivo:** conocer el repo real antes de tocarlo.

**Tareas:**
1. Leer `pyproject.toml`/`requirements*.txt`, estructura de carpetas, `models`, `alembic/versions`, configuración de auth actual (JWT, hashing, dependencias de usuario) y cómo se crea la sesión de BD.
2. Listar todas las tablas y marcar cuáles son **compartidas entre ligas** (requieren `tenant_id`) y cuáles son globales.
3. Identificar endpoints que reciben IDs de recursos (superficie IDOR) y endpoints que hoy aceptan `tenant_id` desde el cliente.
4. Levantar la BD de pruebas y correr la suite existente para dejar la **línea base** (qué pasa, qué falla ya).
5. Producir `docs/rbac/00-inspeccion.md` con: stack confirmado, mapa de tablas (compartida/global), lista de endpoints de riesgo, línea base de tests, y **preguntas abiertas** para mí.

**Criterio de cierre:** documento entregado y preguntas abiertas listadas. Detente y espera aprobación.

---

## FASE 1: AISLAMIENTO MULTITENANT Y CONTEXTO DE SESIÓN

**Objetivo:** eliminar *Cross-Tenant Data Leakage* e IDOR.

**Tareas:**
1. **Esquema:** `tenant_id` obligatorio en todas las entidades compartidas (migración en etapas, regla 5), con FK, índice y, donde aplique, índices únicos compuestos `(tenant_id, ...)`.
2. **Membresías:** tabla `tenant_memberships` (`user_id`, `tenant_id`, estado) y endpoint `POST /auth/switch-tenant`.
3. **Contexto de autenticación:** dependencia que extrae `tenant_id` **exclusivamente** del JWT firmado y verificado (algoritmo fijado, `exp`, `iss`, `aud` validados). Prohibido leerlo de body, query o path.
4. **Row-Level Security en PostgreSQL:**
   - Crear un rol de aplicación (`app_user`) **distinto del dueño** de las tablas, con `NOBYPASSRLS` y sin superusuario. La app se conecta con ese rol; Alembic con el rol dueño.
   - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` **y** `FORCE ROW LEVEL SECURITY` en cada tabla con `tenant_id`.
   - Política por tabla basada en `current_setting('app.current_tenant_id', true)`; si la variable no está definida, la política debe **denegar** (no devolver todo).
   - Fijar el contexto con `SELECT set_config('app.current_tenant_id', :tenant_id, true)` (equivalente a `SET LOCAL`) **al inicio de cada transacción**, dentro de la dependencia de sesión de BD, de modo que nunca sobreviva en una conexión devuelta al pool.
   - Documentar el impacto si se usa pgbouncer en modo transaction.
5. **Defensa en profundidad:** además de RLS, un filtro ORM global (`with_loader_criteria` / evento `do_orm_execute`) que añada `tenant_id` a las consultas, y validación de `tenant_id` en inserts.
6. Tareas administrativas legítimas entre tenants (migraciones, jobs) usan un rol/sesión explícitamente separado y documentado.

**Pruebas y criterios de aceptación:**
- Fixtures con **Liga A** y **Liga B**, cada una con usuarios y datos propios.
- Token de Liga A solicitando recursos de Liga B (GET, PUT, DELETE y listados) → **404**; nunca datos ajenos.
- Un `tenant_id` enviado en body/query/path es **ignorado** (o rechazado) y no cambia el alcance.
- **Prueba de fuga por pool:** dos requests consecutivos de tenants distintos que reutilicen la misma conexión; el segundo jamás ve datos del primero.
- Con `app.current_tenant_id` sin definir, una consulta directa con `app_user` devuelve 0 filas.
- Token expirado, firmado con otra clave o con `tenant_id` sin membresía → 401/403 según corresponda.
- `switch-tenant` hacia una liga sin membresía → rechazado.

---

## FASE 2: PERMISOS ATÓMICOS Y ROLES CONTEXTUALES

**Objetivo:** pasar de CRUD genérico a permisos de negocio con alcance contextual.

**Tareas:**
1. **Catálogo central** (enum/módulo único, fuente de verdad, sembrado por migración) de permisos `modulo:accion`, p. ej.:
   - `partidos:reprogramar`, `partidos:cerrar_acta`, `partidos:asignar_arbitro`, `partidos:editar_acta`
   - `inscripciones:aprobar_tecnica`, `inscripciones:validar_pago`, `inscripciones:registrar_comprobante`
   - `finanzas:conciliar_pago`, `finanzas:exportar_balance`
   - `jugadores:ver_ficha_medica`, `jugadores:actualizar_perfil`
   - `roles:gestionar`, `auditoria:ver`
2. **Modelo:** tablas `roles`, `permissions`, `role_permissions` y `user_roles` con `user_id`, `role_id`, `tenant_id`, `scope_type` (`LEAGUE` | `TOURNAMENT` | `TEAM`), `scope_id`. Restricciones de unicidad y checks de coherencia (`scope_id` obligatorio si `scope_type` ≠ `LEAGUE`). Todas con RLS.
3. **Roles base** sembrados: Super Administrador, Administrador de Liga, Gestor Financiero, Árbitro, Delegado de Equipo, Jugador, Espectador, con su matriz de permisos.
4. **Guard reutilizable:** `Depends(require_permission("partidos:cerrar_acta"))` que resuelva el **scope del recurso** (p. ej. el torneo del partido) y verifique que el usuario tiene el permiso en ese scope o en uno superior (jerarquía LEAGUE ⊃ TOURNAMENT ⊃ TEAM). Denegar por defecto.
5. Los cambios de roles solo los ejecuta quien tenga `roles:gestionar`, y nadie puede **otorgarse a sí mismo** permisos que no posee (anti-escalada).

**Pruebas y criterios de aceptación:**
- Un mismo usuario es `Árbitro` en el Torneo X y `Jugador` en el Torneo Y: puede cerrar acta en X y recibe 403 en Y.
- Usuario sin el permiso atómico específico → 403 inmediato.
- Rol asignado en un scope no concede acceso a otro scope hermano.
- Un usuario no puede asignarse un rol superior ni gestionar roles de otro tenant.
- Cada permiso del catálogo tiene al menos una prueba de acceso y una de rechazo (generada o parametrizada).

---

## FASE 3: PROTECCIÓN DE CAMPOS SENSIBLES (FLS) Y AUDITORÍA INMUTABLE

**Objetivo:** blindar datos de deportistas y garantizar no repudio.

**Tareas:**
1. **Field-Level Security:** serializers/esquemas de respuesta que excluyan o enmascaren `dni`, `ficha_medica`, `telefono_tutor`, `cuenta_bancaria` salvo permiso explícito (p. ej. `jugadores:ver_ficha_medica`). La decisión se toma en una capa central reutilizable, no endpoint por endpoint. Aplica también a listados, exportaciones y respuestas anidadas.
2. **Cifrado en reposo** de los campos más sensibles (ficha médica, cuenta bancaria) con una clave gestionada por configuración, con plan de rotación documentado.
3. **`audit_logs`:** `id`, `tenant_id`, `user_id`, `action`, `resource_name`, `resource_id`, `before_state` (JSONB), `after_state` (JSONB), `ip_address`, `user_agent`, `created_at`.
4. **Captura automática** de mutaciones en: Finanzas, Resultados de partidos, Sanciones disciplinarias y Gestión de roles (evento de SQLAlchemy o capa de servicio única, no dispersa). Calcular el diff exacto `before`/`after`.
5. **Redacción en el log:** los campos sensibles aparecen como `"[REDACTED]"` o hash, nunca en claro.
6. **Inmutabilidad real a nivel de BD:** `REVOKE UPDATE, DELETE, TRUNCATE` sobre `audit_logs` para `app_user`, más un trigger `BEFORE UPDATE OR DELETE` que lance excepción (cubre también al dueño). La tabla es propiedad de un rol distinto del que usa la app.
7. Endpoint de consulta de auditoría protegido por `auditoria:ver` y limitado al tenant.

**Pruebas y criterios de aceptación:**
- Ficha de un jugador consultada como `Espectador`: campos sensibles ausentes o `null`. Como `Delegado de Equipo` con el permiso: presentes según matriz.
- Mutar un marcador y validar un pago genera registro con `before`/`after` exactos.
- Ningún `audit_logs` contiene `dni`, ficha médica ni cuenta bancaria en claro (test que recorre los JSON).
- Intentar `UPDATE`/`DELETE`/`TRUNCATE` sobre `audit_logs` con `app_user` **falla** a nivel de BD.
- Si la escritura de auditoría falla, la mutación de negocio se revierte (misma transacción).

---

## FASE 4: ACCESO POR ESTADO/TIEMPO Y SEGREGACIÓN DE FUNCIONES

**Objetivo:** mitigar fraude en resultados y tesorería.

**Tareas:**
1. **Edición de acta por árbitro:** permitida solo si el partido está `EN_JUEGO` o dentro de la ventana de gracia tras el pitazo final (configurable, por defecto 120 min), calculada con `finalizado_en` (UTC, servidor). Pasada la ventana, el acta pasa a solo lectura. Corrección posterior solo por un rol con permiso explícito (p. ej. `partidos:corregir_acta_cerrada`), con justificación obligatoria y auditoría.
2. **Máquina de estados** del partido con transiciones válidas; rechazar transiciones inválidas.
3. **Segregación de funciones (4 ojos):** el usuario que registra/sube un comprobante no puede conciliarlo ni aprobarlo. Reforzar en servicio **y** en BD (`CHECK` o trigger: `approved_by <> registered_by`). Aplica también a Admin y Delegado.
4. Cada bloqueo por SoD o ventana expirada queda en auditoría.

**Pruebas y criterios de aceptación:**
- Simular 3 horas tras el cierre (mockeando el reloj del servidor, no un parámetro del cliente): actualización de marcador → error de permiso expirado por estado.
- Árbitro edita acta `EN_JUEGO` y dentro de la gracia: OK.
- Admin/Delegado intenta autoaprobar un comprobante propio → bloqueado, con prueba también contra inserción directa en BD.
- Manipular cabeceras o campos de fecha enviados por el cliente no altera la decisión.

---

## FASE 5: GOBIERNO DE APIS, MFA Y ENDPOINTS DE ADMINISTRACIÓN

**Objetivo:** asegurar integraciones externas y cuentas privilegiadas.

**Tareas:**
1. **API Keys con scopes** (`api:scores:read`, `api:stats:read`, `api:live:write`):
   - Clave de alta entropía, mostrada **una sola vez**; se guarda solo su hash y un prefijo identificable.
   - Atada a un `tenant_id`, con scopes, fecha de expiración, revocación y último uso.
   - Dependencia de autenticación específica para API keys, independiente del flujo JWT de usuarios.
2. **Rate limiting** con Redis, diferenciado por tenant y por clave de API, con cabeceras `Retry-After`/`X-RateLimit-*` y respuesta `429`. Definir comportamiento si Redis cae (fail-closed para endpoints sensibles, documentado).
3. **MFA (TOTP)** obligatorio para `Super Administrador`, `Administrador de Liga` y `Gestor Financiero`:
   - Enrolamiento con secreto TOTP **cifrado en reposo** (p. ej. `pyotp` + Fernet/clave de configuración).
   - **Códigos de respaldo** de un solo uso, guardados como hash.
   - Claim `mfa_verified` (y momento de verificación) en el JWT; los endpoints protegidos de roles privilegiados exigen el claim. Reautenticación MFA para acciones críticas (exportar balance, gestionar roles).
   - Límite de intentos fallidos de TOTP.
4. Endpoints de administración agrupados bajo un router que exige permiso + MFA, con rate limit propio.

**Pruebas y criterios de aceptación:**
- Token de API sin el scope requerido → 403.
- Ráfaga de peticiones sobre el límite → `429` con `Retry-After`; otro tenant no se ve afectado.
- Clave revocada o expirada → 401.
- Usuario privilegiado con login sin MFA → acceso denegado a endpoints protegidos; con TOTP válido → permitido; código de respaldo usado dos veces → rechazado.
- La clave de API y el secreto TOTP nunca aparecen en claro en BD ni en logs.

---

## FORMATO DE CIERRE DE CADA FASE (obligatorio)

Al terminar la fase, entrega **solo esto**, de forma concisa:

1. **Archivos creados/modificados** (lista corta).
2. **Cómo ejecutar** migraciones y pruebas de esa fase (comandos exactos).
3. **Resultado real** de la puerta de salida (migraciones, `pytest`, `ruff`, `mypy`) con los números reales.
4. **Matriz de permisos** (a partir de la FASE 2) y **matriz de mitigación** actualizada: hallazgo de `docs/auditoria.md` → control implementado → prueba que lo valida.
5. **Riesgos residuales y decisiones que necesitas de mí.**
6. Detenerte y esperar aprobación.

## ENTREGABLES FINALES (tras aprobar la FASE 5)

- Código modular y probado (modelos, migraciones, dependencias, servicios).
- Suite de pruebas unitarias e integración con escenarios de acceso y rechazo.
- `docs/rbac/RESUMEN.md`: matriz definitiva de permisos atómicos, instrucciones de migración y pruebas, y matriz completa de mitigación de riesgos de la auditoría inicial.
