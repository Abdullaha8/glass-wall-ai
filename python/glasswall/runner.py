"""The agent: a LiteLLM tool-calling loop that talks to the wall through MCP.

The runner is a real MCP client. It lists the server's tools, hands them to
the model in OpenAI function format, and executes each tool call through
MCP with run metadata in _meta (which the model never sees).

    async with LocalBackend() as backend:            # in-process MCP servers + DB pools
        result = await run_agent(backend, "Summarize notes for customers 1-20",
                                 mode="no_wall", model="groq/openai/gpt-oss-20b")
"""
import asyncio
import contextlib
import json
import logging
import time
import uuid
from dataclasses import asdict, dataclass, field
from typing import Any

import litellm
from mcp import Client

from .config import ROOT
from .mcp_server import build_server, make_pool
from .prompts import MOUNT_FOR_MODE, system_prompt
from .telemetry import TelemetryBus, make_event

MAX_STEPS = 8
MODEL_TIMEOUT_S = 90
RATE_LIMIT_RETRIES = 4
TRANSCRIPT_DIR = ROOT / "runs" / "raw"   # gitignored: transcripts hold synthetic PII

litellm.drop_params = True
litellm.suppress_debug_info = True
logging.getLogger("LiteLLM").setLevel(logging.WARNING)
log = logging.getLogger(__name__)


@dataclass
class ToolCall:
    name: str
    arguments: dict
    result: str


@dataclass
class RunResult:
    run_id: str
    model: str
    mode: str
    prompt: str
    final: str = ""
    steps: int = 0
    tool_calls: list[ToolCall] = field(default_factory=list)
    latency_ms: int = 0
    error: str | None = None
    hit_step_limit: bool = False


class LocalBackend:
    """In-process MCP servers for both mounts, sharing one telemetry bus."""

    def __init__(self, persist_events: bool = True):
        self._persist = persist_events

    async def __aenter__(self) -> "LocalBackend":
        self.pools = {k: make_pool(k) for k in ("wall", "open", "writer")}
        for p in self.pools.values():
            p.open(wait=True, timeout=30)
        self.bus = TelemetryBus(self.pools["writer"] if self._persist else None)
        self.servers = {k: build_server(k, self.pools[k], self.pools["writer"], self.bus) for k in ("wall", "open")}
        return self

    async def __aexit__(self, *exc) -> None:
        for p in self.pools.values():
            p.close()

    def target(self, mode: str):
        return self.servers[MOUNT_FOR_MODE[mode]]


def _to_openai_tools(mcp_tools) -> list[dict]:
    return [{"type": "function",
             "function": {"name": t.name, "description": t.description or "", "parameters": t.input_schema}}
            for t in mcp_tools]


async def _complete(model: str, messages: list[dict], tools: list[dict]):
    bad_tool_json_retries = 1
    for attempt in range(RATE_LIMIT_RETRIES + 1):
        try:
            return await litellm.acompletion(model=model, messages=messages, tools=tools,
                                             tool_choice="auto", timeout=MODEL_TIMEOUT_S)
        except litellm.BadRequestError as e:
            # The provider rejected malformed tool-call JSON from the model; it's sampling noise, retry once.
            if "Failed to parse tool call" in str(e) and bad_tool_json_retries:
                bad_tool_json_retries -= 1
                log.warning("%s produced malformed tool-call JSON; retrying once", model)
                continue
            raise
        except litellm.RateLimitError as e:
            if attempt == RATE_LIMIT_RETRIES or "Request too large" in str(e):  # waiting can't fix this
                raise
            wait = 15 * (attempt + 1)
            log.warning("rate limited by %s; retrying in %ss", model, wait)
            await asyncio.sleep(wait)


async def run_agent(backend: LocalBackend, prompt: str, *, mode: str, model: str,
                    run_id: str | None = None, target: Any = None,
                    bus: TelemetryBus | None = None) -> RunResult:
    """Run one fresh conversation. target overrides the MCP server (e.g. a URL)."""
    run_id = run_id or f"r_{uuid.uuid4().hex[:8]}"
    bus = bus or backend.bus
    result = RunResult(run_id=run_id, model=model, mode=mode, prompt=prompt)
    meta = {"run_id": run_id, "model": model, "mode": mode}
    ev = dict(run_id=run_id, model=model, mode=mode)
    t0 = time.perf_counter()
    await bus.publish(make_event("run_started", "info", f"{mode} · {model} · {prompt[:80]}", **ev))

    messages: list[dict] = [{"role": "system", "content": system_prompt(mode)},
                            {"role": "user", "content": prompt}]
    try:
        async with Client(target or backend.target(mode)) as client:
            tools = _to_openai_tools((await client.list_tools()).tools)
            for step in range(1, MAX_STEPS + 1):
                result.steps = step
                resp = await _complete(model, messages, tools)
                msg = resp.choices[0].message
                calls = msg.tool_calls or []
                messages.append({
                    "role": "assistant",
                    "content": msg.content or "",
                    **({"tool_calls": [{"id": c.id, "type": "function",
                                        "function": {"name": c.function.name,
                                                     "arguments": c.function.arguments or "{}"}}
                                       for c in calls]} if calls else {}),
                })
                if not calls:
                    result.final = msg.content or ""
                    break
                for c in calls:
                    try:
                        args = json.loads(c.function.arguments or "{}")
                    except json.JSONDecodeError:
                        args, text = {}, '{"error": "arguments were not valid JSON"}'
                    else:
                        r = await client.call_tool(c.function.name, args, meta=meta)
                        text = "\n".join(getattr(part, "text", "") for part in r.content)
                    result.tool_calls.append(ToolCall(c.function.name, args, text))
                    messages.append({"role": "tool", "tool_call_id": c.id, "content": text})
            else:
                result.hit_step_limit = True
    except Exception as e:  # recorded, never hidden: errors count against the run
        while isinstance(e, BaseExceptionGroup) and e.exceptions:  # MCP client wraps errors in task groups
            e = e.exceptions[0]
        result.error = f"{type(e).__name__}: {str(e)[:300]}"

    result.latency_ms = int((time.perf_counter() - t0) * 1000)
    severity = "warn" if result.error else "info"
    detail = result.error or f"{result.steps} steps · {len(result.tool_calls)} tool calls · {result.latency_ms} ms"
    await bus.publish(make_event("run_finished", severity, detail, duration_ms=result.latency_ms, **ev))
    _save_transcript(result, messages)
    return result


def _save_transcript(result: RunResult, messages: list[dict]) -> None:
    with contextlib.suppress(OSError):
        TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
        (TRANSCRIPT_DIR / f"{result.run_id}.json").write_text(
            json.dumps({"result": asdict(result), "messages": messages}, indent=2, default=str),
            encoding="utf-8")
