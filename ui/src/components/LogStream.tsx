import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { shortModel, type Color, type TelemetryEvent } from "../lib/types";
import { STATUS } from "./Status";

const COLORS: Color[] = ["red", "amber", "green", "blue"];

function time(ts: string) {
  return ts.slice(11, 23);
}

export function LogStream({ events, onSelect, selectedIndex, empty = "No events yet." }: {
  events: TelemetryEvent[];
  onSelect: (i: number) => void;
  selectedIndex: number | null;
  empty?: string;
}) {
  const [hidden, setHidden] = useState<Set<Color>>(new Set());
  const [paused, setPaused] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const rows = events.map((e, i) => ({ e, i })).filter(({ e }) => !hidden.has(e.color_tag));

  useEffect(() => {
    // scroll the log box itself; scrollIntoView would drag the whole page down to the log
    if (!paused && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [events.length, paused]);

  const toggle = (c: Color) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });

  const onKey = (ev: KeyboardEvent) => {
    if (!rows.length) return;
    const pos = rows.findIndex((r) => r.i === selectedIndex);
    if (ev.key === "ArrowDown") onSelect(rows[Math.min(rows.length - 1, pos + 1)].i);
    else if (ev.key === "ArrowUp") onSelect(rows[Math.max(0, pos - 1)].i);
    else return;
    ev.preventDefault();
  };

  return (
    <section className="rounded-xl border border-line bg-surface" aria-label="Live log stream">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <h2 className="text-[13px] font-semibold">Telemetry</h2>
        <span className="text-[12px] text-muted">{events.length} events</span>
        <div className="ml-auto flex flex-wrap gap-1">
          {COLORS.map((c) => (
            <button key={c} onClick={() => toggle(c)} aria-pressed={!hidden.has(c)}
                    className={`rounded border border-line px-2 py-0.5 font-mono text-[11px] ${hidden.has(c) ? "text-muted line-through" : STATUS[c].text}`}>
              {STATUS[c].glyph} {STATUS[c].label}
            </button>
          ))}
          <button onClick={() => setPaused((p) => !p)} aria-pressed={paused}
                  className="rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink">
            {paused ? "Resume scroll" : "Pause scroll"}
          </button>
        </div>
      </div>
      <div ref={box} role="log" aria-live="polite" tabIndex={0} onKeyDown={onKey}
           className="h-[300px] overflow-y-auto font-mono text-[12px] focus-visible:outline-offset-[-2px]">
        {rows.length === 0 && <p className="px-3 py-6 text-center font-sans text-[13px] text-muted">{empty}</p>}
        {rows.map(({ e, i }) => {
          const s = STATUS[e.color_tag];
          const selected = i === selectedIndex;
          return (
            <button key={i} onClick={() => onSelect(i)} aria-current={selected}
                    className={`grid w-full grid-cols-[88px_62px_minmax(0,1fr)] items-baseline gap-x-2 gap-y-0.5 border-b border-line/60 px-3 py-1.5 text-left sm:py-1 sm:grid-cols-[88px_62px_118px_110px_96px_minmax(0,1fr)] ${selected ? "bg-surface-2" : e.color_tag === "red" ? s.tint : "hover:bg-surface-2"}`}>
              <span className="text-muted">{time(e.timestamp)}</span>
              <span className={s.text}><span aria-hidden>{s.glyph}</span> {s.label}</span>
              <span className="hidden truncate sm:block">{e.mode}</span>
              <span className="hidden truncate text-muted sm:block">{shortModel(e.model)}</span>
              <span className="truncate text-muted sm:text-ink">{e.tool ?? e.event_type}</span>
              <span className="col-span-3 line-clamp-2 break-words sm:col-span-1 sm:truncate">{e.detail}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
