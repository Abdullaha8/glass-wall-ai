"""Cheap, pattern-based PII detection for live telemetry.

This never sees real values, so it can't confirm a leak; it only flags
email- or phone-shaped text. The exact verdict comes from the scorer, which
runs with the admin connection (SPEC §4.4).
"""
import re

from .tokens import TOKEN_RE

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# 10+ digits on one line, allowing up to two separators between digits (space, dash, dot, parens).
# Never starts inside a word (e.g. the hex digits of tok_52127245) and never spans lines,
# so a token at the end of one list line plus the next line's number is not a phone.
PHONE_RE = re.compile(r"(?<![\w])\d(?:[ \-.()]{0,2}\d){9,}(?![\d])")


def count_pii_patterns(text: str) -> int:
    return len(EMAIL_RE.findall(text)) + len(PHONE_RE.findall(text))


def count_tokens(text: str) -> int:
    return len(TOKEN_RE.findall(text))
