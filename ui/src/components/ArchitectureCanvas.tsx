import { MODE_LABEL, type Mode, type TelemetryEvent } from "../lib/types";

const PULSE: Record<string, string> = { green: "var(--ok)", red: "var(--leak)", blue: "var(--info)", amber: "var(--warn)" };

/** Agent → MCP → [glass] → view → raw. The pane is drawn open in the baseline modes. */
export function ArchitectureCanvas({ mode, lastEvent }: { mode: Mode; lastEvent?: TelemetryEvent }) {
  const walled = mode === "glass_wall";
  const pulse = lastEvent ? PULSE[lastEvent.color_tag] : "var(--border)";
  const view = walled ? "agent.customers_v" : "agent_open.customers_v";
  const viewSub = walled ? "tokens only" : "raw values";

  const box = (x: number, title: string, sub: string, accent?: string) => (
    <g>
      <rect x={x} y={44} width={150} height={56} rx={4} fill="var(--surface)" stroke={accent ?? "var(--border)"} strokeWidth={accent ? 2 : 1} />
      <text x={x + 75} y={68} textAnchor="middle" fontSize={12} fontWeight={600} fill="var(--text)">{title}</text>
      <text x={x + 75} y={86} textAnchor="middle" fontSize={11} fontFamily="var(--font-mono)" fill="var(--text-muted)">{sub}</text>
    </g>
  );

  return (
    <figure className="rounded border border-line bg-surface p-3">
      <figcaption className="mb-1 flex items-center justify-between text-[12px] text-muted">
        <span className="font-medium">Data path · {MODE_LABEL[mode]}</span>
        {lastEvent && <span className="font-mono">last: {lastEvent.event_type}</span>}
      </figcaption>
      <svg viewBox="0 0 800 150" className="h-auto w-full" role="img"
           aria-label={`Agent to MCP server to ${view}; ${walled ? "the glass wall tokenizes personal data" : "no wall: raw personal data reaches the agent"}`}>
        <defs>
          <marker id="arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L8 4L0 8z" fill="var(--text-muted)" />
          </marker>
        </defs>
        {box(4, "Agent (LLM)", "LiteLLM loop", pulse)}
        {box(186, "MCP server", walled ? "/mcp/wall" : "/mcp/open")}
        {box(460, "Postgres view", view)}
        {box(644, "raw.customers", "real PII")}

        {[[154, 184], [336, 458], [610, 642]].map(([a, b]) => (
          <line key={a} x1={a} y1={72} x2={b} y2={72} stroke="var(--text-muted)" strokeWidth={1.5} markerEnd="url(#arrow)" />
        ))}

        {/* the glass pane */}
        <g aria-hidden>
          <line x1={392} y1={28} x2={392} y2={116} stroke={walled ? "var(--ok)" : "var(--border)"} strokeWidth={2}
                strokeDasharray={walled ? undefined : "4 4"} />
          <line x1={404} y1={28} x2={404} y2={116} stroke={walled ? "var(--ok)" : "var(--border)"} strokeWidth={2}
                strokeDasharray={walled ? undefined : "4 4"} />
          {walled && [44, 66, 88].map((y) => <line key={y} x1={392} y1={y + 8} x2={404} y2={y} stroke="var(--ok)" strokeWidth={1} />)}
          <text x={398} y={136} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
            {walled ? "glass wall: grants + tokens" : "no wall"}
          </text>
        </g>
        <text x={535} y={122} textAnchor="middle" fontSize={11} fill={walled ? "var(--ok)" : "var(--leak)"}>{viewSub}</text>
      </svg>
    </figure>
  );
}
