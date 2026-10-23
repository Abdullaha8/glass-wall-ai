"""Telemetry events (SPEC §3.4) and the bus that fans them out.

Each event is stored in audit.events (as gw_writer), kept in a short
in-memory backlog for new dashboard clients, pushed to every WebSocket
subscriber, and POSTed to WEBHOOK_URL when critical.
"""
import asyncio
import datetime as dt
import hashlib
import json
import logging
import os
from collections import deque
from typing import Any

import httpx
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

log = logging.getLogger(__name__)

COLOR = {"info": "blue", "ok": "green", "warn": "amber", "critical": "red"}
BACKLOG_SIZE = 300


def query_hash(query: str | None) -> str | None:
    return hashlib.sha256(query.encode("utf-8")).hexdigest()[:12] if query else None


def make_event(event_type: str, severity: str, detail: str, *, run_id: str, mode: str, model: str,
               role: str | None = None, tool: str | None = None, query: str | None = None,
               row_count: int | None = None, token_count: int = 0, pii_pattern_count: int = 0,
               duration_ms: int = 0, **extra: Any) -> dict:
    return {
        "timestamp": dt.datetime.now(dt.UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "event_type": event_type,
        "agent_id": f"{model}:{mode}:{run_id}",
        "run_id": run_id,
        "mode": mode,
        "model": model,
        "role": role,
        "tool": tool,
        "query_hash": query_hash(query),
        "query": query,
        "row_count": row_count,
        "token_count": token_count,
        "pii_pattern_count": pii_pattern_count,
        "duration_ms": duration_ms,
        "severity": severity,
        "color_tag": COLOR[severity],
        "detail": detail,
        **extra,
    }


class TelemetryBus:
    def __init__(self, writer_pool: ConnectionPool | None):
        self._pool = writer_pool
        self._subscribers: set[asyncio.Queue] = set()
        self.backlog: deque[dict] = deque(maxlen=BACKLOG_SIZE)
        self._webhook = os.environ.get("WEBHOOK_URL")

    async def publish(self, event: dict) -> None:
        self.backlog.append(event)
        for q in list(self._subscribers):
            if q.full():
                q.get_nowait()  # slow client: drop its oldest event rather than block the agent
            q.put_nowait(event)
        if self._pool is not None:
            try:
                await asyncio.to_thread(self._persist, event)
            except Exception:  # telemetry must never break a tool call
                log.exception("failed to persist telemetry event")
        if self._webhook and event["severity"] == "critical":
            asyncio.create_task(self._post_webhook(event))

    def _persist(self, event: dict) -> None:
        with self._pool.connection() as conn:
            conn.execute("INSERT INTO audit.events (run_id, event) VALUES (%s, %s)",
                         (event["run_id"], Jsonb(event)))

    async def _post_webhook(self, event: dict) -> None:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                await client.post(self._webhook, content=json.dumps(event),
                                  headers={"content-type": "application/json"})
        except httpx.HTTPError:
            log.warning("webhook POST failed")

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=500)
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subscribers.discard(q)
