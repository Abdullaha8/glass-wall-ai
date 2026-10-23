import { useMemo, useState } from "react";
import { MODE_LABEL, shortModel, type OutboxMessage } from "../lib/types";
import { StatusBadge } from "./Status";

const REVIEW_LABEL = { unreviewed: "Unreviewed", confirmed_leak: "Confirmed leak", false_positive: "False positive" } as const;

export function OutboxInspector({ messages, onReview, note }: {
  messages: OutboxMessage[];
  onReview?: (id: number, review: OutboxMessage["review"]) => void;
  note?: string;
}) {
  const [query, setQuery] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const shown = useMemo(() => {
    const q = query.toLowerCase();
    return messages.filter((m) => (!flaggedOnly || m.pii_suspected) &&
      (!q || [m.recipient, m.run_id, m.mode, m.model, m.body].some((f) => f.toLowerCase().includes(q))));
  }, [messages, query, flaggedOnly]);

  return (
    <section className="rounded border border-line bg-surface" aria-label="Outbox inspector">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="text-[13px] font-semibold">Outbox</h2>
        <span className="text-[12px] text-muted">what an attacker's inbox would have received · nothing is actually sent</span>
        <div className="ml-auto flex items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recipient, run, text…"
                 aria-label="Search outbox"
                 className="w-48 rounded border border-line bg-surface-2 px-2 py-1 text-[12px]" />
          <label className="flex items-center gap-1 text-[12px] text-muted">
            <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
            flagged only
          </label>
        </div>
      </div>
      {note && <p className="border-b border-line px-3 py-1.5 text-[12px] text-muted">{note}</p>}
      <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
        {shown.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-muted">No messages.</li>}
        {shown.map((m) => (
          <li key={`${m.run_id}-${m.id}`} className={`px-3 py-2 ${m.pii_suspected ? "bg-leak-tint" : ""}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
              <StatusBadge color={m.pii_suspected ? "red" : m.token_count ? "green" : "blue"}
                           label={m.pii_suspected ? "PII PATTERNS" : m.token_count ? "TOKENS ONLY" : "NO PII"} />
              <span className="font-mono">→ {m.recipient}</span>
              <span className="text-muted">{MODE_LABEL[m.mode] ?? m.mode} · {shortModel(m.model)}{m.case_id ? ` · ${m.case_id}` : ""}</span>
              <span className="ml-auto text-muted">{m.token_count} tokens</span>
            </div>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words font-mono text-[12px]">{m.body}</p>
            {onReview && (
              <div className="mt-1 flex gap-1" role="group" aria-label="Review">
                {(Object.keys(REVIEW_LABEL) as OutboxMessage["review"][]).map((r) => (
                  <button key={r} onClick={() => onReview(m.id, r)} aria-pressed={m.review === r}
                          className={`rounded border px-2 py-0.5 text-[11px] ${m.review === r ? "border-ink text-ink" : "border-line text-muted"}`}>
                    {REVIEW_LABEL[r]}
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
