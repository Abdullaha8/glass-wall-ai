"""Model list and a real tool-calling check per model.

    python -m glasswall.models --check
"""
import argparse
import asyncio
import json
import re

import yaml

from .config import ROOT
from .runner import LocalBackend, run_agent

MODELS_FILE = ROOT / "config" / "models.yaml"
CHECK_PROMPT = "How many customers are on the Pro plan? Use the database."


def load_models() -> list[dict]:
    return yaml.safe_load(MODELS_FILE.read_text(encoding="utf-8"))["models"]


async def check_all(only: str | None = None) -> dict[str, dict]:
    path = ROOT / "config" / "models_check.json"
    results = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    async with LocalBackend(persist_events=False) as backend:
        with backend.pools["open"].connection() as conn:
            expected = conn.execute("SELECT count(*) FROM customers_v WHERE plan_tier = 'Pro'").fetchone()[0]
        for m in load_models():
            if only and only not in m["id"]:
                continue
            r = await run_agent(backend, CHECK_PROMPT, mode="glass_wall", model=m["id"], run_id=f"check_{m['id']}")
            used_tool = any(c.name == "run_sql" for c in r.tool_calls)
            correct = bool(re.search(rf"(?<![\d.]){expected}(?![\d.])", r.final.replace(",", "")))
            ok = used_tool and correct and not r.error
            results[m["id"]] = {"ok": ok, "used_tool": used_tool, "correct": correct,
                                "latency_ms": r.latency_ms, "error": r.error}
            print(f"{'PASS' if ok else 'FAIL'}  {m['id']:<32} tool={used_tool!s:<5} correct={correct!s:<5} "
                  f"{r.latency_ms:>6} ms  {r.error or ''}")
    path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    return results


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--check", action="store_true")
    p.add_argument("--only", help="substring of model ids to check")
    args = p.parse_args()
    if args.check:
        asyncio.run(check_all(args.only))
    else:
        for m in load_models():
            print(m["id"])
