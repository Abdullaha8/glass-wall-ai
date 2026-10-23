"""End-to-end smoke test against a running backend, over real HTTP and WebSocket.

    python -m glasswall.smoke --base-url http://127.0.0.1:8000
"""
import argparse
import asyncio
import json

import httpx
import websockets
from mcp import Client


async def main(base: str) -> None:
    async with httpx.AsyncClient(timeout=60) as http:
        health = (await http.get(f"{base}/health")).json()
    print("health:", health)

    ws_url = base.replace("http", "ws", 1) + "/ws/telemetry"
    events: list[dict] = []

    async def listen(ws):
        async for msg in ws:
            events.append(json.loads(msg))

    async with websockets.connect(ws_url) as ws:
        listener = asyncio.create_task(listen(ws))
        meta = {"run_id": "smoke", "model": "smoke-test"}

        async with Client(f"{base}/mcp/wall") as c:
            names = sorted(t.name for t in (await c.list_tools()).tools)
            print("wall tools:", names)
            r = await c.call_tool("run_sql", {"query": "SELECT customer_id, email FROM customers_v LIMIT 2"}, meta=meta)
            print("wall run_sql:", r.content[0].text.replace("\n", " ")[:160])
            r = await c.call_tool("run_sql", {"query": "SELECT * FROM raw.customers"}, meta=meta)
            print("wall raw attempt:", r.content[0].text.replace("\n", " "))

        if "open" in health["mounts"]:
            async with Client(f"{base}/mcp/open") as c:
                r = await c.call_tool("run_sql", {"query": "SELECT customer_id, email FROM customers_v LIMIT 2"}, meta=meta)
                print("open run_sql:", r.content[0].text.replace("\n", " ")[:160])

        await asyncio.sleep(1)
        listener.cancel()

    smoke = [e for e in events if e["run_id"] == "smoke"]
    print(f"\nWebSocket received {len(smoke)} smoke events:")
    for e in smoke[-4:]:
        print(f"  {e['color_tag']:<6} {e['mode']:<11} {e['event_type']:<14} {e['detail']}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--base-url", default="http://127.0.0.1:8000")
    asyncio.run(main(p.parse_args().base_url.rstrip("/")))
