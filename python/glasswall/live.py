"""Live runs started from the dashboard, with free-tier protection.

One run at a time (free LLM quotas are small), a per-visitor hourly limit and
a global daily cap. Runs execute in the background; the dashboard follows them
on /ws/telemetry by run_id and fetches the summary from /api/runs/{run_id}.
"""
import asyncio
import json
import os
import time
import uuid
from collections import defaultdict, deque
from dataclasses import asdict

from .config import ROOT
from .prompts import MODES, MOUNT_FOR_MODE
from .runner import run_agent
from .telemetry import TelemetryBus

PER_IP_PER_HOUR = int(os.environ.get("LIVE_RUNS_PER_IP_HOUR", "5"))
PER_DAY = int(os.environ.get("LIVE_RUNS_PER_DAY", "200"))
MAX_PROMPT_CHARS = 500

SUITE = json.loads((ROOT / "tests" / "eval_suite.json").read_text(encoding="utf-8"))
CASES = {c["id"]: {"id": c["id"], "kind": "attack", "title": c["title"], "family": c["family"], "prompt": c["prompt"]}
         for c in SUITE["attacks"]}
CASES |= {c["id"]: {"id": c["id"], "kind": "normal", "title": c["question"], "family": "normal", "prompt": c["question"]}
          for c in SUITE["normals"]}


class LiveError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


class _ApiBackend:
    """Adapter so run_agent can use the API's own MCP servers and telemetry bus."""

    def __init__(self, servers: dict, bus: TelemetryBus):
        self.servers, self.bus = servers, bus

    def target(self, mode: str):
        mount = MOUNT_FOR_MODE[mode]
        if mount not in self.servers:
            raise LiveError(403, "the no-wall baseline is disabled on this deployment")
        return self.servers[mount]


class LiveRunner:
    def __init__(self, servers: dict, bus: TelemetryBus, allowed_models: list[str]):
        self.backend = _ApiBackend(servers, bus)
        self.allowed_models = allowed_models
        self.runs: dict[str, dict] = {}
        self._active: str | None = None   # set synchronously in start(), so double clicks can't race
        self._per_ip: dict[str, deque] = defaultdict(deque)
        self._day: deque = deque()

    def _check_quota(self, ip: str) -> None:
        now = time.time()
        q = self._per_ip[ip]
        while q and now - q[0] > 3600:
            q.popleft()
        while self._day and now - self._day[0] > 86400:
            self._day.popleft()
        if len(q) >= PER_IP_PER_HOUR:
            raise LiveError(429, f"limit of {PER_IP_PER_HOUR} live runs per hour reached; try Replay mode")
        if len(self._day) >= PER_DAY:
            raise LiveError(429, "today's live-run budget is used up; Replay mode shows the recorded results")
        q.append(now)
        self._day.append(now)

    def start(self, ip: str, mode: str, model: str, case_id: str | None, prompt: str | None) -> dict:
        if mode not in MODES:
            raise LiveError(400, f"mode must be one of {', '.join(MODES)}")
        if model not in self.allowed_models:
            raise LiveError(400, "unknown or unavailable model")
        if case_id:
            if case_id not in CASES:
                raise LiveError(400, "unknown case")
            prompt = CASES[case_id]["prompt"]
        prompt = (prompt or "").strip()
        if not prompt or len(prompt) > MAX_PROMPT_CHARS:
            raise LiveError(400, f"prompt must be 1–{MAX_PROMPT_CHARS} characters")
        if self._active:
            raise LiveError(409, "another live run is in progress; try again in a few seconds")
        self.backend.target(mode)  # fails fast if the open mount is disabled
        self._check_quota(ip)

        run_id = f"live_{uuid.uuid4().hex[:8]}"
        self._active = run_id
        self.runs[run_id] = {"run_id": run_id, "status": "running", "mode": mode, "model": model,
                             "case_id": case_id, "prompt": prompt}
        asyncio.create_task(self._run(run_id, prompt, mode, model))
        return self.runs[run_id]

    async def _run(self, run_id: str, prompt: str, mode: str, model: str) -> None:
        try:
            result = await run_agent(self.backend, prompt, mode=mode, model=model, run_id=run_id)
        finally:
            self._active = None
        summary = asdict(result)
        summary["tool_calls"] = [{"name": c["name"], "arguments": c["arguments"]} for c in summary["tool_calls"]]
        self.runs[run_id] |= {"status": "error" if result.error else "done", **summary}
