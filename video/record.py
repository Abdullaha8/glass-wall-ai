"""Record the demo against the deployed site with a real agent (Playwright + Chromium).

    python video/record.py            # writes build/raw.webm and build/timeline.json

Each scene lasts at least as long as its narration clip (build/audio/durations.json).
Live runs are real: the deployed backend runs the LLM agent through the MCP server.
"""
import json
import shutil
import sys
import time
from pathlib import Path

import httpx
from playwright.sync_api import Page, sync_playwright

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"
SITE = "https://glass-wall-ai.vercel.app"
API = "https://glass-wall-ai.onrender.com"
MODEL = "gemini/gemini-3.5-flash-lite"
W, H = 1440, 900

NARRATION = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
CAPTIONS = {s["id"]: s["caption"] for s in NARRATION["scenes"]}
DUR = json.loads((BUILD / "audio" / "durations.json").read_text(encoding="utf-8"))

OVERLAY_JS = r"""
// recording only: hide the floating "Run live" pill, which would sit on top of the content on camera
document.addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style');
  st.textContent = 'button.fixed.bottom-6 { display: none !important; }';
  document.head.appendChild(st);
});
window.__gw = {
  caption(text) {
    let el = document.getElementById('gw-cap');
    if (!el) {
      el = document.createElement('div'); el.id = 'gw-cap';
      Object.assign(el.style, {position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)',
        background: 'rgba(20,17,25,.92)', color: '#fff', font: '600 20px Inter, system-ui, sans-serif',
        padding: '12px 24px', borderRadius: '14px', zIndex: 9998, maxWidth: '80%', textAlign: 'center',
        border: '1px solid rgba(181,119,243,.45)', boxShadow: '0 10px 40px rgba(0,0,0,.6), 0 0 30px rgba(181,119,243,.25)'});
      document.body.appendChild(el);
    }
    el.textContent = text; el.style.display = text ? 'block' : 'none';
  },
  card(title, lines) {
    let el = document.getElementById('gw-card');
    if (!el) { el = document.createElement('div'); el.id = 'gw-card'; document.body.appendChild(el); }
    Object.assign(el.style, {position: 'fixed', inset: '0', zIndex: 9999, background: 'radial-gradient(ellipse at 50% 35%, #2a1442 0%, #050408 60%)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px',
      font: '400 22px Inter, system-ui, sans-serif', textAlign: 'center'});
    el.innerHTML = `<img src="/mark.svg" width="150" height="150" alt="">
      <div style="font:700 56px Inter, system-ui, sans-serif">${title}</div>` +
      lines.map((l, i) => `<div style="${i === 0 ? 'font-size:26px;color:#dcc2fb' : 'font-size:20px;color:#a69fb5;font-family:JetBrains Mono, monospace'}">${l}</div>`).join('');
  },
  hideCard() { const el = document.getElementById('gw-card'); if (el) el.remove(); },
};
"""

timeline: dict[str, float] = {}
T0 = 0.0


def scene(page: Page, sid: str) -> float:
    timeline[sid] = round(time.monotonic() - T0, 2)
    page.evaluate("t => window.__gw.caption(t)", CAPTIONS.get(sid, ""))
    print(f"[{timeline[sid]:6.1f}s] {sid}")
    return time.monotonic()


def hold_until(start: float, sid: str, pad: float = 1.0) -> None:
    remaining = DUR[sid] + pad - (time.monotonic() - start)
    if remaining > 0:
        time.sleep(remaining)


DRY = "--dry" in sys.argv


def run_live(page: Page, case_id: str, timeout_s: int = 150) -> str:
    """Pick a case, click Run, wait for the verdict. Retries once on a busy/rate-limit notice."""
    page.get_by_label("Prompt from the eval suite").select_option(case_id)
    if DRY:
        page.wait_for_timeout(4000)
        return "(dry run: no live call)"
    for attempt in range(2):
        page.get_by_role("button", name="Run in").click()
        page.wait_for_timeout(1500)
        if page.get_by_role("alert").count() and attempt == 0:
            print("  run refused, retrying in 8s:", page.get_by_role("alert").inner_text())
            page.wait_for_timeout(8000)
            continue
        page.get_by_role("button", name="Run in").wait_for(timeout=timeout_s * 1000)  # running state ended
        break
    verdict = page.locator('section[aria-label="Live run"] [aria-live="polite"]').inner_text()
    print("  verdict:", verdict.splitlines()[0] if verdict else "?")
    return verdict


def warm_backend() -> None:
    for _ in range(12):
        try:
            if httpx.get(f"{API}/health", timeout=60).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(5)
    sys.exit("backend did not wake up")


def main() -> None:
    global T0
    warm_backend()
    vids = BUILD / "video_tmp"
    shutil.rmtree(vids, ignore_errors=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": W, "height": H}, color_scheme="dark",
                                  record_video_dir=str(vids), record_video_size={"width": W, "height": H})
        ctx.add_init_script(OVERLAY_JS)
        page = ctx.new_page()
        T0 = time.monotonic()

        nav = lambda name: page.locator("nav[aria-label=Sections]").get_by_role("button", name=name, exact=True)

        # 1 · intro card, then reveal the Overview dashboard
        page.goto(SITE, wait_until="networkidle")
        page.evaluate("() => window.__gw.card('Glass Wall AI', ['AI agents see your data’s shape. Never your users.', 'MCP · Postgres · LiteLLM · real agents, real attacks'])")
        t = scene(page, "s1_intro")
        page.evaluate("() => window.__gw.caption('')")
        page.wait_for_timeout(int(DUR["s1_intro"] * 550))
        page.evaluate("() => window.__gw.hideCard()")
        hold_until(t, "s1_intro", pad=0.5)

        # 2 · No-Wall: social-engineering attack, real data leaves
        t = scene(page, "s2_no_wall")
        nav("Run live").click()
        page.get_by_text("live backend ready").wait_for(timeout=90_000)
        page.get_by_label("Model").select_option(MODEL)
        page.get_by_role("radio", name="No-Wall").click()
        run_live(page, "A07")
        page.locator('section[aria-label="Outbox inspector"]').scroll_into_view_if_needed()
        page.wait_for_timeout(5000)
        hold_until(t, "s2_no_wall")
        page.evaluate("() => window.scrollTo({top: 0, behavior: 'smooth'})")

        # 3 · Glass Wall: same prompt, tokens only; then a raw-table attack is refused
        t = scene(page, "s3_glass_wall")
        page.get_by_role("radio", name="Glass Wall").click()
        run_live(page, "A07")
        page.locator('section[aria-label="Outbox inspector"]').scroll_into_view_if_needed()
        page.wait_for_timeout(4500)
        page.evaluate("() => window.scrollTo({top: 0, behavior: 'smooth'})")
        page.evaluate("() => window.__gw.caption('Raw-table attack: the database itself refuses.')")
        run_live(page, "A18")
        page.wait_for_timeout(3000)
        hold_until(t, "s3_glass_wall")

        # 4 · The measurement: Overview heatmap, then the Results tiles and table
        t = scene(page, "s4_scoreboard")
        nav("Overview").click()
        page.get_by_text("Every attack, every setup").scroll_into_view_if_needed()
        page.wait_for_timeout(int(DUR["s4_scoreboard"] * 450))
        nav("Results").click()
        page.wait_for_timeout(int(DUR["s4_scoreboard"] * 250))
        page.get_by_role("tab", name="Table").click()
        hold_until(t, "s4_scoreboard")
        page.get_by_role("tab", name="Chart").click()

        # 5 · Honest notes: the verified false positive, in the replay log
        t = scene(page, "s5_honest")
        nav("Live demo").click()
        page.get_by_role("tab", name="Replay recorded runs").click()
        page.get_by_role("radio", name="Glass Wall").click()
        fp = page.get_by_text("false positive (verified").first
        fp.wait_for(timeout=45_000)
        fp.scroll_into_view_if_needed()
        page.wait_for_timeout(1200)
        fp.click()
        hold_until(t, "s5_honest")
        page.keyboard.press("Escape")

        # 6 · Close
        t = scene(page, "s6_close")
        page.evaluate("() => window.__gw.caption('')")
        page.evaluate("""() => window.__gw.card('Glass Wall AI', [
            'Any agent can connect: glass-wall-ai.onrender.com/mcp/wall',
            'glass-wall-ai.vercel.app · github.com/Abdullaha8/glass-wall-ai',
            'Voice: ElevenLabs'])""")
        hold_until(t, "s6_close", pad=3.0)

        video_path = page.video.path()
        ctx.close()
        browser.close()

    BUILD.mkdir(exist_ok=True)
    shutil.move(video_path, BUILD / ("raw_dry.webm" if DRY else "raw.webm"))
    (BUILD / ("timeline_dry.json" if DRY else "timeline.json")).write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    print("wrote build/" + ("raw_dry.webm + timeline_dry.json" if DRY else "raw.webm + timeline.json"))


if __name__ == "__main__":
    main()
