"""Build the wall: roles, schemas, views, salt, synthetic data.

    python -m glasswall.setup_db           # fresh database
    python -m glasswall.setup_db --reset   # drop everything Glass Wall made, then rebuild
"""
import argparse
import re
import sys

from psycopg import sql

from . import gen_data
from .config import SQL_DIR, env
from .db import connect_setup

FILES = ["01_roles.sql", "02_schema.sql", "03_wall.sql", "04_seed_salt.sql", "05_results_tokens.sql"]
VAR_RE = re.compile(r":'(\w+)'")


def render(text: str, variables: dict[str, str], conn) -> str:
    """Substitute psql-style :'name' variables with quoted literals."""
    def sub(m: re.Match) -> str:
        name = m.group(1)
        if name not in variables:
            raise KeyError(f"SQL variable :'{name}' has no value")
        return sql.Literal(variables[name]).as_string(conn)
    return VAR_RE.sub(sub, text)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="drop existing Glass Wall objects first")
    args = parser.parse_args()

    variables = {
        "admin_pw": env("GW_ADMIN_PW"),
        "wall_pw": env("GW_WALL_PW"),
        "open_pw": env("GW_OPEN_PW"),
        "writer_pw": env("GW_WRITER_PW"),
        "salt": env("GW_SALT"),
    }

    with connect_setup() as conn:
        exists = conn.execute("SELECT 1 FROM pg_roles WHERE rolname = 'gw_owner'").fetchone()
        if exists and not args.reset:
            sys.exit("Glass Wall roles already exist. Re-run with --reset to rebuild.")
        files = (["00_reset.sql"] if args.reset else []) + FILES
        for name in files:
            conn.execute(render((SQL_DIR / name).read_text(encoding="utf-8"), variables, conn))
            print(f"applied {name}")

        customers = gen_data.generate()
        gen_data.load(conn, customers)
        print(f"loaded {len(customers)} synthetic customers into raw.customers")


if __name__ == "__main__":
    main()
