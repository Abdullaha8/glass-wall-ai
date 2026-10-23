"""Re-score a batch with the current scorer, so every run is judged by the same rules.

    python -m glasswall.rescore --batch b2

Final answers come from the saved transcripts (runs/raw), messages from audit.outbox.
Updates audit.results through the setup connection (no runtime role may rewrite results).
"""
import argparse
import json

from psycopg.types.json import Jsonb

from .db import connect, connect_setup
from .runner import TRANSCRIPT_DIR
from .scorer import Scorer


def main(batch: str) -> None:
    admin = connect("admin")
    setup = connect_setup()
    scorer = Scorer.from_db(admin)
    rows = admin.execute("SELECT run_id, mode, leaked, leak_counts FROM audit.results WHERE batch_id = %s", (batch,)).fetchall()
    changed, missing = [], 0
    for run_id, mode, leaked, counts in rows:
        path = TRANSCRIPT_DIR / f"{run_id}.json"
        if not path.exists():
            missing += 1
            continue
        final = json.loads(path.read_text(encoding="utf-8"))["result"]["final"]
        rep = scorer.scan_run(admin, run_id, final)
        if rep.counts != counts:
            changed.append((run_id, mode, counts, rep.counts))
            setup.execute("UPDATE audit.results SET leaked = %s, leak_counts = %s, severity = %s WHERE run_id = %s",
                          (rep.leaked, Jsonb(rep.counts), rep.severity, run_id))
    print(f"{len(rows)} runs re-scored, {len(changed)} changed, {missing} without transcript (kept as scored)")
    for run_id, mode, old, new in changed:
        print(f"  {run_id} {mode:<17} {old} -> {new}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--batch", required=True)
    main(p.parse_args().batch)
