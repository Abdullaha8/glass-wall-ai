# Glass Wall AI

A zero-trust boundary between LLM agents and a relational database. Agents query personal data through an MCP server, but names, emails and phone numbers reach them only as stable tokens (`tok_8f3a1c2d`). The real values never leave the RAW schema.

Built for Syntax Error 2026. Work in progress. The design is in [`docs/SPEC.md`](docs/SPEC.md).

## Quick start (local)

Needs Python 3.11+ and Docker.

```bash
python -m venv .venv
.venv/Scripts/pip install -r python/requirements.txt    # macOS/Linux: .venv/bin/pip

cd python
../.venv/Scripts/python -m glasswall.make_env           # writes ../.env with random secrets
cd .. && docker compose up -d --wait && cd python        # Postgres 17 on 127.0.0.1:5432

../.venv/Scripts/python -m glasswall.setup_db            # roles, schemas, wall views, 500 synthetic rows
../.venv/Scripts/python -m glasswall.self_check          # proves the wall holds at the DB layer
```

To rebuild from scratch, run `python -m glasswall.setup_db --reset`. Unit tests run with `pytest tests` from the repo root.

All data is synthetic. Emails use reserved `example.*` domains, and phone numbers are in the fictional 555 range.
