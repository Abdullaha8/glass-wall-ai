"""Create or update the backend on Render's FREE plan, with secrets from .env.

    python deploy/render_deploy.py create
    python deploy/render_deploy.py set-env CORS_ORIGINS=https://x.vercel.app   # updates + redeploys

Never prints secret values. Refuses to continue if Render reports any plan but free.
"""
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
API = "https://api.render.com/v1"
NAME = "glass-wall-ai"
REPO = "https://github.com/Abdullaha8/glass-wall-ai"
H = {"Authorization": f"Bearer {os.environ['RENDER_API_KEY']}", "Accept": "application/json"}


def neon_direct_host() -> str:
    url = os.environ["NEON_DATABASE_URL"]
    host = url.split("@", 1)[1].split("/", 1)[0]
    return host.replace("-pooler.", ".")


def env_vars(extra: dict[str, str] | None = None) -> list[dict]:
    values = {
        "PYTHON_VERSION": "3.11.9",
        "GW_DB_HOST": neon_direct_host(),
        "GW_DB_PORT": "5432",
        "GW_DB_NAME": "neondb",
        "GW_DB_SSLMODE": "require",
        "GW_WALL_PW": os.environ["GW_WALL_PW"],
        "GW_OPEN_PW": os.environ["GW_OPEN_PW"],
        "GW_WRITER_PW": os.environ["GW_WRITER_PW"],
        "GROQ_API_KEY": os.environ["GROQ_API_KEY"],
        "GEMINI_API_KEY": os.environ["GEMINI_API_KEY"],
        "DEMO_OPEN_ENABLED": "1",
        "GUARD_ENABLED": "1",
        "LIVE_RUNS_PER_IP_HOUR": "5",
        "LIVE_RUNS_PER_DAY": "200",
        "CORS_ORIGINS": "http://localhost:5173",
        **(extra or {}),
    }
    return [{"key": k, "value": v} for k, v in values.items()]


def find_service() -> dict | None:
    r = httpx.get(f"{API}/services", params={"name": NAME, "limit": 20}, headers=H, timeout=30)
    r.raise_for_status()
    for item in r.json():
        if item["service"]["name"] == NAME:
            return item["service"]
    return None


def assert_free(svc: dict) -> None:
    plan = svc.get("serviceDetails", {}).get("plan")
    if plan != "free":
        sys.exit(f"STOP: Render reports plan {plan!r}, not 'free'. Suspend it in the dashboard; nothing else done.")


def create() -> None:
    if (svc := find_service()) is not None:
        assert_free(svc)
        print(f"exists: {svc['serviceDetails']['url']} (plan free)")
        return
    owner = httpx.get(f"{API}/owners", headers=H, timeout=30).json()[0]["owner"]["id"]
    body = {
        "type": "web_service", "name": NAME, "ownerId": owner, "repo": REPO, "branch": "main",
        "autoDeployTrigger": "commit", "envVars": env_vars(),
        "serviceDetails": {
            "runtime": "python", "plan": "free", "region": "oregon", "healthCheckPath": "/health",
            "envSpecificDetails": {
                "buildCommand": "pip install -r python/requirements.txt",
                "startCommand": "cd python && uvicorn glasswall.api:app --host 0.0.0.0 --port $PORT",
            },
        },
    }
    r = httpx.post(f"{API}/services", json=body, headers=H, timeout=60)
    if r.status_code >= 300:
        sys.exit(f"create failed: {r.status_code} {r.text[:500]}")
    svc = r.json()["service"]
    assert_free(svc)
    url = svc["serviceDetails"]["url"]
    host = url.removeprefix("https://")
    put_env({"PUBLIC_HOST": host}, svc["id"], redeploy=False)
    print(f"created {NAME} on the free plan: {url}\nfirst build started (a few minutes)")


def put_env(updates: dict[str, str], service_id: str | None = None, redeploy: bool = True) -> None:
    svc_id = service_id or find_service()["id"]
    current = httpx.get(f"{API}/services/{svc_id}/env-vars", params={"limit": 100}, headers=H, timeout=30).json()
    merged = {e["envVar"]["key"]: e["envVar"]["value"] for e in current} | updates
    r = httpx.put(f"{API}/services/{svc_id}/env-vars", headers=H, timeout=30,
                  json=[{"key": k, "value": v} for k, v in merged.items()])
    r.raise_for_status()
    print(f"set {', '.join(updates)}")
    if redeploy:
        httpx.post(f"{API}/services/{svc_id}/deploys", headers=H, json={}, timeout=30).raise_for_status()
        print("redeploy started")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "create":
        create()
    elif cmd == "set-env":
        put_env(dict(a.split("=", 1) for a in sys.argv[2:]))
    elif cmd == "status":
        svc = find_service()
        print(svc and {"url": svc["serviceDetails"]["url"], "plan": svc["serviceDetails"].get("plan"),
                       "suspended": svc.get("suspended")})
    else:
        sys.exit(__doc__)
