import asyncio
import contextlib
import time
import uuid

import redis.asyncio as aioredis
from fastapi import HTTPException, status

from app.config import settings


class RateLimiter:
    """
    Enterprise Redis-backed Rate Limiter with Tenant & Key Isolation.

    Provides:
    - Independent counters per tenant and consumer identifier (API key / user).
    - Standard rate limit response headers (Retry-After, X-RateLimit-*).
    - Configurable fail-closed vs fail-open behavior when Redis connectivity fails.
    """

    _redis: aioredis.Redis | None = None
    _loop: asyncio.AbstractEventLoop | None = None

    @classmethod
    async def get_redis(cls) -> aioredis.Redis:
        current_loop = asyncio.get_running_loop()
        if cls._redis is None or cls._loop is not current_loop:
            if cls._redis is not None:
                with contextlib.suppress(Exception):
                    await cls._redis.aclose()
            cls._loop = current_loop
            cls._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                encoding="utf-8",
                socket_timeout=2.0,
                socket_connect_timeout=2.0,
            )
        return cls._redis

    @classmethod
    async def check_rate_limit(
        cls,
        tenant_id: uuid.UUID,
        identifier: str,
        limit: int = 60,
        window_seconds: int = 60,
        fail_closed: bool = True,
    ) -> dict[str, str]:
        """
        Enforces rate limits using a fixed/sliding window on Redis.

        Raises HTTPException(429) if request threshold is breached.
        """
        now = time.time()
        window_bucket = int(now // window_seconds)
        rate_key = f"rate_limit:{tenant_id}:{identifier}:{window_bucket}"
        reset_seconds = max(1, window_seconds - int(now % window_seconds))

        try:
            r = await cls.get_redis()
            pipe = r.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, window_seconds + 5)
            results = await pipe.execute()
            current_count = int(results[0])
        except Exception as exc:
            if fail_closed:
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Control de tráfico temporalmente no disponible (Fail-Closed). Intente más tarde.",
                ) from exc
            # Fail-open for non-sensitive public endpoints
            return {
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": str(limit),
                "X-RateLimit-Reset": str(reset_seconds),
            }

        remaining = max(0, limit - current_count)
        headers = {
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(reset_seconds),
        }

        if current_count > limit:
            headers["Retry-After"] = str(reset_seconds)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Límite de peticiones excedido ({limit} req/{window_seconds}s). Reintente en {reset_seconds} segundos.",
                headers=headers,
            )

        return headers
