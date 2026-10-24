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
