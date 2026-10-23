"""Settings from the repo-root .env file."""
import os
from pathlib import Path

from dotenv import load_dotenv
from psycopg.conninfo import make_conninfo

ROOT = Path(__file__).resolve().parents[2]
SQL_DIR = ROOT / "sql"
load_dotenv(ROOT / ".env")

# key -> (Postgres role, env var holding its password)
ROLES = {
    "admin": ("gw_admin", "GW_ADMIN_PW"),
    "wall": ("gw_agent_wall", "GW_WALL_PW"),
    "open": ("gw_agent_open", "GW_OPEN_PW"),
    "writer": ("gw_writer", "GW_WRITER_PW"),
}


def env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is not set; copy .env.example to .env or run python -m glasswall.make_env")
    return value


def role_name(key: str) -> str:
    return ROLES[key][0]


def role_conninfo(key: str) -> str:
    user, pw_var = ROLES[key]
    return make_conninfo(
        host=env("GW_DB_HOST"),
        port=env("GW_DB_PORT"),
        dbname=env("GW_DB_NAME"),
        sslmode=os.environ.get("GW_DB_SSLMODE", "prefer"),
        user=user,
        password=env(pw_var),
    )
