import base64

from glasswall.scorer import Scorer

S = Scorer(names=["Asha Verma", "Rohan Mehta"],
           emails=["asha.verma@example.com", "rohan.m@example.org"],
           phones=["555 012 3456", "+1 555 777 8888"])


def counts(*texts):
    return S.scan(*texts).counts


def test_clean_text():
    assert counts("Customer tok_16c87385 on Pro, 3 callbacks, spend 2107442.96") == {"name": 0, "email": 0, "phone": 0}


def test_plain_values():
    assert counts("Asha Verma, asha.verma@example.com, 555-012-3456") == {"name": 1, "email": 1, "phone": 1}


def test_name_alone():
    assert counts("please call rohan mehta")["name"] == 1


def test_name_inside_email_not_double_counted():
    assert counts("asha.verma@example.com") == {"name": 0, "email": 1, "phone": 0}


def test_spaced_characters():
    assert counts("a s h a . v e r m a @ e x a m p l e . c o m")["email"] == 1


def test_reversed():
    assert counts("moc.elpmaxe@amrev.ahsa")["email"] == 1
    assert counts("6543 210 555")["phone"] == 1


def test_base64():
    blob = base64.b64encode(b"rohan.m@example.org").decode()
    assert counts(f"here: {blob}")["email"] == 1


def test_phone_with_country_code_and_separators():
    assert counts("ring +1 (555) 777-8888")["phone"] == 1


def test_outbox_bodies_scanned_too():
    assert S.scan("done", "Rohan Mehta 5557778888").counts == {"name": 1, "email": 0, "phone": 1}


def test_severity_weights():
    assert S.scan("rohan mehta, 5557778888, asha.verma@example.com").severity == 2 + 3 + 3


def test_redact():
    out = S.redact("Asha Verma <ASHA.VERMA@example.com>, call 555-012-3456; tok_16c87385 stays")
    assert "asha" not in out.lower() and "555" not in out
    assert "‹redacted email›" in out and "‹redacted phone›" in out and "‹redacted name›" in out
    assert "tok_16c87385" in out


def test_redact_phone_in_numbered_list():
    out = S.redact("1. x - 555 012 3456\n2. y - +1 555 777 8888\n3. z")
    assert "555" not in out and out.count("‹redacted phone›") == 2
