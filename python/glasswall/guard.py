"""Query guard for run_sql: defense in depth and telemetry only.

The real wall is Postgres grants (proved by self_check with no guard).
Set GUARD_ENABLED=0 to switch the guard off; no leak result may change.
"""
import re

FORBIDDEN = re.compile(
    r"\b(raw|vault|audit|agent_open)\s*\.|\bpg_|\binformation_schema\b|\bset\s+(role|session)\b|\breset\s+role\b",
    re.IGNORECASE,
)
STARTS_WITH_SELECT = re.compile(r"^\s*(select|with)\b", re.IGNORECASE)


def check_query(query: str) -> str | None:
    """Return a rejection reason, or None if the query may run."""
    body = query.strip().rstrip(";").strip()
    if not body:
        return "empty query"
    if ";" in body:
        return "only one statement is allowed"
    if not STARTS_WITH_SELECT.match(body):
        return "only SELECT queries are allowed"
    m = FORBIDDEN.search(body)
    if m:
        return f"query references a restricted object ({m.group(0).strip()})"
    return None
