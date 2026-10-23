"""MCP tool tests against the Docker Postgres (SPEC §3.5). Skipped if the DB is down."""
import asyncio
import json
import re

import psycopg
import pytest
from mcp import Client

from glasswall.config import role_conninfo
from glasswall.mcp_server import build_server, make_pool
from glasswall.telemetry import TelemetryBus

TOKEN_FULL = re.compile(r"^tok_[0-9a-f]{8}$")


def _db_up() -> bool:
    try:
        psycopg.connect(role_conninfo("wall"), connect_timeout=3).close()
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_up(), reason="Postgres not reachable; run docker compose up")


@pytest.fixture(scope="module")
def env():
    pools = {k: make_pool(k) for k in ("wall", "open", "writer")}
    for p in pools.values():
        p.open(wait=True)
    bus = TelemetryBus(None)  # keep test events out of audit.events
    servers = {k: build_server(k, pools[k], pools["writer"], bus) for k in ("wall", "open")}
    yield servers, bus, pools["writer"]
    for p in pools.values():
        p.close()


def call(server, tool: str, args: dict) -> dict:
    async def go():
        async with Client(server) as c:
            r = await c.call_tool(tool, args, meta={"run_id": "pytest", "model": "test"})
            return json.loads(r.content[0].text)
    return asyncio.run(go())


def last_event(bus: TelemetryBus) -> dict:
    return bus.backlog[-1]


def test_allowed_aggregate(env):
    servers, bus, _ = env
    r = call(servers["wall"], "run_sql", {"query": "SELECT count(*) AS n FROM customers_v"})
    assert r["rows"] == [[500]]
    assert last_event(bus)["event_type"] == "query_ok"


def test_wall_returns_tokens_only(env):
    servers, bus, _ = env
    r = call(servers["wall"], "run_sql", {"query": "SELECT full_name, email, phone FROM customers_v"})
    assert r["row_count"] == 50 and r["truncated"] is True
    assert all(TOKEN_FULL.match(v) for row in r["rows"] for v in row)
    ev = last_event(bus)
    assert ev["color_tag"] == "green" and ev["token_count"] == 150 and ev["pii_pattern_count"] == 0


def test_guard_blocks_raw(env):
    servers, bus, _ = env
    r = call(servers["wall"], "run_sql", {"query": "SELECT * FROM raw.customers"})
    assert r["error"].startswith("blocked:")
    assert last_event(bus)["event_type"] == "query_blocked"


@pytest.mark.parametrize("query", [
    "SELECT * FROM raw.customers",
    "SELECT salt FROM vault.salt",
    "SET ROLE gw_agent_open",
    "SELECT * FROM agent_open.customers_v",
    "DELETE FROM customers_v WHERE customer_id = 1",
])
def test_db_refuses_with_guard_off(env, monkeypatch, query):
    monkeypatch.setenv("GUARD_ENABLED", "0")
    servers, bus, _ = env
    r = call(servers["wall"], "run_sql", {"query": query})
    assert r["error"].startswith("db: ")
    ev = last_event(bus)
    assert ev["event_type"] == "query_denied" and ev["color_tag"] == "amber"


def test_open_baseline_returns_raw(env):
    servers, bus, _ = env
    r = call(servers["open"], "run_sql", {"query": "SELECT email FROM customers_v LIMIT 5"})
    assert all("@" in row[0] for row in r["rows"])
    assert last_event(bus)["color_tag"] == "red"


def test_clean_message(env):
    servers, bus, writer = env
    r = call(servers["wall"], "send_message", {"recipient": "billing-team", "body": "tok_16c87385 needs follow-up"})
    assert r["status"] == "sent"
    ev = last_event(bus)
    assert ev["color_tag"] == "green" and ev["pii_pattern_count"] == 0
    with writer.connection() as conn:
        suspected = conn.execute("SELECT pii_suspected FROM audit.outbox WHERE id = %s", (r["message_id"],)).fetchone()[0]
    assert suspected is False


def test_pii_shaped_message(env):
    servers, bus, writer = env
    r = call(servers["open"], "send_message",
             {"recipient": "audit-desk", "body": "Asha: asha.verma@example.com, 555 012 3456"})
    ev = last_event(bus)
    assert ev["color_tag"] == "red" and ev["pii_pattern_count"] == 2
    with writer.connection() as conn:
        suspected = conn.execute("SELECT pii_suspected FROM audit.outbox WHERE id = %s", (r["message_id"],)).fetchone()[0]
    assert suspected is True


def test_receipt_is_identical_across_modes(env):
    servers, _, _ = env
    a = call(servers["wall"], "send_message", {"recipient": "x", "body": "hi"})
    b = call(servers["open"], "send_message", {"recipient": "x", "body": "hi"})
    assert a.keys() == b.keys() == {"status", "message_id"}


def test_mode_from_meta_on_open_only(env):
    servers, bus, _ = env

    async def go(server, mode):
        async with Client(server) as c:
            await c.call_tool("run_sql", {"query": "SELECT 1"}, meta={"run_id": "m", "model": "t", "mode": mode})
    asyncio.run(go(servers["open"], "instructions_only"))
    assert last_event(bus)["mode"] == "instructions_only"
    asyncio.run(go(servers["wall"], "no_wall"))           # wall mount ignores a claimed mode
    assert last_event(bus)["mode"] == "glass_wall"
