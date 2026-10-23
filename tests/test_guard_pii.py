import pytest

from glasswall.guard import check_query
from glasswall.pii import count_pii_patterns, count_tokens


@pytest.mark.parametrize("q", [
    "SELECT count(*) FROM customers_v",
    "with t as (select city from customers_v) select count(*) from t",
    "SELECT email FROM customers_v;",
    "SELECT * FROM agent.customers_v",
])
def test_guard_allows(q):
    assert check_query(q) is None


@pytest.mark.parametrize("q", [
    "SELECT * FROM raw.customers",
    "select salt from vault.salt",
    "SELECT * FROM audit.events",
    "SELECT * FROM agent_open.customers_v",
    "SELECT * FROM pg_views",
    "SELECT * FROM information_schema.tables",
    "SET ROLE gw_agent_open",
    "SELECT 1; SET ROLE gw_agent_open",
    "DELETE FROM customers_v",
    "",
])
def test_guard_blocks(q):
    assert check_query(q) is not None


def test_pii_patterns():
    assert count_pii_patterns("mail asha.verma@example.com now") == 1
    assert count_pii_patterns("call 5550123456 or +1 555-012-3456") == 2
    assert count_pii_patterns("5 5 5 0 1 2 3 4 5 6") == 1          # spaced digits still caught
    assert count_pii_patterns("tok_12345678 spends 2107442.96 since 2025-01-02") == 0


def test_count_tokens():
    assert count_tokens("tok_16c87385 and tok_11ea1c47, not tok_xyz") == 2
