import json

from fastapi import WebSocket


class MatchLiveHub:
    """Manages active WebSocket connections subscribed to specific match live rooms."""
    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = {}

    async def connect(self, match_id: str, websocket: WebSocket):
        await websocket.accept()
        if match_id not in self.rooms:
            self.rooms[match_id] = set()
        self.rooms[match_id].add(websocket)

    def disconnect(self, match_id: str, websocket: WebSocket):
        if match_id in self.rooms:
            self.rooms[match_id].discard(websocket)
            if not self.rooms[match_id]:
                del self.rooms[match_id]

    async def broadcast_to_match(self, match_id: str, message: dict):
        if match_id not in self.rooms:
            return
        payload = json.dumps(message)
        dead_connections = set()
        for connection in self.rooms[match_id]:
            try:
                await connection.send_text(payload)
            except Exception:
                dead_connections.add(connection)
        for dead in dead_connections:
            self.rooms[match_id].discard(dead)

match_live_hub = MatchLiveHub()
