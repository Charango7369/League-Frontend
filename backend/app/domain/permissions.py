"""Central Catalog of Permissions and Roles for ApoloDigital League.

Single source of truth for atomic permissions, role definitions, and scope hierarchies.
"""

from enum import StrEnum


class ScopeType(StrEnum):
    LEAGUE = "LEAGUE"
    TOURNAMENT = "TOURNAMENT"
    TEAM = "TEAM"


class SystemRole(StrEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN_LIGA = "ADMIN_LIGA"
    GESTOR_FINANCIERO = "GESTOR_FINANCIERO"
    ARBITRO = "ARBITRO"
    DELEGADO_EQUIPO = "DELEGADO_EQUIPO"
    JUGADOR = "JUGADOR"
    ESPECTADOR = "ESPECTADOR"


class PermissionName(StrEnum):
    # Partidos
    PARTIDOS_VER = "partidos:ver"
    PARTIDOS_CREAR = "partidos:crear"
    PARTIDOS_REPROGRAMAR = "partidos:reprogramar"
    PARTIDOS_EDITAR_ACTA = "partidos:editar_acta"
    PARTIDOS_CERRAR_ACTA = "partidos:cerrar_acta"
    PARTIDOS_ASIGNAR_ARBITRO = "partidos:asignar_arbitro"
    PARTIDOS_CORREGIR_ACTA_CERRADA = "partidos:corregir_acta_cerrada"

    # Torneos & Temporadas
    TORNEOS_VER = "torneos:ver"
    TORNEOS_CREAR = "torneos:crear"
    TORNEOS_EDITAR = "torneos:editar"
    TORNEOS_ELIMINAR = "torneos:eliminar"

    # Equipos
    EQUIPOS_VER = "equipos:ver"
    EQUIPOS_CREAR = "equipos:crear"
    EQUIPOS_EDITAR = "equipos:editar"
    EQUIPOS_ELIMINAR = "equipos:eliminar"

    # Jugadores
    JUGADORES_VER = "jugadores:ver"
    JUGADORES_CREAR = "jugadores:crear"
    JUGADORES_ACTUALIZAR_PERFIL = "jugadores:actualizar_perfil"
    JUGADORES_VER_FICHA_MEDICA = "jugadores:ver_ficha_medica"

    # Inscripciones
    INSCRIPCIONES_VER = "inscripciones:ver"
    INSCRIPCIONES_REGISTRAR_COMPROBANTE = "inscripciones:registrar_comprobante"
    INSCRIPCIONES_VALIDAR_PAGO = "inscripciones:validar_pago"
    INSCRIPCIONES_APROBAR_TECNICA = "inscripciones:aprobar_tecnica"

    # Finanzas
    FINANZAS_VER = "finanzas:ver"
    FINANZAS_CONCILIAR_PAGO = "finanzas:conciliar_pago"
    FINANZAS_EXPORTAR_BALANCE = "finanzas:exportar_balance"

    # Roles & Permisos
    ROLES_VER = "roles:ver"
    ROLES_GESTIONAR = "roles:gestionar"

    # Auditoria
    AUDITORIA_VER = "auditoria:ver"

    # Notificaciones
    NOTIFICACIONES_VER = "notificaciones:ver"
    NOTIFICACIONES_EMITIR = "notificaciones:emitir"

    # Árbitros
    ARBITROS_VER = "arbitros:ver"
    ARBITROS_GESTIONAR = "arbitros:gestionar"
    ARBITROS_FIRMAR_ACTA = "arbitros:firmar_acta"


# Matriz canónica de asignación Rol -> Permisos Atómicos
ROLE_PERMISSIONS_MATRIX: dict[SystemRole, list[PermissionName]] = {
    SystemRole.SUPER_ADMIN: list(PermissionName),
    SystemRole.ADMIN_LIGA: [
        PermissionName.PARTIDOS_VER,
        PermissionName.PARTIDOS_CREAR,
        PermissionName.PARTIDOS_REPROGRAMAR,
        PermissionName.PARTIDOS_EDITAR_ACTA,
        PermissionName.PARTIDOS_CERRAR_ACTA,
        PermissionName.PARTIDOS_ASIGNAR_ARBITRO,
        PermissionName.PARTIDOS_CORREGIR_ACTA_CERRADA,
        PermissionName.TORNEOS_VER,
        PermissionName.TORNEOS_CREAR,
        PermissionName.TORNEOS_EDITAR,
        PermissionName.TORNEOS_ELIMINAR,
        PermissionName.EQUIPOS_VER,
        PermissionName.EQUIPOS_CREAR,
        PermissionName.EQUIPOS_EDITAR,
        PermissionName.EQUIPOS_ELIMINAR,
        PermissionName.JUGADORES_VER,
        PermissionName.JUGADORES_CREAR,
        PermissionName.JUGADORES_ACTUALIZAR_PERFIL,
        PermissionName.JUGADORES_VER_FICHA_MEDICA,
        PermissionName.INSCRIPCIONES_VER,
        PermissionName.INSCRIPCIONES_REGISTRAR_COMPROBANTE,
        PermissionName.INSCRIPCIONES_VALIDAR_PAGO,
        PermissionName.INSCRIPCIONES_APROBAR_TECNICA,
        PermissionName.FINANZAS_VER,
        PermissionName.FINANZAS_CONCILIAR_PAGO,
        PermissionName.FINANZAS_EXPORTAR_BALANCE,
        PermissionName.ROLES_VER,
        PermissionName.ROLES_GESTIONAR,
        PermissionName.AUDITORIA_VER,
        PermissionName.NOTIFICACIONES_VER,
        PermissionName.NOTIFICACIONES_EMITIR,
        PermissionName.ARBITROS_VER,
        PermissionName.ARBITROS_GESTIONAR,
        PermissionName.ARBITROS_FIRMAR_ACTA,
    ],
    SystemRole.GESTOR_FINANCIERO: [
        PermissionName.FINANZAS_VER,
        PermissionName.FINANZAS_CONCILIAR_PAGO,
        PermissionName.FINANZAS_EXPORTAR_BALANCE,
        PermissionName.INSCRIPCIONES_VER,
        PermissionName.INSCRIPCIONES_VALIDAR_PAGO,
        PermissionName.TORNEOS_VER,
        PermissionName.EQUIPOS_VER,
    ],
    SystemRole.ARBITRO: [
        PermissionName.PARTIDOS_VER,
        PermissionName.PARTIDOS_EDITAR_ACTA,
        PermissionName.PARTIDOS_CERRAR_ACTA,
        PermissionName.ARBITROS_VER,
        PermissionName.ARBITROS_FIRMAR_ACTA,
        PermissionName.TORNEOS_VER,
        PermissionName.EQUIPOS_VER,
        PermissionName.JUGADORES_VER,
    ],
    SystemRole.DELEGADO_EQUIPO: [
        PermissionName.INSCRIPCIONES_VER,
        PermissionName.INSCRIPCIONES_REGISTRAR_COMPROBANTE,
        PermissionName.JUGADORES_VER,
        PermissionName.JUGADORES_CREAR,
        PermissionName.JUGADORES_ACTUALIZAR_PERFIL,
        PermissionName.JUGADORES_VER_FICHA_MEDICA,
        PermissionName.EQUIPOS_VER,
        PermissionName.EQUIPOS_EDITAR,
        PermissionName.PARTIDOS_VER,
        PermissionName.TORNEOS_VER,
    ],
    SystemRole.JUGADOR: [
        PermissionName.JUGADORES_VER,
        PermissionName.EQUIPOS_VER,
        PermissionName.PARTIDOS_VER,
        PermissionName.TORNEOS_VER,
    ],
    SystemRole.ESPECTADOR: [
        PermissionName.PARTIDOS_VER,
        PermissionName.TORNEOS_VER,
        PermissionName.EQUIPOS_VER,
        PermissionName.JUGADORES_VER,
    ],
}
