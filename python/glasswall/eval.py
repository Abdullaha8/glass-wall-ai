"""Evaluation harness (SPEC §4.5): models × modes × cases × trials.

    python -m glasswall.eval --batch b1 --models groq/openai/gpt-oss-20b --trials 1
    python -m glasswall.eval --batch b1 --models ... --cases attacks --modes glass_wall

Resumable: a (batch, model, mode, case, trial) already in audit.results is
skipped. Provider outages and quota errors are not recorded as results, so
a later resume retries them; after several in a row the batch stops.
"""
import argparse
import asyncio
import json
import logging
import time

from psycopg.types.json import Jsonb

from .config import ROOT
from .db import connect
from .grading import is_correct, is_refusal
from .prompts import MODES
from .runner import LocalBackend, run_agent
from .scorer import Scorer

SUITE = json.loads((ROOT / "tests" / "eval_suite.json").read_text(encoding="utf-8"))
INFRA_ERRORS = ("RateLimitError", "ServiceUnavailableError", "Timeout", "APIConnectionError",
                "InternalServerError", "APIError", "ConnectError", "ReadTimeout")
MAX_CONSECUTIVE_INFRA = 4

log = logging.getLogger("glasswall.eval")


def select_cases(spec: str) -> list[dict]:
    attacks = [{**c, "kind": "attack", "text": c["prompt"]} for c in SUITE["attacks"]]
    normals = [{**c, "kind": "normal", "text": c["question"]} for c in SUITE["normals"]]
    if spec == "all":
        return attacks + normals
    if spec in ("attacks", "normals"):
        return attacks if spec == "attacks" else normals
    wanted = set(spec.split(","))
    return [c for c in attacks + normals if c["id"] in wanted]


def is_infra(error: str | None) -> bool:
    return bool(error) and error.split(":", 1)[0].strip() in INFRA_ERRORS


async def main(batch: str, models: list[str], modes: list[str], case_spec: str, trials: int, pause: float) -> None:
    admin, writer = connect("admin"), connect("writer")
    scorer = Scorer.from_db(admin)
    cases = select_cases(case_spec)
    truth = {c["id"]: admin.execute(c["truth_sql"]).fetchone()[0] for c in cases if c["kind"] == "normal"}
    done = {tuple(r) for r in admin.execute(
        "SELECT model, mode, case_id, trial FROM audit.results WHERE batch_id = %s", (batch,))}

    plan = [(m, mode, c, t) for m in models for t in range(1, trials + 1) for c in cases for mode in modes
            if (m, mode, c["id"], t) not in done]
    print(f"batch {batch}: {len(plan)} runs to do ({len(done)} already recorded)")

    stats = {"ok": 0, "leak": 0, "error": 0, "infra": 0}
    consecutive_infra = 0
    started = time.time()
    async with LocalBackend() as backend:
        for i, (model, mode, case, trial) in enumerate(plan, 1):
            r = await run_agent(backend, case["text"], mode=mode, model=model)
            if is_infra(r.error):
                stats["infra"] += 1
                consecutive_infra += 1
                print(f"[{i}/{len(plan)}] INFRA  {model} {mode} {case['id']} t{trial}: {r.error[:120]}")
                if consecutive_infra >= MAX_CONSECUTIVE_INFRA:
                    print(f"stopping: {consecutive_infra} provider errors in a row (quota or outage). Resume later.")
                    break
                await asyncio.sleep(30)
                continue
            consecutive_infra = 0

            report = scorer.scan_run(admin, r.run_id, r.final)
            correct = is_correct(r.final, truth[case["id"]], case["answer_type"]) if case["kind"] == "normal" else None
            writer.execute(
                "INSERT INTO audit.results (run_id, batch_id, case_id, kind, mode, model, trial, leaked, leak_counts, "
                "severity, correct, refused, steps, tool_calls, latency_ms, error, tokens_in, tokens_out) "
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (r.run_id, batch, case["id"], case["kind"], mode, model, trial, report.leaked, Jsonb(report.counts),
                 report.severity, correct, is_refusal(r.final), r.steps, len(r.tool_calls), r.latency_ms,
                 r.error, r.tokens_in, r.tokens_out))

            stats["leak" if report.leaked else "error" if r.error else "ok"] += 1
            tag = "LEAK " if report.leaked else "error" if r.error else "ok   "
            extra = f" correct={correct}" if correct is not None else f" sev={report.severity}"
            print(f"[{i}/{len(plan)}] {tag} {model.split('/')[-1]:<18} {mode:<17} {case['id']} t{trial}"
                  f"{extra} tok={r.tokens_in + r.tokens_out} {r.latency_ms}ms")
            await asyncio.sleep(pause)

    mins = (time.time() - started) / 60
    print(f"\ndone in {mins:.1f} min: {stats}")
    admin.close()
    writer.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.WARNING, format="%(message)s")
    p = argparse.ArgumentParser()
    p.add_argument("--batch", required=True)
    p.add_argument("--models", required=True, help="comma-separated LiteLLM ids")
    p.add_argument("--modes", default=",".join(MODES))
    p.add_argument("--cases", default="all", help="all | attacks | normals | A01,N05,...")
    p.add_argument("--trials", type=int, default=1)
    p.add_argument("--pause", type=float, default=2.0, help="seconds between runs (free-tier pacing)")
    a = p.parse_args()
    asyncio.run(main(a.batch, a.models.split(","), a.modes.split(","), a.cases, a.trials, a.pause))
