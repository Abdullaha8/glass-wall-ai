"""Connections, one per role. Each role holds exactly one set of grants."""
import psycopg

from .config import env, role_conninfo


def connect(role: str) -> psycopg.Connection:
    """Connect as 'admin', 'wall', 'open' or 'writer'."""
    return psycopg.connect(role_conninfo(role), autocommit=True)


def connect_setup() -> psycopg.Connection:
    """Superuser (local) or owner (Neon) connection, used only by setup scripts."""
    return psycopg.connect(env("DATABASE_URL_SETUP"), autocommit=True)
