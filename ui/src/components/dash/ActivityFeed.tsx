import { MODE_LABEL, shortModel, type TelemetryEvent } from "../../lib/types";

const TITLE: Record<string, (e: TelemetryEvent) => string> = {
  query_ok: (e) => (e.color_tag === "red" ? "Real data returned" : e.color_tag === "green" ? "Tokens returned" : "Query answered"),
  query_blocked: () => "Query blocked",
  query_denied: () => "Database refused",
  query_error: () => "Query failed",
  message_recorded: (e) => (e.color_tag === "red" ? `Leak sent to ${e.recipient ?? "?"}` : `Message to ${e.recipient ?? "?"}`),
};
const DOT: Record<string, string> = { red: "bg-[#f07a70]", green: "bg-purple-400", amber: "bg-[#e0a548]", blue: "bg-slate-500" };

/** The most recent meaningful events (queries, blocks, messages), newest first. */
export function ActivityFeed({ events, limit = 6 }: { events: TelemetryEvent[]; limit?: number }) {
  const items = events.filter((e) => e.event_type in TITLE).slice(-limit).reverse();
  if (!items.length) return <p className="text-[13px] text-slate-500">No activity yet.</p>;
  return (
    <ul className="space-y-3.5">
      {items.map((e, i) => (
        <li key={`${e.timestamp}-${i}`} className="flex gap-3">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[e.color_tag]}`} aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-[14px] text-white">{TITLE[e.event_type](e)}</p>
            <p className="truncate text-[12px] text-slate-500">
              {MODE_LABEL[e.mode] ?? e.mode} · {shortModel(e.model)} · {e.timestamp.slice(11, 19)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
