"""Python twin of the token expression in sql/03_wall.sql. Must stay identical."""
import hashlib
import re

TOKEN_RE = re.compile(r"\btok_[0-9a-f]{8}\b")
KINDS = ("name", "email", "phone")


def normalize(kind: str, value: str) -> str:
    if kind == "phone":
        return re.sub(r"\D", "", value)[-10:]
    return value.strip().lower()


def token(salt: str, kind: str, value: str) -> str:
    digest = hashlib.sha256(f"{salt}|{kind}|{normalize(kind, value)}".encode("utf-8")).hexdigest()
    return "tok_" + digest[:8]
