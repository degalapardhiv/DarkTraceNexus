import asyncio
import json
import time
from typing import AsyncGenerator


class SSEBroadcaster:
    """Server-Sent Events broadcaster for real-time dashboard updates.

    NOTE: This is an in-memory broadcaster. It works correctly with a single
    uvicorn/gunicorn worker. With multiple workers, each worker has its own
    broadcaster instance, so clients may miss events from other workers.
    For multi-worker deployments, consider Redis pub/sub as a message bus.
    """

    def __init__(self):
        self._clients: list[asyncio.Queue] = []
        self._lock = asyncio.Lock()

    async def subscribe(self) -> AsyncGenerator[dict, None]:
        queue: asyncio.Queue = asyncio.Queue()
        async with self._lock:
            self._clients.append(queue)
        try:
            yield {"event": "heartbeat", "data": json.dumps({"ts": time.time(), "connected": True})}
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield event
                except asyncio.TimeoutError:
                    yield {"event": "heartbeat", "data": json.dumps({"ts": time.time()})}
        finally:
            async with self._lock:
                self._clients.remove(queue)

    async def broadcast(self, event_type: str, data: dict):
        message = {"event": event_type, "data": json.dumps(data)}
        async with self._lock:
            stale = []
            for queue in self._clients:
                try:
                    queue.put_nowait(message)
                except asyncio.QueueFull:
                    stale.append(queue)
            for q in stale:
                self._clients.remove(q)

    @property
    def client_count(self) -> int:
        return len(self._clients)


sse_broadcaster = SSEBroadcaster()
