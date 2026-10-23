"""Cheap, pattern-based PII detection for live telemetry.

This never sees real values, so it can't confirm a leak; it only flags
email- or phone-shaped text. The exact verdict comes from the scorer, which
runs with the admin connection (SPEC §4.4).
"""
import re

from .tokens import TOKEN_RE

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
# 10+ digits, allowing one separator between digits (spaces, dashes, dots, parens)
PHONE_RE = re.compile(r"(?<!\d)\d(?:[\s\-.()]?\d){9,}(?!\d)")


def count_pii_patterns(text: str) -> int:
    return len(EMAIL_RE.findall(text)) + len(PHONE_RE.findall(text))


def count_tokens(text: str) -> int:
    return len(TOKEN_RE.findall(text))
