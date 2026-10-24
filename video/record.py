"""Record the demo against the deployed site with a real agent (Playwright + Chromium).

    python video/record.py            # writes build/raw.webm and build/timeline.json
    python video/record.py --dry      # same flow without live LLM calls, to check the timing and boxes

The narration is a list of beats (narration.json). For each beat the recorder does the beat's
action, draws a spotlight box around what the beat talks about, shows the line as a subtitle and
holds for the length of its audio clip (build/audio/durations.json; estimated if not generated yet).
Live runs are real: the deployed backend runs the LLM agent through the MCP server.
"""
import json
import re
import shutil
import sys
import time
from collections.abc import Callable
from pathlib import Path

import httpx
from playwright.sync_api import Locator, Page, sync_playwright

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build"
SITE = "https://glass-wall-ai.vercel.app"
API = "https://glass-wall-ai.onrender.com"
MODEL_LABEL = "Gemini 3.5 Flash-Lite"   # reliable tool use in the live runs (gpt-oss-120b refused the raw-table attack)
W, H = 1440, 900
DRY = "--dry" in sys.argv

NARRATION = json.loads((HERE / "narration.json").read_text(encoding="utf-8"))
_dur_file = BUILD / "audio" / "durations.json"
DUR = json.loads(_dur_file.read_text(encoding="utf-8")) if _dur_file.exists() else {}

OVERLAY_JS = r"""
window.__gw = {
  caption(text) {
    let el = document.getElementById('gw-cap');
    if (!el) {
      el = document.createElement('div'); el.id = 'gw-cap';
      Object.assign(el.style, {position: 'fixed', left: '50%', bottom: '26px', transform: 'translateX(-50%)',
        background: 'rgba(14,11,19,.94)', color: '#fff', font: '500 19px/1.4 Inter, system-ui, sans-serif',
        padding: '10px 22px', borderRadius: '14px', zIndex: 9999, maxWidth: '78%', textAlign: 'center',
        border: '1px solid rgba(181,119,243,.35)', boxShadow: '0 10px 40px rgba(0,0,0,.6)'});
      document.body.appendChild(el);
    }
    el.textContent = text; el.style.display = text ? 'block' : 'none';
  },
  // a purple box around [x, y, w, h] (viewport px) with a short label; the rest of the page dims
  spot(rect, label) {
    let el = document.getElementById('gw-spot');
    if (!el) {
      el = document.createElement('div'); el.id = 'gw-spot';
      el.innerHTML = '<span></span>';
      Object.assign(el.style, {position: 'fixed', zIndex: 9997, pointerEvents: 'none', borderRadius: '16px',
        border: '2px solid #d2abfb', transition: 'all .55s cubic-bezier(.2,.8,.2,1), opacity .3s',
        boxShadow: '0 0 0 9999px rgba(5,4,8,.55), 0 0 28px rgba(181,119,243,.75), inset 0 0 18px rgba(181,119,243,.25)'});
      Object.assign(el.firstChild.style, {position: 'absolute', left: '-2px', top: '-36px', whiteSpace: 'nowrap',
        background: 'linear-gradient(135deg,#c99ef8,#9d55e6)', color: '#fff', font: '600 15px Inter, system-ui, sans-serif',
        padding: '6px 12px', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,.5)'});
      document.body.appendChild(el);
    }
    if (!rect) { el.style.opacity = '0'; return; }
    const [x, y, w, h] = rect;
    Object.assign(el.style, {left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', opacity: '1'});
    el.firstChild.textContent = label || '';
    el.firstChild.style.display = label ? 'block' : 'none';
    el.firstChild.style.top = y < 50 ? (h + 8) + 'px' : '-36px';   // keep the label on screen
  },
  card(title, lines) {
    let el = document.getElementById('gw-card');
    if (!el) { el = document.createElement('div'); el.id = 'gw-card'; document.body.appendChild(el); }
    Object.assign(el.style, {position: 'fixed', inset: '0', zIndex: 9998, background: 'radial-gradient(ellipse at 50% 35%, #2a1442 0%, #050408 60%)', color: '#fff',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px',
      font: '400 22px Inter, system-ui, sans-serif', textAlign: 'center'});
    el.innerHTML = `<img src="/logo.svg" width="150" height="150" alt="" style="border-radius:50%">
      <div style="font:700 56px Inter, system-ui, sans-serif">${title}</div>` +
      lines.map((l, i) => `<div style="${i === 0 ? 'font-size:26px;color:#dcc2fb' : 'font-size:20px;color:#a69fb5;font-family:JetBrains Mono, monospace'}">${l}</div>`).join('');
  },
};
"""

timeline: dict[str, float] = {}
T0 = 0.0


# ---- what each beat puts a box around -------------------------------------------------------------
def _attack_card(page: Page) -> Locator:
    return page.get_by_text("One real attack", exact=False).first.locator("xpath=ancestor::div[contains(@class,'rounded-2xl')][1]")


def _kpi(page: Page, label: str) -> Locator:
    return page.locator("p.font-mono").filter(has_text=re.compile(rf"^{label}$")).locator("xpath=..")


BOXES: dict[str, Callable[[Page], list[Locator]]] = {
    "attack_card": lambda p: [_attack_card(p)],
    "attack_message": lambda p: [_attack_card(p).locator("div.border-l-2").first],
    "agent_table": lambda p: [p.locator("section").filter(has_text="What the agent sees").first],
    "mode_picker": lambda p: [p.get_by_role("radiogroup", name="Mode", exact=True)],
    "prompt": lambda p: [p.locator('section[aria-label="Live run"] p.font-mono')],
    "log": lambda p: [p.locator('section[aria-label="Live log stream"]')],
    "outbox_first": lambda p: [p.locator('section[aria-label="Outbox inspector"] li').first],
    "heatmap": lambda p: [p.locator("section").filter(has_text="Every attack, every setup").first],
    "kpi_without": lambda p: [_kpi(p, "No wall"), _kpi(p, "Rules in the prompt")],
    "kpi_wall": lambda p: [_kpi(p, "Glass Wall")],
    "correct_chart": lambda p: [p.locator("figure").filter(has_text="Normal questions answered correctly")],
    "tradeoff_note": lambda p: [p.locator("p").filter(has_text="can't be answered with the wall on").first],
    "false_alarm": lambda p: [p.get_by_text("false positive (verified").first.locator("xpath=ancestor::button[1]")],
    "steps": lambda p: [p.locator("div.grid").filter(has_text="Agents connect through MCP").filter(has_text="Every call is on the record").last],
    "step_mcp": lambda p: [p.locator("h3", has_text="Agents connect through MCP").locator("xpath=..")],
}


def spotlight(page: Page, key: str | None, label: str | None) -> None:
    if not key:
        page.evaluate("() => window.__gw.spot(null)")
        return
    locs = BOXES[key](page)
    locs[0].evaluate("e => e.scrollIntoView({block: 'center', behavior: 'instant'})")
    page.wait_for_timeout(250)
    boxes = [b for b in (loc.bounding_box() for loc in locs) if b]
    if not boxes:
        print(f"  ! nothing to box for {key}")
        return
    x0, y0 = min(b["x"] for b in boxes), min(b["y"] for b in boxes)
    x1, y1 = max(b["x"] + b["width"] for b in boxes), max(b["y"] + b["height"] for b in boxes)
    pad = 8
    page.evaluate("([r, l]) => window.__gw.spot(r, l)", [[x0 - pad, y0 - pad, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad], label])


# ---- actions done before a beat starts (or while it's spoken) --------------------------------------
def nav(page: Page, name: str) -> None:
    page.evaluate("() => window.__gw.spot(null)")
    page.locator("nav[aria-label=Sections]").get_by_role("button", name=name, exact=True).click()
    page.wait_for_timeout(1200)


def run_live(page: Page, case_id: str, want: str | None = None, tries: int = 3) -> None:
    """Run a case and wait for the verdict; retry (up to `tries`) on errors or until the verdict contains `want`.
    While the agent works, the box sits on the log so the events can be watched streaming in."""
    page.get_by_label("Prompt from the eval suite").select_option(case_id)
    page.evaluate("() => window.__gw.caption('')")
    spotlight(page, "log", "Agent working…")
    if DRY:
        page.wait_for_timeout(3000)
        return
    for attempt in range(tries):
        page.get_by_role("button", name="Run in").click()
        page.wait_for_timeout(1500)
        if page.get_by_role("alert").count():
            print("  run refused:", page.get_by_role("alert").inner_text())
            page.wait_for_timeout(8000)
            continue
        page.get_by_role("button", name="Agent running").wait_for(state="hidden", timeout=180_000)
        page.wait_for_timeout(1500)
        verdict = page.locator('section[aria-label="Live run"] [aria-live="polite"]').last.inner_text()
        print(f"  {case_id} try {attempt + 1}: {' '.join(verdict.split())[:110]}")
        if "Run ended with an error" in verdict:
            page.wait_for_timeout(5000)
            continue
        if not want or want in verdict:
            return
    print(f"  ! {case_id}: never got '{want}' after {tries} tries")


def open_live(page: Page) -> None:
    page.evaluate("() => window.__gw.spot(null)")
    page.get_by_role("button", name="Run live").click()
    page.get_by_text("live backend ready").wait_for(timeout=120_000)
    page.get_by_role("radiogroup", name="Model and its free-tier quota").get_by_role("radio", name=MODEL_LABEL).click()
    page.get_by_role("radio", name="No wall").click()
    page.get_by_label("Prompt from the eval suite").select_option("A07")
    page.evaluate("() => window.scrollTo(0, 0)")


def wall_on(page: Page) -> None:
    page.evaluate("() => window.scrollTo(0, 0)")
    page.get_by_role("radio", name="Glass Wall").click()
    page.wait_for_timeout(600)


def open_false_alarm(page: Page) -> None:
    nav(page, "Live demo")
    page.get_by_role("tab", name="Replay recorded runs").click()
    page.get_by_role("radio", name="Glass Wall").click()
    page.get_by_text("false positive (verified").first.wait_for(timeout=60_000)
    page.get_by_role("button", name="⏸ Pause").click()   # stop the replay so the log holds still for the box
    page.wait_for_timeout(400)


def end_card(page: Page) -> None:
    page.evaluate("() => window.__gw.spot(null)")
    page.evaluate("""() => window.__gw.card('Glass Wall AI', [
        'AI sees the shape of the data. Never the people in it.',
        'glass-wall-ai.vercel.app',
        'github.com/Abdullaha8/glass-wall-ai'])""")


def sweep_wall(page: Page, seconds: float) -> None:
    """While the beat is spoken, slide the Home glass wall from 'all real' to 'all codes'."""
    slider = page.get_by_role("slider").first
    for _ in range(20):
        slider.press("ArrowLeft")
        page.wait_for_timeout(int(seconds * 1000 / 22))


BEFORE: dict[str, Callable[[Page], None]] = {
    "b2_setup": open_live,
    "b2_red": lambda p: run_live(p, "A07", want="PERSONAL DATA LEFT"),
    "b3_up": wall_on,
    "b3_helps": lambda p: run_live(p, "A07"),
    "b3_blocked": lambda p: run_live(p, "A18", want="WALL HELD"),
    "b4_scale": lambda p: nav(p, "Dashboard"),
    "b4_without": lambda p: nav(p, "Results"),
    "b5_false_alarm": open_false_alarm,
    "b6_database": lambda p: nav(p, "How it works"),
    "b6_close": end_card,
}
DURING: dict[str, Callable[[Page, float], None]] = {"b1_glass": sweep_wall}


def beat_seconds(beat: dict) -> float:
    if beat["id"] in DUR:
        return DUR[beat["id"]]["seconds"]
    return len(beat["text"].split()) / 2.6   # rough speaking pace until the audio exists


def play(page: Page, beat: dict) -> None:
    BEFORE.get(beat["id"], lambda p: None)(page)
    spotlight(page, beat["box"], beat["label"])
    timeline[beat["id"]] = round(time.monotonic() - T0, 2)
    page.evaluate("t => window.__gw.caption(t)", beat["text"])
    print(f"[{timeline[beat['id']]:6.1f}s] {beat['id']}")
    start, length = time.monotonic(), beat_seconds(beat)
    if beat["id"] in DURING:
        DURING[beat["id"]](page, length)
    remaining = length + 0.6 - (time.monotonic() - start)   # a short breath between beats
    if remaining > 0:
        time.sleep(remaining)


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

        # Home: let the wall's hint sweep finish, then park the wall at the far right (everything real)
        page.goto(SITE, wait_until="networkidle")
        page.wait_for_timeout(4500)
        page.get_by_role("slider").first.press("End")
        page.wait_for_timeout(900)

        for scene in NARRATION["scenes"]:
            for beat in scene["beats"]:
                play(page, beat)
        page.wait_for_timeout(2500)

        video_path = page.video.path()
        ctx.close()
        browser.close()

    BUILD.mkdir(exist_ok=True)
    shutil.move(video_path, BUILD / ("raw_dry.webm" if DRY else "raw.webm"))
    (BUILD / ("timeline_dry.json" if DRY else "timeline.json")).write_text(json.dumps(timeline, indent=2), encoding="utf-8")
    print("wrote build/" + ("raw_dry.webm + timeline_dry.json" if DRY else "raw.webm + timeline.json"))


if __name__ == "__main__":
    main()
