"""Capture the Devfolio screenshots (1-6 real screenshots of the running project).

    python video/screenshots.py          # from the deployed site -> assets/screenshots/*.png

Replay data only; no live LLM calls, so it costs nothing and can be re-run at the freeze.
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

SITE = "https://glass-wall-ai.vercel.app"
OUT = Path(__file__).resolve().parents[1] / "assets" / "screenshots"
# wait until the data-flow diagram describes this state AND the log has a few rows
WAIT_STATE = """([text, rows]) => {
  const svg = document.querySelector('figure svg[role=img]');
  const n = document.querySelectorAll('[role=log] button').length;
  return svg && (svg.getAttribute('aria-label') || '').includes(text) && n >= rows;
}"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5, color_scheme="dark")
        nav = lambda name: page.locator("nav[aria-label=Sections]").get_by_role("button", name=name, exact=True)

        # Home: wait for the attack to play out and the glass wall's hint sweep to settle
        page.goto(SITE, wait_until="networkidle")
        page.wait_for_timeout(6500)
        page.screenshot(path=str(OUT / "1-home.png"))

        nav("Dashboard").click()
        page.wait_for_timeout(1500)
        page.screenshot(path=str(OUT / "2-dashboard.png"))

        # replay: no wall leaks, then the same attacks under Glass Wall
        nav("Live demo").click()
        page.get_by_role("tab", name="Replay recorded runs").click()   # the tab opens in live mode
        page.get_by_role("radio", name="No wall").click()
        page.wait_for_function(WAIT_STATE, arg=["REAL personal data", 5], timeout=90_000)
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "3-no-wall-leak.png"))

        page.get_by_role("radio", name="Glass Wall").click()
        page.wait_for_function(WAIT_STATE, arg=["tokens only", 3], timeout=90_000)
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / "4-glass-wall-tokens.png"))

        nav("Results").click()
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / "5-results.png"))

        nav("How it works").click()
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / "6-how-it-works.png"))
        browser.close()
    print("wrote", ", ".join(sorted(f.name for f in OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
