import { MODE_LABEL, type Color, type Mode, type TelemetryEvent } from "../lib/types";

const TONE: Record<Color, string> = { green: "var(--ok)", red: "var(--leak)", blue: "var(--info)", amber: "var(--warn)" };

type NodeId = "agent" | "gate" | "view" | "db" | "outbox";
const BOX = { w: 156, h: 54 };
const POS: Record<NodeId, { x: number; y: number }> = {
  agent: { x: 8, y: 34 },
  gate: { x: 202, y: 34 },
  view: { x: 452, y: 34 },
  db: { x: 640, y: 34 },
  outbox: { x: 8, y: 132 },
};
const GLASS_X = 404;
const mid = (n: NodeId) => ({ x: POS[n].x + BOX.w / 2, y: POS[n].y + BOX.h / 2 });

/** Which boxes light up, where the moving dot travels, and a one-line explanation. */
function describe(e: TelemetryEvent | undefined, walled: boolean): {
  active: NodeId[]; glass: boolean; dot?: string; color: string; text: string;
} {
  const y = mid("agent").y;
  const right = (to: number) => `M${mid("agent").x},${y} H${to}`;
  if (!e) return { active: [], glass: false, color: TONE.blue, text: walled
    ? "With the wall on, every answer the agent gets carries tokens. The real values never leave the database."
    : "Without a wall, the agent's queries return real names, emails and phone numbers." };
  const color = TONE[e.color_tag];
  switch (e.event_type) {
    case "query_ok": {
      const what = e.color_tag === "red" ? "got back REAL personal data (names, emails or phone numbers)."
        : e.color_tag === "green" ? "got back tokens only. No real personal data reached it."
        : "got back numbers only, with no personal fields.";
      return { active: ["agent", "gate", "view", "db"], glass: walled, color,
               dot: `M${mid("db").x},${y} H${POS.agent.x + BOX.w + 8}`, text: `The agent asked the database and ${what}` };
    }
    case "query_blocked":
      return { active: ["agent", "gate"], glass: false, color, dot: right(POS.gate.x + BOX.w - 6),
               text: "The gatekeeper refused the query before it reached the database." };
    case "query_denied":
      return { active: ["agent", "gate"], glass: true, color, dot: right(GLASS_X),
               text: "The database itself refused the query. The wall held." };
    case "query_error":
      return { active: ["agent", "gate"], glass: false, color, dot: right(POS.gate.x + BOX.w - 6),
               text: "The query failed because of a mistake in the agent's SQL. Nothing was returned." };
    case "message_recorded":
      return { active: ["agent", "outbox"], glass: false, color,
               dot: `M${mid("agent").x},${POS.agent.y + BOX.h} V${POS.outbox.y + 4}`,
               text: e.color_tag === "red" ? `The agent sent a message to "${e.recipient ?? "someone"}" containing real personal data.`
                 : e.original_color_tag ? "The quick check flagged this message, but the exact check found no real data in it."
                 : `The agent sent a message to "${e.recipient ?? "someone"}". It holds tokens, not people.` };
    case "run_started":
      return { active: ["agent"], glass: false, color: TONE.blue, text: "The agent received a request and is deciding what to do." };
    case "run_finished":
      return { active: ["agent"], glass: false, color: TONE.blue, text: "The agent finished and gave its answer." };
    default:
      return { active: ["agent"], glass: false, color, text: e.detail };
  }
}

export function ArchitectureCanvas({ mode, lastEvent }: { mode: Mode; lastEvent?: TelemetryEvent }) {
  const walled = mode === "glass_wall";
  const d = describe(lastEvent, walled);
  const on = (n: NodeId) => d.active.includes(n);

  const node = (id: NodeId, title: string, sub: string, subColor?: string) => {
    const { x, y } = POS[id];
    return (
      <g key={id} style={{ transition: "opacity .3s" }} opacity={d.active.length && !on(id) ? 0.55 : 1}>
        <rect x={x} y={y} width={BOX.w} height={BOX.h} rx={6} fill="var(--surface)"
              stroke={on(id) ? d.color : "var(--border)"} strokeWidth={on(id) ? 2.5 : 1} />
        {on(id) && <rect x={x} y={y} width={BOX.w} height={BOX.h} rx={6} fill={d.color} opacity={0.08} />}
        <text x={x + BOX.w / 2} y={y + 23} textAnchor="middle" fontSize={13} fontWeight={600} fill="var(--text)">{title}</text>
        <text x={x + BOX.w / 2} y={y + 41} textAnchor="middle" fontSize={11} fill={subColor ?? "var(--text-muted)"}>{sub}</text>
      </g>
    );
  };
  const link = (x1: number, x2: number, active: boolean) => (
    <line x1={x1} y1={mid("agent").y} x2={x2} y2={mid("agent").y} markerEnd="url(#gw-arrow)"
          stroke={active ? d.color : "var(--text-muted)"} strokeWidth={active ? 2 : 1.2} opacity={active ? 1 : 0.6} />
  );
  const glassColor = d.glass ? (lastEvent?.event_type === "query_denied" ? TONE.amber : TONE.green) : walled ? "var(--ok)" : "var(--border)";

  return (
    <figure className="rounded-xl border border-line bg-surface p-3">
      <figcaption className="mb-1 flex items-center justify-between text-[12px] text-muted">
        <span className="font-medium">How the data flows · {MODE_LABEL[mode]}</span>
        <span>{walled ? "Glass wall ON" : "No wall: the agent can see real data"}</span>
      </figcaption>
      <svg viewBox="0 0 804 196" className="h-auto w-full" role="img" aria-label={d.text}>
        <defs>
          <marker id="gw-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L8 4L0 8z" fill="var(--text-muted)" />
          </marker>
        </defs>

        {node("agent", "AI agent", "an LLM such as Gemini")}
        {node("gate", "Gatekeeper", "our MCP server")}
        {node("view", walled ? "Safe view" : "Open view", walled ? "tokens only" : "real data", walled ? "var(--ok)" : "var(--leak)")}
        {node("db", "Customer database", "real names, emails, phones")}
        {node("outbox", "Outbox", "what an attacker would get")}

        {link(POS.agent.x + BOX.w, POS.gate.x - 2, on("gate"))}
        {link(POS.gate.x + BOX.w, POS.view.x - 2, on("view"))}
        {link(POS.view.x + BOX.w, POS.db.x - 2, on("db"))}
        <line x1={mid("agent").x} y1={POS.agent.y + BOX.h} x2={mid("agent").x} y2={POS.outbox.y - 2} markerEnd="url(#gw-arrow)"
              stroke={on("outbox") ? d.color : "var(--text-muted)"} strokeWidth={on("outbox") ? 2 : 1.2} opacity={on("outbox") ? 1 : 0.6} />

        {/* the glass pane */}
        <g aria-hidden>
          {[GLASS_X - 6, GLASS_X + 6].map((x) => (
            <line key={x} x1={x} y1={14} x2={x} y2={110} stroke={glassColor} strokeWidth={d.glass ? 3 : 2}
                  strokeDasharray={walled ? undefined : "4 4"} />
          ))}
          {walled && [26, 52, 78].map((y) => <line key={y} x1={GLASS_X - 6} y1={y + 10} x2={GLASS_X + 6} y2={y} stroke={glassColor} strokeWidth={1} />)}
          <text x={GLASS_X} y={128} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{walled ? "glass wall" : "no wall"}</text>
        </g>

        {/* a dot carrying the request or the data along the path; restarts on every event */}
        {d.dot && (
          <circle key={lastEvent?.timestamp + (lastEvent?.event_type ?? "")} r={7} fill={d.color} stroke="var(--surface)" strokeWidth={2}>
            <animateMotion dur="1.1s" fill="freeze" path={d.dot} />
          </circle>
        )}

        <text x={190} y={166} fontSize={13} fill="var(--text)" fontWeight={500}>{d.text}</text>
      </svg>
    </figure>
  );
}
