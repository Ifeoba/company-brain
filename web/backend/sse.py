"""
SSE pub/sub for in-process real-time events.

Works with FastAPI BackgroundTasks and single-process uvicorn.
For multi-worker scale, replace _channels with Redis pub/sub.
"""
from __future__ import annotations
import asyncio
import json
from typing import Optional, Dict, List


_loop: Optional[asyncio.AbstractEventLoop] = None
_channels: Dict[str, List[asyncio.Queue]] = {}


def set_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def subscribe(workspace_id: str) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _channels.setdefault(workspace_id, []).append(q)
    return q


def unsubscribe(workspace_id: str, q: asyncio.Queue) -> None:
    try:
        _channels.get(workspace_id, []).remove(q)
    except ValueError:
        pass


def publish(workspace_id: str, event: dict) -> None:
    """
    Thread-safe publish. Safe to call from BackgroundTask threads.
    No-op when the event loop isn't running or no subscribers exist.
    """
    if _loop is None or not _loop.is_running():
        return
    queues = list(_channels.get(workspace_id, []))
    for q in queues:
        try:
            _loop.call_soon_threadsafe(q.put_nowait, event)
        except Exception:
            pass
