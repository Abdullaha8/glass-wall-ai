import time

import pytest

from glasswall.live import LiveError, LiveRunner
from glasswall.runner import rate_limit_info

GEMINI_MINUTE = ("RateLimitError: geminiException - You exceeded your current quota ... Generate content requests "
                 "per minute limit exceeded on Free Tier.\nPlease retry in 3.513093041s.")
GROQ_DAY = ("RateLimitError: GroqException - Rate limit reached for model openai/gpt-oss-120b on tokens per day (TPD): "
            "Limit 200000, Used 199500. Please try again in 7m12.5s.")


def test_rate_limit_classification():
    assert rate_limit_info(GEMINI_MINUTE) == {"daily": False, "retry_s": pytest.approx(3.513, abs=0.01)}
    assert rate_limit_info(GROQ_DAY) == {"daily": True, "retry_s": 432.5}
    assert rate_limit_info("RateLimitError: quota exceeded for requests per day") == {"daily": True, "retry_s": None}
    assert rate_limit_info("BadRequestError: Failed to parse tool call") is None


def runner():
    return LiveRunner(servers={}, bus=None, allowed_models=["a", "b"])


def test_models_start_unknown_then_follow_provider_answers():
    r = runner()
    assert r.status("ip")["models"]["a"]["state"] == "unknown"
    r._note_model("a", None, None)
    assert r.status("ip")["models"]["a"]["state"] == "ready"
    r._note_model("b", rate_limit_info(GROQ_DAY), "RateLimitError")
    b = r.status("ip")["models"]["b"]
    assert b["state"] == "out" and 400 < b["wait_s"] <= 433


def test_cooling_model_recovers_after_the_wait():
    r = runner()
    r._note_model("a", {"daily": False, "retry_s": 30}, "RateLimitError")
    assert r.status("ip")["models"]["a"]["state"] == "cooling"
    r.model_health["a"]["until"] = time.time() - 1
    assert r.status("ip")["models"]["a"]["state"] == "ready"


def test_out_of_quota_model_is_refused_before_spending_a_run():
    r = runner()
    r._note_model("a", {"daily": True, "retry_s": None}, "RateLimitError")
    with pytest.raises(LiveError) as e:
        r.start("ip", "glass_wall", "a", "A07", None)
    assert e.value.status == 429 and "pick another model" in str(e.value)
    assert r.status("ip")["runs_left"] == r.status("ip")["runs_per_hour"]   # the visitor's budget is untouched


def test_availability_refills_as_the_wait_runs_out():
    r = runner()
    assert r.status("ip")["models"]["a"]["available"] == 1.0
    r._note_model("a", {"daily": False, "retry_s": 100}, "RateLimitError")
    assert r.status("ip")["models"]["a"]["available"] < 0.05
    r.model_health["a"]["until"] = time.time() + 25   # three quarters of the wait has passed
    assert 0.7 < r.status("ip")["models"]["a"]["available"] < 0.8


def test_calls_are_counted_per_model_for_24_hours():
    r = runner()
    r._calls["a"].extend([(time.time() - 90000, 9), (time.time() - 60, 3), (time.time(), 2)])
    assert r.status("ip")["models"]["a"]["calls_24h"] == 5
    assert r.status("ip")["models"]["b"]["calls_24h"] == 0


def test_garbled_tool_calls_and_rate_limits_have_separate_retry_budgets(monkeypatch):
    import asyncio

    import litellm

    from glasswall import runner as r
    errors = [litellm.BadRequestError("Failed to parse tool call arguments as JSON", model="m", llm_provider="groq")] * 3 \
        + [litellm.RateLimitError("slow down", model="m", llm_provider="groq")] * 2
    calls = []

    async def fake(**kw):
        calls.append(1)
        if errors:
            raise errors.pop(0)
        return "ok"

    async def no_sleep(_):
        return None

    monkeypatch.setattr(r.litellm, "acompletion", fake)
    monkeypatch.setattr(r.asyncio, "sleep", no_sleep)
    assert asyncio.run(r._complete("m", [], [])) == "ok"   # 3 garbled + 2 rate limits, then success
    assert len(calls) == 6
