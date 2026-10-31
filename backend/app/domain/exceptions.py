class DomainException(Exception):
    """Base exception for all domain business rule violations."""
    def __init__(self, message: str, code: str = "DOMAIN_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)

class TenantNotFoundException(DomainException):
    def __init__(self, tenant_id: str):
        super().__init__(f"Organización / Inquilino '{tenant_id}' no encontrado", "TENANT_NOT_FOUND")

class InvalidMatchStateException(DomainException):
    def __init__(self, current_status: str, target_status: str):
        super().__init__(
            f"Transición de estado de partido inválida: '{current_status}' -> '{target_status}'",
            "INVALID_MATCH_TRANSITION"
        )

class PlayerIneligibleException(DomainException):
    def __init__(self, player_id: str, reason: str):
        super().__init__(
            f"El jugador '{player_id}' no se encuentra habilitado para el encuentro: {reason}",
            "PLAYER_INELIGIBLE"
        )

class UnauthorizedSportActionException(DomainException):
    def __init__(self, role: str, action: str):
        super().__init__(
            f"El rol '{role}' no posee autorización federativa para ejecutar: '{action}'",
            "UNAUTHORIZED_ACTION"
        )
