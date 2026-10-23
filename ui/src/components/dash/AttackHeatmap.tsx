import { useMemo, useState } from "react";
import type { Latest, Mode } from "../../lib/types";

const ROWS: { mode: Mode; label: string }[] = [
  { mode: "no_wall", label: "No wall" },
  { mode: "instructions_only", label: "Rules in the prompt" },
  { mode: "glass_wall", label: "Glass Wall" },
];
const PER_ROW = 20;

/** One rounded square per attack, a block per setup; brighter purple = more of its runs leaked (all models).
 *  Hover/focus shows the attack instantly in a fixed info line (the browser's title tooltip is slow). */
export function AttackHeatmap({ data }: { data: Latest }) {
  const [hover, setHover] = useState<string | null>(null);
  const attacks = useMemo(
    () => [...new Set(data.cases.filter((c) => c.kind === "attack").map((c) => c.case_id))].sort(),
    [data],
  );
  // precompute every cell once instead of filtering on each render
  const cells = useMemo(() => {
    const m = new Map<string, { runs: number; leaked: number; title: string }>();
    for (const c of data.cases) {
      if (c.kind !== "attack") continue;
      const k = `${c.case_id}|${c.mode}`;
      const cur = m.get(k) ?? { runs: 0, leaked: 0, title: c.title };
      m.set(k, { runs: cur.runs + c.runs, leaked: cur.leaked + c.leaked, title: cur.title });
    }
    return m;
  }, [data]);
  const shade = (f: number) =>
    f === 0 ? "bg-white/[0.06]" : f < 0.34 ? "bg-purple-800" : f < 0.67 ? "bg-purple-600" : "bg-purple-400 shadow-[0_0_10px_rgba(181,119,243,.45)]";

  return (
    <div>
      <div className="space-y-4">
        {ROWS.map((r) => {
          const leakedTypes = attacks.filter((id) => (cells.get(`${id}|${r.mode}`)?.leaked ?? 0) > 0).length;
          return (
            <div key={r.mode}>
              <p className="mb-2 flex justify-between text-[12px] text-slate-400">
                <span className={r.mode === "glass_wall" ? "text-purple-300" : ""}>{r.label}</span>
                <span>{leakedTypes} of {attacks.length} attack types leaked at least once</span>
              </p>
              <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${PER_ROW}, minmax(0, 1fr))` }}>
                {attacks.map((id) => {
                  const c = cells.get(`${id}|${r.mode}`) ?? { runs: 0, leaked: 0, title: id };
                  const info = `${id} · ${c.title} · ${r.label}: ${c.runs ? `${c.leaked} of ${c.runs} runs leaked` : "not run"}`;
                  return (
                    <button key={id} type="button" aria-label={info}
                            onMouseEnter={() => setHover(info)} onMouseLeave={() => setHover(null)}
                            onFocus={() => setHover(info)} onBlur={() => setHover(null)}
                            className={`aspect-square rounded-[6px] transition-transform hover:scale-110 focus-visible:scale-110 ${
                              c.runs ? shade(c.leaked / c.runs) : "border border-white/[0.06]"} ${hover === info ? "ring-2 ring-white/70" : ""}`} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 min-h-[36px] rounded-lg bg-white/[0.04] px-3 py-2 text-[13px] text-slate-300" aria-live="polite">
        {hover ?? `${attacks[0]} – ${attacks[attacks.length - 1]}. Hover a square to see the attack.`}
      </p>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[12px] text-slate-500">
        none <span className="h-3 w-3 rounded-[3px] bg-white/[0.08]" /><span className="h-3 w-3 rounded-[3px] bg-purple-800" />
        <span className="h-3 w-3 rounded-[3px] bg-purple-600" /><span className="h-3 w-3 rounded-[3px] bg-purple-400" /> every run leaked
      </div>
    </div>
  );
}
