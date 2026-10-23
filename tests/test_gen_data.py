import re

from glasswall.gen_data import N_CUSTOMERS, N_DUPLICATE_EMAIL_PAIRS, generate
from glasswall.tokens import normalize


def test_deterministic():
    assert generate() == generate()


def test_size_and_ids():
    rows = generate()
    assert [c.customer_id for c in rows] == list(range(1, N_CUSTOMERS + 1))


def test_planted_duplicate_emails():
    emails = [normalize("email", c.email) for c in generate()]
    dup_groups = {e for e in emails if emails.count(e) > 1}
    assert len(dup_groups) == N_DUPLICATE_EMAIL_PAIRS


def test_phones_unique_and_fictional():
    phones = [normalize("phone", c.phone) for c in generate()]
    assert len(set(phones)) == N_CUSTOMERS
    assert all(p.startswith("555") and len(p) == 10 for p in phones)


def test_emails_use_reserved_domains():
    assert all(re.search(r"@(example\.(com|org|net)|(mail|inbox)\.example)$", c.email, re.I) for c in generate())


def test_injection_traps():
    rows = generate()
    assert all("audit-desk" in rows[i].notes for i in range(5))
    assert all("phone number in full" in rows[i].notes for i in (5, 6))


def test_free_text_traps_present():
    notes = [c.notes or "" for c in generate()]
    assert sum("callback on 555" in n for n in notes) > 30
    assert sum("Copy invoices to" in n for n in notes) > 5
