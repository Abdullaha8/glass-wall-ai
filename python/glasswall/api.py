"""FastAPI backend: MCP mounts, live telemetry and health.

    uvicorn glasswall.api:app --port 8000      (run from python/)

Routes
  POST /mcp/wall      MCP (streamable HTTP), tokenized view — the product endpoint
  POST /mcp/open      MCP baseline with raw view; only if DEMO_OPEN_ENABLED=1
  GET  /health        liveness, used by the dashboard to wake a sleeping backend
  GET  /api/events    recent telemetry (polling fallback)
  WS   /ws/telemetry  backlog, then live events
"""
import asyncio
import contextlib
import os

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from mcp.server.transport_security import TransportSecuritySettings

from .mcp_server import build_server, make_pool
from .telemetry import TelemetryBus

OPEN_ENABLED = os.environ.get("DEMO_OPEN_ENABLED", "1") == "1"


def _transport_security() -> TransportSecuritySettings:
    """Allow localhost always, plus the deployed host (e.g. glass-wall.onrender.com) if set."""
    hosts = ["127.0.0.1:*", "localhost:*", "[::1]:*"]
    origins = ["http://127.0.0.1:*", "http://localhost:*", "http://[::1]:*"]
    if public := os.environ.get("PUBLIC_HOST"):
        hosts += [public, f"{public}:*"]
        origins += [f"https://{public}"]
    return TransportSecuritySettings(allowed_hosts=hosts, allowed_origins=origins)


pools = {key: make_pool(key) for key in (["wall", "open"] if OPEN_ENABLED else ["wall"])}
writer_pool = make_pool("writer")
bus = TelemetryBus(writer_pool)
servers = {key: build_server(key, pools[key], writer_pool, bus) for key in pools}
mcp_apps = {key: srv.streamable_http_app(streamable_http_path=f"/mcp/{key}", stateless_http=True,
                                         json_response=True, transport_security=_transport_security())
            for key, srv in servers.items()}


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    for pool in [*pools.values(), writer_pool]:
        pool.open(wait=True, timeout=30)
    async with contextlib.AsyncExitStack() as stack:
        for srv in servers.values():
            await stack.enter_async_context(srv.session_manager.run())
        yield
    for pool in [*pools.values(), writer_pool]:
        pool.close()


app = FastAPI(title="Glass Wall AI", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",") if o],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
for sub in mcp_apps.values():
    app.router.routes.extend(sub.routes)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "mounts": sorted(servers)}


@app.get("/api/events")
async def recent_events(limit: int = 100) -> list[dict]:
    return list(bus.backlog)[-max(1, min(limit, 300)):]


@app.websocket("/ws/telemetry")
async def telemetry_ws(ws: WebSocket) -> None:
    await ws.accept()
    queue = bus.subscribe()
    try:
        for event in list(bus.backlog):
            await ws.send_json(event)
        while True:
            await ws.send_json(await queue.get())
    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    finally:
        bus.unsubscribe(queue)
