import { useEffect, useRef } from "react";
import { MODE_LABEL, plainDetail, shortModel, type Mode, type TelemetryEvent } from "../lib/types";
import { StatusBadge } from "./Status";

export function EventDrawer({ event, onClose, onReplay, replayMode }: {
  event: TelemetryEvent | null;
  onClose: () => void;
  onReplay?: (query: string) => void;
  replayMode: Mode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!event) return;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [event, onClose]);

  if (!event) return null;
  const rows: [string, string | number | null | undefined][] = [
    ["Event", event.event_type],
    ["Mode", MODE_LABEL[event.mode] ?? event.mode],
    ["Model", shortModel(event.model)],
    ["DB role", event.role],
    ["Tool", event.tool],
    ["Rows", event.row_count],
    ["Tokens in result", event.token_count],
    ["PII patterns", event.pii_pattern_count],
    ["Duration", `${event.duration_ms} ms`],
    ["Query hash", event.query_hash],
    ["Run", event.run_id],
    ["Recipient", event.recipient],
    ["Originally flagged", event.original_color_tag
      ? `${event.original_color_tag} by the live pattern check; the exact scorer found no real values` : undefined],
  ];

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/20" onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label="Event details" tabIndex={-1}
           onClick={(e) => e.stopPropagation()}
           className="h-full w-full max-w-md overflow-y-auto border-l border-line bg-surface p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <StatusBadge color={event.color_tag} />
            <p className="mt-1 text-[14px] font-medium">{plainDetail(event.detail)}</p>
            <p className="font-mono text-[12px] text-muted">{event.timestamp}</p>
          </div>
          <button onClick={onClose} className="rounded border border-line px-2 py-1 text-[12px]">Close</button>
        </div>

        {event.query && (
          <>
            <h3 className="mt-4 text-[12px] font-medium text-muted">SQL written by the agent</h3>
            <pre className="mt-1 whitespace-pre-wrap rounded bg-surface-2 p-2 font-mono text-[12px]">{event.query}</pre>
            {onReplay && (
              <button onClick={() => onReplay(event.query!)}
                      className="mt-2 rounded border border-line px-3 py-1.5 text-[12px] font-medium hover:bg-surface-2">
                Replay this query in {MODE_LABEL[replayMode]}
              </button>
            )}
          </>
        )}

        <dl className="mt-4 grid grid-cols-[130px_1fr] gap-y-1 text-[12px]">
          {rows.filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <dd className="break-all font-mono">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
