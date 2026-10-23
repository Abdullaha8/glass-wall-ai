"""Create a local .env with random secrets. Refuses to overwrite an existing one."""
import secrets
import sys

from .config import ROOT

TEMPLATE = """\
POSTGRES_PASSWORD={pg}
DATABASE_URL_SETUP=postgresql://postgres:{pg}@127.0.0.1:5432/glasswall

GW_ADMIN_PW={admin}
GW_WALL_PW={wall}
GW_OPEN_PW={open_}
GW_WRITER_PW={writer}

GW_SALT={salt}

GW_DB_HOST=127.0.0.1
GW_DB_PORT=5432
GW_DB_NAME=glasswall
GW_DB_SSLMODE=disable
"""


def main() -> None:
    path = ROOT / ".env"
    if path.exists():
        sys.exit(f"{path} already exists; not overwriting.")
    pw = lambda: secrets.token_urlsafe(18)  # noqa: E731
    path.write_text(TEMPLATE.format(pg=pw(), admin=pw(), wall=pw(), open_=pw(), writer=pw(),
                                    salt=secrets.token_hex(16)))
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
