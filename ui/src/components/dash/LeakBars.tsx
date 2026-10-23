import type { Latest, Mode } from "../../lib/types";
import { BigNumber } from "./Card";

const GROUPS: { mode: Mode; label: string }[] = [
  { mode: "no_wall", label: "No wall" },
  { mode: "instructions_only", label: "Rules in the prompt" },
  { mode: "glass_wall", label: "Glass Wall" },
];

/** Per setup: one slim bar per attack type (share of its runs that leaked), and the overall rate as a big number. */
export function LeakBars({ data }: { data: Latest }) {
  const attacks = [...new Set(data.cases.filter((c) => c.kind === "attack").map((c) => c.case_id))].sort();
  const groups = GROUPS.map(({ mode, label }) => {
    let runs = 0, leaks = 0;
    for (const s of Object.values(data.summary)) {
      runs += s[mode]?.attack_runs ?? 0;
      leaks += s[mode]?.attack_leak_runs ?? 0;
    }
    const bars = attacks.map((id) => {
      const cs = data.cases.filter((c) => c.case_id === id && c.mode === mode);
      const r = cs.reduce((n, c) => n + c.runs, 0);
      const l = cs.reduce((n, c) => n + c.leaked, 0);
      return { id, title: cs[0]?.title ?? id, runs: r, pct: r ? (100 * l) / r : null };
    });
    return { mode, label, rate: runs ? (100 * leaks) / runs : 0, runs, leaks, bars };
  });

  return (
    <div className="grid grid-cols-3 gap-5">
      {groups.map((g) => {
        const wall = g.mode === "glass_wall";
        return (
          <div key={g.mode} className="min-w-0">
            <p className={`flex items-center gap-1 text-[12px] ${wall ? "text-purple-300" : "text-slate-300"}`}>
              {g.label} <span aria-hidden>{wall ? "↘" : "↗"}</span>
            </p>
            <div className="mt-3 flex h-[130px] items-end gap-[2px]" role="img"
                 aria-label={`${g.label}: ${Math.round(g.rate)}% of attacks leaked`}>
              {g.bars.map((b) => (
                <div key={b.id} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
                  <div className={`w-full rounded-full ${b.pct == null ? "bg-white/[0.05]" : wall ? "bg-purple-400" : b.pct >= 50 ? "bg-slate-300/80" : b.pct > 0 ? "bg-slate-500" : "bg-slate-700"}`}
                       style={{ height: b.pct == null ? "3%" : `${Math.max(4, b.pct)}%`, boxShadow: wall && b.pct != null ? "0 0 8px rgba(181,119,243,.55)" : undefined }} />
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black px-2 py-1 text-[11px] text-white group-hover:block">
                    {b.id} · {b.title}: {b.pct == null ? "not run" : `${Math.round(b.pct)}% of ${b.runs}`}
                  </span>
                </div>
              ))}
            </div>
            <BigNumber className="mt-5" value={`${Math.round(g.rate)}%`} label={`${g.leaks} of ${g.runs} attacks leaked`} />
          </div>
        );
      })}
    </div>
  );
}
