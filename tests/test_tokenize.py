from glasswall.tokens import TOKEN_RE, token

SALT = "demo-salt-change-me"


def test_spec_examples():
    # Values published in docs/SPEC.md §2.3
    assert token(SALT, "name", "Asha Verma") == "tok_11ad4a9c"
    assert token(SALT, "email", "asha.verma@example.com") == "tok_16c87385"
    assert token(SALT, "phone", "9876543210") == "tok_11ea1c47"


def test_normalization_gives_same_token():
    assert token(SALT, "email", " Asha.Verma@Example.com ") == token(SALT, "email", "asha.verma@example.com")
    assert token(SALT, "phone", "+1 555 012 3456") == token(SALT, "phone", "555-012-3456")


def test_kind_separates_columns():
    assert token(SALT, "name", "x") != token(SALT, "email", "x")


def test_salt_changes_tokens():
    assert token("a", "email", "x@example.com") != token("b", "email", "x@example.com")


def test_token_shape():
    assert TOKEN_RE.fullmatch(token(SALT, "name", "anyone"))
