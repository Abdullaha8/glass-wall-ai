"""Generate the Glass Wall AI logo set as SVG: person -> glass -> tokens.

    python assets/logo/build_logo.py

Writes mark.svg (full badge), favicon.svg (simplified, legible at 16 px),
lockup.svg (mark + wordmark) and cover.svg (1200x630 social/Devfolio cover).
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent
NAVY_A, NAVY_B = "#0b1220", "#18264a"
WARM_A, WARM_B = "#ffb36b", "#ff5f7e"      # the person (real data)
TOKEN_A, TOKEN_B = "#5eead4", "#22c55e"    # the tokens (what the agent sees)
GLASS = "#e8f3ff"


def inside_person(x: float, y: float, cx: float, top: float, s: float) -> bool:
    """Head-and-shoulders silhouette, scale s, centred on cx, head top at `top`."""
    head_r = 30 * s
    hx, hy = cx, top + head_r
    if (x - hx) ** 2 + (y - hy) ** 2 <= head_r ** 2:
        return True
    sy = top + 2 * head_r + 10 * s          # shoulders start below the neck gap
    if y < sy:
        return False
    w = 64 * s                               # half-width of the shoulders
    h = 70 * s
    if y > sy + h:
        return False
    # rounded "bust": ellipse top, flat bottom
    ry = 46 * s
    if y < sy + ry:
        return ((x - cx) / w) ** 2 + ((y - (sy + ry)) / ry) ** 2 <= 1
    return abs(x - cx) <= w


def person_path(cx: float, top: float, s: float) -> str:
    head_r = 30 * s
    sy = top + 2 * head_r + 10 * s
    w, ry, h = 64 * s, 46 * s, 70 * s
    return (f'<circle cx="{cx}" cy="{top + head_r}" r="{head_r}"/>'
            f'<path d="M{cx - w},{sy + h} V{sy + ry} A{w},{ry} 0 0 1 {cx + w},{sy + ry} V{sy + h} Z"/>')


def token_blocks(cx: float, top: float, s: float, step: float, size: float, seed: int = 7) -> str:
    rnd = random.Random(seed)
    blocks = []
    y = top
    while y < top + 220 * s:
        x = cx - 72 * s
        while x < cx + 72 * s:
            if inside_person(x + size / 2, y + size / 2, cx, top, s):
                o = rnd.choice([1, 1, 1, 0.75, 0.55])
                blocks.append(f'<rect x="{x:.1f}" y="{y:.1f}" width="{size}" height="{size}" rx="{size * 0.22:.1f}" opacity="{o}"/>')
            x += step
        y += step
    return "".join(blocks)


DEFS = f"""
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{NAVY_B}"/><stop offset="1" stop-color="{NAVY_A}"/>
  </linearGradient>
  <radialGradient id="glow" cx="0.5" cy="0.45" r="0.6">
    <stop offset="0" stop-color="#3b82f6" stop-opacity="0.35"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{WARM_A}"/><stop offset="1" stop-color="{WARM_B}"/>
  </linearGradient>
  <linearGradient id="tok" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="{TOKEN_A}"/><stop offset="1" stop-color="{TOKEN_B}"/>
  </linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="{GLASS}" stop-opacity="0.10"/>
    <stop offset="0.45" stop-color="{GLASS}" stop-opacity="0.38"/>
    <stop offset="1" stop-color="{GLASS}" stop-opacity="0.12"/>
  </linearGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="{WARM_B}" stop-opacity="0"/>
    <stop offset="0.48" stop-color="#ffffff" stop-opacity="0.35"/>
    <stop offset="1" stop-color="{TOKEN_A}" stop-opacity="0"/>
  </linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
</defs>"""


def mark_body(x0: float = 0, y0: float = 0, size: float = 512) -> str:
    """The badge drawn in a 512 box, translated/scaled into place."""
    k = size / 512
    grid = "".join(f'<path d="M{v} 40V472M40 {v}H472" stroke="#ffffff" stroke-opacity="0.045" stroke-width="2"/>'
                   for v in range(88, 472, 48))
    ticks = ('<g stroke="#5eead4" stroke-width="10" stroke-linecap="round">'
             '<path d="M256 22V58M256 454V490M22 256H58M454 256H490"/></g>')
    glass = ('<g>'
             '<polygon points="232,92 286,70 286,442 232,464" fill="url(#glass)" stroke="#ffffff" stroke-opacity="0.65" stroke-width="3"/>'
             '<path d="M246 108 V448" stroke="#ffffff" stroke-opacity="0.55" stroke-width="4" stroke-linecap="round"/>'
             '<g stroke="#ffffff" stroke-opacity="0.5" stroke-width="3" stroke-linecap="round">'
             '<path d="M240 196 L280 178M240 262 L280 244M240 328 L280 310"/></g></g>')
    beam = '<rect x="70" y="236" width="372" height="40" fill="url(#beam)" filter="url(#soft)"/>'
    # silhouette height is 140*s; s=1.2 -> 168 px, centred on y=256
    person = f'<g fill="url(#warm)">{person_path(140, 172, 1.2)}</g>'
    tokens = f'<g fill="url(#tok)">{token_blocks(378, 172, 1.2, 9.5, 7.6)}</g>'
    return (f'<g transform="translate({x0} {y0}) scale({k})">'
            '<rect x="8" y="8" width="496" height="496" rx="116" fill="url(#bg)"/>'
            '<rect x="8" y="8" width="496" height="496" rx="116" fill="url(#glow)"/>'
            f'{grid}{ticks}{beam}{person}{tokens}{glass}'
            '<rect x="8" y="8" width="496" height="496" rx="116" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="3"/>'
            '</g>')


def svg(w: int, h: int, body: str) -> str:
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}{body}</svg>\n'


def favicon() -> str:
    # 64 grid: badge, warm dot, glass pane, 2x3 token blocks. Reads at 16 px.
    blocks = "".join(f'<rect x="{41 + c * 7}" y="{21 + r * 7}" width="5.5" height="5.5" rx="1.3"/>'
                     for r in range(3) for c in range(2))
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">' + DEFS +
            '<rect x="1" y="1" width="62" height="62" rx="15" fill="url(#bg)"/>'
            '<circle cx="18" cy="27" r="7" fill="url(#warm)"/>'
            '<path d="M8 47 A10 9 0 0 1 28 47 Z" fill="url(#warm)"/>'
            '<polygon points="29,12 36,9 36,53 29,56" fill="#e8f3ff" fill-opacity="0.45" stroke="#ffffff" stroke-opacity="0.8" stroke-width="1.2"/>'
            f'<g fill="url(#tok)">{blocks}</g>'
            '</svg>\n')


def lockup() -> str:
    text = ('<text x="300" y="168" font-family="Inter, Segoe UI, system-ui, sans-serif" font-size="112" font-weight="800" '
            'fill="#0b1220" letter-spacing="-3">Glass Wall <tspan fill="#10b981">AI</tspan></text>'
            '<text x="304" y="226" font-family="Inter, Segoe UI, system-ui, sans-serif" font-size="30" font-weight="500" '
            'fill="#5b6168">AI agents see your data\'s shape, never your users</text>')
    return svg(1180, 280, mark_body(10, 10, 260) + text)


def cover() -> str:
    stars = "".join(f'<circle cx="{random.Random(i).randint(0, 1200)}" cy="{random.Random(i * 7).randint(0, 630)}" '
                    f'r="{random.Random(i * 3).choice([1, 1, 1.5, 2])}" fill="#ffffff" opacity="{random.Random(i * 5).choice([0.15, 0.25, 0.4])}"/>'
                    for i in range(1, 70))
    sans = 'font-family="Inter, Segoe UI, system-ui, sans-serif"'
    text = (f'<text x="540" y="262" {sans} font-size="88" font-weight="800" '
            'fill="#ffffff" letter-spacing="-2">Glass Wall <tspan fill="#5eead4">AI</tspan></text>'
            f'<text x="543" y="318" {sans} font-size="27" font-weight="500" fill="#c7d2fe">AI agents see your data\'s shape,</text>'
            f'<text x="543" y="354" {sans} font-size="27" font-weight="500" fill="#c7d2fe">never your users.</text>'
            '<g font-family="JetBrains Mono, Consolas, monospace" font-size="20" fill="#94a3b8">'
            '<text x="543" y="426">No wall    · 71–85% of attacks leaked</text>'
            '<text x="543" y="460" fill="#5eead4">Glass Wall · 0% leaked · 100% correct</text>'
            '<text x="543" y="518" fill="#64748b">MCP · Postgres · LiteLLM · real agents</text></g>')
    return svg(1200, 630, '<rect width="1200" height="630" fill="url(#bg)"/>'
               '<rect width="1200" height="630" fill="url(#glow)"/>' + stars + mark_body(60, 95, 440) + text)


if __name__ == "__main__":
    (OUT / "mark.svg").write_text(svg(512, 512, mark_body()), encoding="utf-8")
    (OUT / "favicon.svg").write_text(favicon(), encoding="utf-8")
    (OUT / "lockup.svg").write_text(lockup(), encoding="utf-8")
    (OUT / "cover.svg").write_text(cover(), encoding="utf-8")
    print("wrote mark.svg, favicon.svg, lockup.svg, cover.svg")
