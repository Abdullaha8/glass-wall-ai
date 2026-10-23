const STEPS = [
  {
    icon: "M4 12h4l2-6 4 12 2-6h4",
    title: "Agents connect through MCP",
    body: "Point Claude, Cursor, n8n or your own agent at one MCP endpoint instead of handing it database passwords.",
  },
  {
    icon: "M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z",
    title: "Postgres hands out tokens",
    body: "A secure view hashes names, emails and phones with a secret salt. Equal values get equal tokens, so analytics still work.",
  },
  {
    icon: "M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z",
    title: "The database enforces it",
    body: "The agent's role can only read that view: no raw table, no salt, no role switching, no writes. 21 checks prove it.",
  },
  {
    icon: "M4 6h16M4 12h16M4 18h10",
    title: "Every call is on the record",
    body: "Each query and message is logged and streamed live, and an outbox shows exactly what an attacker would have received.",
  },
];

export function HowItWorks() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s, i) => (
        <div key={s.title} className="rounded-2xl bg-surface p-5 shadow-[0_1px_2px_rgba(16,24,40,.06)] ring-1 ring-line">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#0b1220] text-[#5eead4]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
                   strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={s.icon} /></svg>
            </span>
            <span className="font-mono text-[12px] text-muted">0{i + 1}</span>
          </div>
          <h3 className="mt-4 text-[16px] font-semibold">{s.title}</h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.body}</p>
        </div>
      ))}
    </div>
  );
}
