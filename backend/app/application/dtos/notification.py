
from pydantic import BaseModel


class BulletinGenerateRequest(BaseModel):
    format_type: str  # 'guion_radio' | 'prensa_escrita' | 'capitanes' | 'circular_delegados'
    round_number: int = 3
    radio_station: str | None = "Radio Apolo 98.5 FM"
    custom_announcement: str | None = None
    include_sponsors: bool = True

class BulletinResponse(BaseModel):
    format_type: str
    title: str
    target_audience: str
    content: str
    word_count: int
    estimated_duration_seconds: int | None = None
    generated_at: str

class NotificationBroadcastRequest(BaseModel):
    title: str
    message: str
    category: str = "boletin"  # boletin, sancion, arbitraje, partido, comunicado, sistema
    priority: str = "media"     # alta, media, baja
    channel: str = "all"        # all, whatsapp, web, press
    recipient_phones: list[str] | None = None
    action_url: str | None = None
    sender: str | None = "Comisión de Prensa y Difusión"

class NotificationBroadcastResponse(BaseModel):
    id: str
    success: bool
    channel: str
    recipients_count: int
    status_message: str
    dispatched_at: str

class NotificationItemResponse(BaseModel):
    id: str
    title: str
    message: str
    category: str
    timestamp: str
    is_read: bool
    priority: str
    action_url: str | None = None
    sender: str | None = None
