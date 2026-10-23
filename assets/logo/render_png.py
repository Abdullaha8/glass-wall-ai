"""Render the logo SVGs to PNG with headless Chromium (fonts load from Google Fonts).

    python assets/logo/render_png.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

OUT = Path(__file__).resolve().parent
FONTS = ('<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;800&family=JetBrains+Mono&display=swap" '
         'rel="stylesheet">')
JOBS = [  # (svg, png, width, height, background)
    ("mark.svg", "mark-512.png", 512, 512, "transparent"),
    ("mark.svg", "mark-600.png", 600, 600, "transparent"),   # Devfolio logo size
    ("favicon.svg", "favicon-64.png", 64, 64, "transparent"),
    ("lockup.svg", "lockup.png", 1180, 280, "#ffffff"),
    ("cover.svg", "cover-1200x630.png", 1200, 630, "transparent"),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for src, dst, w, h, bg in JOBS:
        page = browser.new_page(viewport={"width": w, "height": h})
        svg = (OUT / src).read_text(encoding="utf-8")
        svg = svg.replace("<svg ", f'<svg style="width:{w}px;height:{h}px" ', 1)  # scale to the job size
        page.set_content(f"<html><head>{FONTS}</head><body style='margin:0;background:{bg}'>{svg}</body></html>",
                         wait_until="networkidle")
        page.screenshot(path=str(OUT / dst), omit_background=bg == "transparent",
                        clip={"x": 0, "y": 0, "width": w, "height": h})
        page.close()
        print("rendered", dst)
    browser.close()
