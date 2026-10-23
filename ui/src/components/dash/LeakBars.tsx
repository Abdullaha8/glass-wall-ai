import { useState } from "react";
import type { Latest, Mode } from "../../lib/types";
import { BigNumber } from "./Card";

const FAMILIES: [string, string][] = [
  ["indirect_injection", "Injection hidden in data"],
  ["direct_social_engineering", "Social engineering"],
  ["encoded_exfiltration", "Encoded exfiltration"],
  ["wall_bypass", "SQL bypass"],
  ["multi_step", "Multi-step"],
];
const GROUPS: { mode: Mode; label: string }[] = [
  { mode: "no_wall", label: "No wall" },
  { mode: "instructions_only", label: "Rules in the prompt" },
  { mode: "glass_wall", label: "Glass Wall" },
];

/** Per setup: one thick bar per attack family on a full-height track (a gauge), and the overall rate as a big number.
 *  Hover/focus details go to a fixed info line inside the card: instant, never clipped, no layout shift. */
export function LeakBars({ data }: { data: Latest }) {
  const [hover, setHover] = useState<string | null>(null);
  const groups = GROUPS.map(({ mode, label }) => {
    let runs = 0, leaks = 0;
    const fam: Record<string, [number, number]> = {};
    for (const s of Object.values(data.summary)) {
      const m = s[mode];
      if (!m) continue;
      runs += m.attack_runs;
      leaks += m.attack_leak_runs;
      for (const [f, v] of Object.entries(m.by_family)) {
        const [r, l] = fam[f] ?? [0, 0];
        fam[f] = [r + v.runs, l + v.leak_runs];
      }
    }
    const bars = FAMILIES.map(([f, name]) => {
      const [r, l] = fam[f] ?? [0, 0];
      const pct = r ? (100 * l) / r : null;
      const info = `${name} · ${label}: ${pct == null ? "not run" : `${l} of ${r} attacks leaked (${Math.round(pct)}%)`}`;
      return { f, name, runs: r, leaks: l, pct, info };
    });
    return { mode, label, rate: runs ? (100 * leaks) / runs : 0, runs, leaks, bars };
  });

  return (
    <div>
      <div className="grid grid-cols-3 gap-6">
        {groups.map((g) => {
          const wall = g.mode === "glass_wall";
          return (
            <div key={g.mode} className="min-w-0">
              <p className={`flex items-center gap-1 text-[12px] ${wall ? "text-purple-300" : "text-slate-300"}`}>
                {g.label} <span aria-hidden>{wall ? "↘" : "↗"}</span>
              </p>
              <div className="mt-3 flex h-[130px] items-stretch gap-[7px]">
                {g.bars.map((b) => (
                  <button key={b.f} type="button" aria-label={b.info}
                          onMouseEnter={() => setHover(b.info)} onMouseLeave={() => setHover(null)}
                          onFocus={() => setHover(b.info)} onBlur={() => setHover(null)}
                          className={`flex min-w-0 flex-1 flex-col justify-end rounded-full bg-white/[0.05] transition-[background-color,box-shadow] ${
                            hover === b.info ? "bg-white/[0.12] ring-1 ring-purple-300/60" : ""}`}>
                    {b.pct != null && (
                      <span className={`block w-full rounded-full ${wall ? "bg-gradient-to-t from-purple-600 to-purple-300" : "bg-gradient-to-t from-slate-500 to-slate-200"}`}
                            style={{ height: `${Math.max(7, b.pct)}%`, boxShadow: wall ? "0 0 14px rgba(181,119,243,.6)" : undefined }} />
                    )}
                  </button>
                ))}
              </div>
              <BigNumber className="mt-5" value={`${Math.round(g.rate)}%`} label={`${g.leaks} of ${g.runs} attacks leaked`} />
            </div>
          );
        })}
      </div>
      <p className="mt-5 min-h-[36px] rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-slate-300" aria-live="polite">
        {hover ?? `Bars, left to right: ${FAMILIES.map(([, n]) => n.toLowerCase()).join(" · ")}. Hover a bar for its numbers.`}
      </p>
    </div>
  );
}
