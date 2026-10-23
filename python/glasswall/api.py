"""FastAPI backend: MCP mounts, live telemetry and health.

    uvicorn glasswall.api:app --port 8000      (run from python/)

Routes
  POST /mcp/wall      MCP (streamable HTTP), tokenized view — the product endpoint
  POST /mcp/open      MCP baseline with raw view; only if DEMO_OPEN_ENABLED=1
  GET  /health        liveness, used by the dashboard to wake a sleeping backend
  GET  /api/events    recent telemetry (polling fallback)
  GET  /api/models    models that passed the tool-calling check
  GET  /api/cases     eval cases the dashboard can launch
  POST /api/run       start a live run (rate-limited; one at a time)
  GET  /api/runs/{id} live run summary
  GET  /api/outbox    recent outbox messages; POST /api/outbox/{id}/review marks them
  WS   /ws/telemetry  backlog, then live events
"""
import asyncio
import contextlib
import json
import os
from typing import Literal

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel

from .config import ROOT
from .live import CASES, LiveError, LiveRunner
from .mcp_server import build_server, make_pool
from .models import load_models
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


def _available_models() -> list[dict]:
    check_file = ROOT / "config" / "models_check.json"
    checked = json.loads(check_file.read_text(encoding="utf-8")) if check_file.exists() else {}
    return [m for m in load_models() if checked.get(m["id"], {}).get("ok")]


live = LiveRunner(servers, bus, [m["id"] for m in _available_models()])
mcp_apps = {key: srv.streamable_http_app(streamable_http_path=f"/mcp/{key}", stateless_http=True,
                                         json_response=True, transport_security=_transport_security())
            for key, srv in servers.items()}


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI):
    for pool in [*pools.values(), writer_pool]:
        pool.open(wait=True, timeout=30)
    await asyncio.to_thread(bus.restore)
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


@app.get("/api/models")
async def models() -> list[dict]:
    return _available_models()


@app.get("/api/cases")
async def cases() -> list[dict]:
    return list(CASES.values())


class RunRequest(BaseModel):
    mode: Literal["no_wall", "instructions_only", "glass_wall"]
    model: str
    case_id: str | None = None
    prompt: str | None = None


@app.post("/api/run")
async def start_run(req: RunRequest, request: Request) -> dict:
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "?").split(",")[0].strip()
    try:
        return live.start(ip, req.mode, req.model, req.case_id, req.prompt)
    except LiveError as e:
        raise HTTPException(e.status, str(e)) from None


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str) -> dict:
    if run_id not in live.runs:
        raise HTTPException(404, "unknown run")
    return live.runs[run_id]


@app.get("/api/outbox")
async def outbox(limit: int = 50) -> list[dict]:
    def fetch() -> list[dict]:
        with writer_pool.connection() as conn:
            cur = conn.execute(
                "SELECT id, ts, run_id, mode, model, recipient, body, token_count, pii_suspected, review "
                "FROM audit.outbox WHERE run_id NOT IN ('pytest', 'smoke') ORDER BY id DESC LIMIT %s",
                (max(1, min(limit, 200)),))
            cols = [d.name for d in cur.description]
            return [dict(zip(cols, r)) | {"ts": r[1].isoformat()} for r in cur.fetchall()]
    return await asyncio.to_thread(fetch)


class Review(BaseModel):
    review: Literal["unreviewed", "confirmed_leak", "false_positive"]


@app.post("/api/outbox/{msg_id}/review")
async def review_outbox(msg_id: int, body: Review) -> dict:
    def update() -> int:
        with writer_pool.connection() as conn:
            return conn.execute("UPDATE audit.outbox SET review = %s WHERE id = %s", (body.review, msg_id)).rowcount
    if not await asyncio.to_thread(update):
        raise HTTPException(404, "unknown message")
    return {"id": msg_id, "review": body.review}
