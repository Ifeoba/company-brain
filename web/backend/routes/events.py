"""
SSE endpoint: GET /api/events

Clients connect once and receive real-time run status updates.
Events are workspace-scoped; only events for the authenticated user's workspace arrive.

Event shape: { "type": "run.started"|"run.completed"|"run.failed", "run_id": "..." }
"""
import asyncio
import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from ..auth import current_user
from ..models import User
from .. import sse as sse_bus

router = APIRouter()


@router.get("/api/events")
async def event_stream(user: User = Depends(current_user)):
    workspace_id = user.id  # v1: user_id == workspace owner id for lookup

    q = sse_bus.subscribe(workspace_id)

    async def generate():
        try:
            while True:
                try:
                    event = await asyncio.wait_for(q.get(), timeout=25)
                    yield "data: {}\n\n".format(json.dumps(event))
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            sse_bus.unsubscribe(workspace_id, q)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
