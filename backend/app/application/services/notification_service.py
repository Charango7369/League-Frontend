
import httpx

from app.config import settings


class NotificationService:
    def __init__(self):
        self.api_token = settings.WHATSAPP_API_TOKEN
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID

    async def send_whatsapp_template(
        self,
        to_phone: str,
        template_name: str,
        parameters: list
    ) -> bool:
        """
        Sends an official WhatsApp Business Cloud API message using pre-approved templates.
        """
        if not self.api_token or not self.phone_number_id:
            # Running in simulation mode when Meta credentials not provided in dev
            print(f"[WHATSAPP SIMULATION] Mensaje enviado a {to_phone}: Plantilla '{template_name}'")
            return True

        url = f"https://graph.facebook.com/v20.0/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": "es"},
                "components": [
                    {
                        "type": "body",
                        "parameters": [{"type": "text", "text": str(p)} for p in parameters]
                    }
                ]
            }
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, headers=headers, json=payload, timeout=10.0)
                return resp.status_code in (200, 201)
        except Exception as e:
            print(f"[WHATSAPP ERROR] Fallo al despachar notificación: {e}")
            return False

    def format_standings_share_message(self, tournament_name: str, standings_rows: list) -> str:
        """
        Generates polished sports broadcast text for WhatsApp groups.
        """
        msg = f"🏆 *{tournament_name.upper()}* 🇧🇴\n"
        msg += "📍 *Liga Oficial Franz Tamayo · Apolo*\n"
        msg += "━━━━━━━━━━━━━━━━━━━━\n"
        msg += "📊 *TABLA DE POSICIONES ACTUALIZADA*\n\n"

        for idx, row in enumerate(standings_rows, start=1):
            medal = "🥇" if idx == 1 else "🥈" if idx == 2 else "🥉" if idx == 3 else f"{idx}."
            diff = f"+{row.goal_difference}" if row.goal_difference > 0 else f"{row.goal_difference}"
            team_name = row.team.name if hasattr(row, 'team') and row.team else "Club"
            msg += f"{medal} *{team_name}* — {row.points} pts | PJ:{row.played} (DG: {diff})\n"

        msg += "\n━━━━━━━━━━━━━━━━━━━━\n"
        msg += "📲 *Desarrollado por Apolodigital.lat*\n"
        msg += "⚡ Tecnología deportiva desde la Bolivia Real 🇧🇴\n"
        msg += f"💬 Contacto: https://wa.me/{settings.WHATSAPP_DEFAULT_PHONE}\n"
        return msg

notification_service = NotificationService()
