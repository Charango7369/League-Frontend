import json
from typing import Any

import redis.asyncio as aioredis

from app.config import settings


class RedisService:
    def __init__(self):
        self.client: aioredis.Redis | None = None

    async def init(self):
        try:
            self.client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                encoding="utf-8"
            )
        except Exception as e:
            print(f"[REDIS WARN] Failed to connect to Redis: {e}")
            self.client = None

    async def get(self, key: str) -> Any | None:
        if not self.client:
            return None
        try:
            val = await self.client.get(key)
            if val:
                return json.loads(val)
        except Exception:
            return None
        return None

    async def set(self, key: str, value: Any, expire_seconds: int = 300):
        if not self.client:
            return
        try:
            await self.client.set(key, json.dumps(value), ex=expire_seconds)
        except Exception:
            pass

    async def publish(self, channel: str, message: Any):
        if not self.client:
            return
        try:
            payload = json.dumps(message) if not isinstance(message, str) else message
            await self.client.publish(channel, payload)
        except Exception:
            pass

    async def close(self):
        if self.client:
            await self.client.close()

redis_service = RedisService()
