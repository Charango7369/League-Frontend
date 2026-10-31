import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status

from app.application.dtos.notification import (
    BulletinGenerateRequest,
    BulletinResponse,
    NotificationBroadcastRequest,
    NotificationBroadcastResponse,
    NotificationItemResponse,
)
from app.application.services.notification_service import notification_service

router = APIRouter(prefix="/notifications", tags=["Centro de Notificaciones & Boletines de Prensa"])

_NOTIFICATIONS_STORE: list[dict] = [
    {
        "id": "notif-001",
        "title": "Resolución Disciplinaria Nº 01/2026",
        "message": "El Tribunal de Penas emitió sanción de 1 fecha para Carlos Mendoza (Defensor Apolo). Cumple en la Jornada 4.",
        "category": "sancion",
        "timestamp": "Hace 25 min",
        "is_read": False,
        "priority": "alta",
        "action_url": "#disciplina",
        "sender": "Tribunal de Penas y Disciplina",
    },
    {
        "id": "notif-002",
        "title": "Guion Radial Jornada 3 Disponible",
        "message": "Se generó el resumen oficial para Radio Apolo 98.5 FM y Radio Madidi con los resultados de la Fecha 3.",
        "category": "boletin",
        "timestamp": "Hace 1 hora",
        "is_read": False,
        "priority": "media",
        "action_url": "#prensa",
        "sender": "Comisión de Prensa y Difusión",
    },
    {
        "id": "notif-003",
        "title": "Terna Arbitral Designada - Clásico Norteño",
        "message": "Wilstermann de Franz Tamayo vs Municipal Apolo contará con Wilson Chambi como Árbitro Principal en el Estadio Municipal.",
        "category": "arbitraje",
        "timestamp": "Hace 3 horas",
        "is_read": True,
        "priority": "media",
        "action_url": "#arbitros",
        "sender": "Colegio de Árbitros Franz Tamayo",
    },
    {
        "id": "notif-004",
        "title": "Acta Oficial Firmada y Bloqueada",
        "message": "El acta del partido Municipal Apolo vs Atlético Apolo (3-1) fue digitalmente sellada por el 4to Árbitro.",
        "category": "partido",
        "timestamp": "Ayer, 18:45",
        "is_read": True,
        "priority": "baja",
        "action_url": "#partidos",
        "sender": "Mesa de Control Oficial",
    },
    {
        "id": "notif-005",
        "title": "Inspección de Terreno de Juego",
        "message": "Comisión técnica verificó el drenaje del Estadio Municipal tras lluvias matutinas. Cancha habilitada al 100%.",
        "category": "comunicado",
        "timestamp": "Ayer, 09:15",
        "is_read": True,
        "priority": "media",
        "action_url": "#prensa",
        "sender": "Alcaldía / Comisión Técnica",
    },
]

@router.get("/recent", response_model=list[NotificationItemResponse])
async def get_recent_notifications(category: str | None = None):
    """
    Returns recent notifications and official communications of the league.
    """
    if category and category != "all":
        return [n for n in _NOTIFICATIONS_STORE if n["category"] == category]
    return _NOTIFICATIONS_STORE

@router.post("/bulletin/generate", response_model=BulletinResponse)
async def generate_press_bulletin(req: BulletinGenerateRequest):
    """
    Generates multi-format official press bulletins (Radio, Written Press, WhatsApp, Circulars).
    """
    now_str = datetime.now(UTC).strftime("%d/%m/%Y %H:%M UTC")
    station = req.radio_station or "Radio Apolo 98.5 FM"

    if req.format_type == "guion_radio":
        title = f"Guion Radial Deportivo - Jornada {req.round_number} ({station})"
        target = "Emisoras Radiales (Radio Apolo 98.5 FM, Radio Madidi 101.3 FM, Deportes del Norte)"
        content = f"""[CORTINILLA ENTRADA: Himno o redoble deportivo con bombos y trompetas tradicionales - 5 seg]

[LOCUTOR 1]: ¡Muy buenas tardes a toda la apasionada afición de la provincia Franz Tamayo y del norte de La Paz! Sintonizan {station}, la voz que vibra al ritmo del balón en cada rincón de nuestra querida tierra apoleña.

[LOCUTOR 2]: ¡Efectivamente, amigos oyentes! Ha concluido la emocionante Jornada {req.round_number} del Torneo Apertura 2026 de la Liga Provincial de Fútbol Apolo. Una fecha vibrante, cargada de entrega y goles que quedarán en la memoria de la afición.

[AUDIO AMBIENTE: Grito de tribuna y silbato arbitral - 3 seg]

[LOCUTOR 1]: Vámonos de inmediato con el resumen de la jornada en el Estadio Municipal de Apolo:
- Municipal Apolo se impuso con autoridad 3 a 1 sobre Atlético Apolo con doblete de Marcelo 'Chelo' Ramos.
- En un duelo de dientes apretados, Deportivo Franz Tamayo igualó 2 a 2 ante Wilstermann de Franz Tamayo.
- Chawaya F.C. sorprendió a la afición con un contundente 2 a 0 frente a Defensor Apolo.

[LOCUTOR 2]: En la tabla de goleadores, Marcelo Ramos se consolida como artillero solitario con 4 tantos, seguido muy de cerca por Dante Mercado con 3 dianas. ¡Poder de fuego en el ataque norteño!

[LOCUTOR 1]: Y atención delegados y capitanes: el Tribunal de Penas ratificó que las sanciones emitidas se cumplen estrictamente en la próxima fecha. El Colegio de Árbitros ya alista las ternas para el próximo fin de semana.

[CORTINILLA CIERRE: Fanfarria de fondo en fade out - 4 seg]

[LOCUTOR 2]: Gracias por sintonizar {station}. Los datos oficiales, tablas y actas están disponibles al instante en la plataforma digital www.apolodigital.lat. ¡Hasta el próximo pitazo inicial!"""
        duration = 110

    elif req.format_type == "prensa_escrita":
        title = f"Comunicado de Prensa Oficial - Jornada {req.round_number}"
        target = "Prensa Departamental, Suplementos Deportivos y Periódicos Digitales"
        content = f"""BOLETÍN DE PRENSA OFICIAL Nº {req.round_number:02d}/2026
ASOCIACIÓN DEPORTIVA Y LIGA PROVINCIAL DE FÚTBOL APOLO
PROVINCIA FRANZ TAMAYO — LA PAZ, BOLIVIA

Apolo, {now_str}

ASUNTO: CONCLUSIÓN DE LA FECHA {req.round_number} Y DESIGNACIONES DISCIPLINARIAS OFICIALES

La Comisión de Prensa y Relaciones Públicas de la Liga de Fútbol Apolo informa a la opinión pública, directores de medios de comunicación y afición deportiva:

1. RESULTADOS OFICIALES Y TABLA GENERAL:
Concluyeron con pleno éxito los compromisos correspondientes a la Jornada {req.round_number}, disputados en el campo oficial del Estadio Municipal de Apolo bajo estricto control de la terna arbitral colegiada de Franz Tamayo. Municipal Apolo afianza su condición de puntero con 7 unidades, escoltado por Atlético Apolo y Deportivo Franz Tamayo.

2. RESOLUCIONES DEL TRIBUNAL DE JUSTICIA DEPORTIVA:
El Tribunal de Penas emitió su resolución semanal disponiendo 1 fecha de suspensión para el jugador Carlos Mendoza (Defensor Apolo) conforme a las actas digitales convalidadas.

3. PRÓXIMA JORNADA:
El fixture de la siguiente fecha se encuentra ratificado sin modificaciones reglamentarias. Se convoca a la reunión ordinaria de delegados el día martes a las 19:30 en la sede institucional de la Liga.

Agradecemos la amplia cobertura y el fomento del deporte provincial.

Atentamente,
COMISIÓN DE PRENSA Y DIFUSIÓN OFICIAL
LIGA PROVINCIAL DE FÚTBOL APOLO — FRANZ TAMAYO"""
        duration = None

    elif req.format_type == "capitanes":
        title = f"Kit Informativo Rápido para WhatsApp & Redes - Fecha {req.round_number}"
        target = "Capitanes, Delegados, Grupos de Clubes y Afición en Redes Sociales"
        content = f"""🏆 *LIGA PROVINCIAL DE FÚTBOL APOLO 2026* 🇧🇴
📍 *Provincia Franz Tamayo · Torneo Apertura*
━━━━━━━━━━━━━━━━━━━━━━
⚽ *RESUMEN RÁPIDO · FECHA {req.round_number}*

📊 *Resultados Oficiales:*
• Municipal Apolo 3 - 1 Atlético Apolo
• Franz Tamayo 2 - 2 Wilstermann
• Chawaya F.C. 2 - 0 Defensor Apolo

🥇 *Líder del Torneo:* Municipal Apolo (7 pts, DG +3)
👟 *Pichichi:* Marcelo Ramos (4 goles)

⚠️ *Aviso Tribunal de Disciplina:*
• 1 jugador suspendido para la fecha {req.round_number + 1}.

🗓️ *Siguiente Jornada:*
• Domingo 14:00 - Franz Tamayo vs Municipal Apolo
• Domingo 16:00 - Atlético Apolo vs Chawaya F.C.
• Sede: Estadio Municipal de Apolo

📲 Consulta tablas completas, actas y credenciales en:
👉 https://apolodigital.lat
━━━━━━━━━━━━━━━━━━━━━━
_Desarrollado con orgullo y tecnología boliviana 🇧🇴_"""
        duration = None

    else:
        # circular_delegados
        title = f"Circular Oficial para Delegados Nº 0{req.round_number}/2026"
        target = "Directores Técnicos, Delegados de Club y Autoridades del Municipio"
        content = f"""CIRCULAR OFICIAL Nº 0{req.round_number}/2026
ASOCIACIÓN MUNICIPAL DE FÚTBOL APOLO
AFILIADA A LA ASOCIACIÓN DE FÚTBOL DE LA PAZ (AFLP / FBF)

Para: Presidentes y Delegados Oficiales de los Clubes Afiliados
De: Presidencia y Comité Técnico de la Liga
Fecha: {now_str}
Ref.: Convocatoria a reunión de programación, entrega de planillas y recaudos

Estimados Delegados:

Mediante la presente circular se les convoca con carácter de estricta obligatoriedad a la REUNIÓN TÉCNICA ORDINARIA:

1. FECHA Y HORA: Martes 19:30 horas (Tolerancia: 10 minutos).
2. LUGAR: Sede Social de la Liga Municipal de Apolo.
3. ORDEN DEL DÍA:
   a) Aprobación de actas y planillas de juego de la Jornada {req.round_number}.
   b) Notificación formal de resoluciones del Tribunal de Penas.
   c) Ratificación de árbitros designados para la fecha venidera.
   d) Pago de aranceles arbitrales y mantenimiento de cancha.
   e) Asuntos varios y solicitudes de clubes.

Se recuerda que conforme al Artículo 18 del Reglamento de Campeonato, el club que no asista con su delegado acreditado se hará pasible a la multa reglamentaria de 50 Bs.

Con este motivo saludamos a ustedes con las más distinguidas consideraciones.

Atentamente,
DIRECTORIO GENERAL
LIGA DE FÚTBOL APOLO — BOLIVIA"""
        duration = None

    words = len(content.split())

    return BulletinResponse(
        format_type=req.format_type,
        title=title,
        target_audience=target,
        content=content,
        word_count=words,
        estimated_duration_seconds=duration,
        generated_at=now_str,
    )

@router.post("/broadcast", response_model=NotificationBroadcastResponse)
async def broadcast_notification(req: NotificationBroadcastRequest):
    """
    Dispatches notifications and press releases to WhatsApp groups or platform subscribers.
    """
    now_str = datetime.now(UTC).strftime("%d/%m/%Y %H:%M")
    new_id = f"notif-{uuid.uuid4().hex[:8]}"

    # Add to in-memory notification store
    _NOTIFICATIONS_STORE.insert(0, {
        "id": new_id,
        "title": req.title,
        "message": req.message,
        "category": req.category,
        "timestamp": "Ahora mismo",
        "is_read": False,
        "priority": req.priority,
        "action_url": req.action_url or "#prensa",
        "sender": req.sender or "Comisión de Prensa y Difusión",
    })

    # Dispatch to WhatsApp service (template or broadcast simulation)
    recipients_count = len(req.recipient_phones) if req.recipient_phones else 24
    if req.recipient_phones:
        for phone in req.recipient_phones:
            await notification_service.send_whatsapp_template(
                to_phone=phone,
                template_name="league_press_bulletin",
                parameters=[req.title, req.message[:120]]
            )

    return NotificationBroadcastResponse(
        id=new_id,
        success=True,
        channel=req.channel,
        recipients_count=recipients_count,
        status_message=f"Boletín emitido exitosamente a {recipients_count} destinatarios mediante canal '{req.channel}'",
        dispatched_at=now_str,
    )

@router.post("/{notif_id}/read")
async def mark_notification_read(notif_id: str):
    """
    Marks a notification as read.
    """
    for n in _NOTIFICATIONS_STORE:
        if n["id"] == notif_id:
            n["is_read"] = True
            return {"status": "success", "id": notif_id, "is_read": True}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificación no encontrada")
