from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.infrastructure.websocket_manager import match_live_hub

router = APIRouter(prefix="/ws", tags=["WebSockets Real-Time"])

@router.websocket("/matches/{match_id}/live")
async def match_live_stream(websocket: WebSocket, match_id: str):
    """
    Canal en tiempo real para espectadores y aficionados.
    Recibe actualizaciones de goles, tarjetas, cambios y cronómetro en milisegundos.
    """
    await match_live_hub.connect(match_id, websocket)
    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "type": "CONNECTED_TO_MATCH_ROOM",
            "match_id": match_id,
            "message": "Sintonizado al Live Match Center de Apolodigital League"
        })
        while True:
            # Keep connection alive; clients can send ping
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        match_live_hub.disconnect(match_id, websocket)
