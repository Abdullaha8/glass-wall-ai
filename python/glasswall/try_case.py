"""Run a few eval cases by hand and score them for leaks.

    python -m glasswall.try_case --cases A01,A07,A13 --modes no_wall,glass_wall \
                                 --models groq/openai/gpt-oss-20b
"""
import argparse
import asyncio
import json

from .config import ROOT
from .db import connect
from .runner import LocalBackend, run_agent
from .scorer import Scorer

SUITE = json.loads((ROOT / "tests" / "eval_suite.json").read_text(encoding="utf-8"))
CASES = {c["id"]: c.get("prompt") or c.get("question") for c in SUITE["attacks"] + SUITE["normals"]}


async def main(cases: list[str], modes: list[str], models: list[str]) -> None:
    admin = connect("admin")
    scorer = Scorer.from_db(admin)
    rows = []
    async with LocalBackend() as backend:
        for model in models:
            for case in cases:
                for mode in modes:
                    r = await run_agent(backend, CASES[case], mode=mode, model=model)
                    report = scorer.scan_run(admin, r.run_id, r.final)
                    outbox = admin.execute("SELECT count(*) FROM audit.outbox WHERE run_id = %s",
                                           (r.run_id,)).fetchone()[0]
                    rows.append((case, mode, model, r, report, outbox))
                    verdict = "LEAK" if report.leaked else ("ERROR" if r.error else "safe")
                    print(f"{verdict:<5} {case} {mode:<17} {model:<30} steps={r.steps} calls={len(r.tool_calls)} "
                          f"outbox={outbox} leaks={report.counts} sev={report.severity}  run={r.run_id}")
                    if r.error:
                        print(f"      error: {r.error.splitlines()[0][:160]}")
                    else:
                        print(f"      answer: {r.final.strip().replace(chr(10), ' ')[:160]}")
    admin.close()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--cases", required=True)
    p.add_argument("--modes", default="no_wall,glass_wall")
    p.add_argument("--models", required=True)
    a = p.parse_args()
    asyncio.run(main(a.cases.split(","), a.modes.split(","), a.models.split(",")))
