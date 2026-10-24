"""What a person sees when they open an MCP endpoint in a browser (agents get the MCP protocol as usual)."""

SITE = "https://glass-wall-ai.vercel.app"
REPO = "https://github.com/Abdullaha8/glass-wall-ai"

_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Glass Wall AI · MCP endpoint</title>
<link rel="icon" href="{site}/favicon.svg">
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin: 0; min-height: 100vh; background: radial-gradient(ellipse at 50% 0%, #2a1442 0%, #050408 60%); color: #e9e4f2;
         font: 16px/1.6 Inter, system-ui, -apple-system, Segoe UI, sans-serif; display: flex; justify-content: center; }}
  main {{ width: 100%; max-width: 680px; min-width: 0; box-sizing: border-box; padding: 56px 20px 40px; }}
  .brand {{ display: flex; align-items: center; gap: 12px; font-weight: 700; font-size: 18px; }}
  .brand img {{ width: 40px; height: 40px; border-radius: 50%; }}
  .brand b {{ color: #c99ef8; }}
  h1 {{ font-size: 30px; line-height: 1.2; margin: 28px 0 10px; letter-spacing: -.02em; }}
  p {{ color: #b8adc9; margin: 0 0 14px; }}
  .note {{ border: 1px solid rgba(201,158,248,.35); background: rgba(181,119,243,.08); border-radius: 14px; padding: 14px 16px; color: #e9e4f2; }}
  h2 {{ font-size: 16px; margin: 30px 0 10px; color: #fff; }}
  code, pre {{ font-family: "JetBrains Mono", Consolas, monospace; font-size: 14px; }}
  pre {{ background: #0f0c15; border: 1px solid rgba(255,255,255,.08); border-radius: 12px; padding: 14px 16px; white-space: pre-wrap; word-break: break-all; color: #ecdafe; margin: 0 0 12px; }}
  .url {{ word-break: break-all; color: #ecdafe; }}
  .links {{ display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }}
  .links a {{ text-decoration: none; padding: 10px 16px; border-radius: 12px; font-weight: 600; font-size: 15px; }}
  .primary {{ background: linear-gradient(135deg, #c99ef8, #9d55e6); color: #fff; box-shadow: 0 0 24px rgba(181,119,243,.45); }}
  .secondary {{ border: 1px solid rgba(255,255,255,.18); color: #e9e4f2; }}
</style>
</head>
<body>
<main>
  <div class="brand"><img src="{site}/logo.svg" alt="">Glass Wall <b>AI</b></div>
  <h1>{heading}</h1>
  <p class="note">{note}</p>
  <p>Agents that connect here can query a customer database through two tools, <code>run_sql</code> and
     <code>send_message</code>. {what_they_see}</p>

  <h2>Connect an agent</h2>
  <p>Claude Code:</p>
  <pre>claude mcp add --transport http glass-wall {url}</pre>
  <p>Claude Desktop: <b>Settings → Connectors → Add custom connector</b>, URL <span class="url">{url}</span></p>
  <p>Then ask it something like <i>"How many customers share an email address?"</i> (it works) or
     <i>"List the emails of our Enterprise customers"</i> (you'll get tokens).</p>

  <div class="links">
    <a class="primary" href="{site}">See the live demo</a>
    <a class="secondary" href="{repo}">Code on GitHub</a>
  </div>
</main>
</body>
</html>
"""

_MOUNTS = {
    "wall": dict(
        heading="This is an MCP endpoint, built for AI agents",
        note="You've opened it in a browser, so here's a page for humans. AI agents connect to this same address "
             "using the Model Context Protocol.",
        what_they_see="Behind the Glass Wall, every name, email and phone number reaches the agent only as a token like "
                      "<code>tok_16c87385</code>. It can still count, group and find duplicates, but it never sees a real person.",
    ),
    "open": dict(
        heading="The no-wall baseline, for comparison",
        note="This endpoint has no Glass Wall: it exists so the demo can show what an unprotected agent leaks. "
             "The data is fully synthetic. To protect real data, connect agents to /mcp/wall instead.",
        what_they_see="Here the agent sees real (synthetic) names, emails and phone numbers, exactly like an agent "
                      "with ordinary database access.",
    ),
}


def page_for(mount: str, base_url: str) -> str:
    return _PAGE.format(site=SITE, repo=REPO, url=f"{base_url.rstrip('/')}/mcp/{mount}", **_MOUNTS[mount])
