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

/** Per setup: one thick bar per attack family on a full-height track (a gauge), and the overall rate as a big number. */
export function LeakBars({ data }: { data: Latest }) {
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
      return { f, name, runs: r, leaks: l, pct: r ? (100 * l) / r : null };
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
              <div className="mt-3 flex h-[130px] items-stretch gap-[7px]" role="img"
                   aria-label={`${g.label}: ${g.bars.map((b) => `${b.name} ${b.pct == null ? "not run" : Math.round(b.pct) + "%"}`).join(", ")}`}>
                {g.bars.map((b) => (
                  <div key={b.f} className="group relative flex min-w-0 flex-1 flex-col justify-end rounded-full bg-white/[0.05]">
                    {b.pct != null && (
                      <div className={`w-full rounded-full ${wall ? "bg-gradient-to-t from-purple-600 to-purple-300" : "bg-gradient-to-t from-slate-500 to-slate-200"}`}
                           style={{ height: `${Math.max(7, b.pct)}%`, boxShadow: wall ? "0 0 14px rgba(181,119,243,.6)" : undefined }} />
                    )}
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-black px-2.5 py-1.5 text-[12px] text-white shadow-lg group-hover:block">
                      {b.name}: {b.pct == null ? "not run" : `${b.leaks} of ${b.runs} leaked (${Math.round(b.pct)}%)`}
                    </span>
                  </div>
                ))}
              </div>
              <BigNumber className="mt-5" value={`${Math.round(g.rate)}%`} label={`${g.leaks} of ${g.runs} attacks leaked`} />
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-[12px] text-slate-500">
        Bars, left to right: {FAMILIES.map(([, n]) => n.toLowerCase()).join(" · ")}. Hover a bar for the numbers.
      </p>
    </div>
  );
}
