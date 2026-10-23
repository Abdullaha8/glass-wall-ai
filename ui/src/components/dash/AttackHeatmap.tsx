import type { Latest, Mode } from "../../lib/types";

const ROWS: { mode: Mode; label: string }[] = [
  { mode: "no_wall", label: "No wall" },
  { mode: "instructions_only", label: "Rules in the prompt" },
  { mode: "glass_wall", label: "Glass Wall" },
];
const PER_ROW = 20;

/** One rounded square per attack, a block per setup; brighter purple = more of its runs leaked (all models). */
export function AttackHeatmap({ data }: { data: Latest }) {
  const attacks = [...new Set(data.cases.filter((c) => c.kind === "attack").map((c) => c.case_id))].sort();
  const cell = (id: string, mode: Mode) => {
    const cs = data.cases.filter((c) => c.case_id === id && c.mode === mode);
    return { runs: cs.reduce((n, c) => n + c.runs, 0), leaked: cs.reduce((n, c) => n + c.leaked, 0), title: cs[0]?.title ?? id };
  };
  const shade = (f: number) =>
    f === 0 ? "bg-white/[0.06]" : f < 0.34 ? "bg-purple-800" : f < 0.67 ? "bg-purple-600" : "bg-purple-400 shadow-[0_0_10px_rgba(181,119,243,.45)]";

  return (
    <div>
      <div className="space-y-4">
        {ROWS.map((r) => {
          const leaked = attacks.filter((id) => cell(id, r.mode).leaked > 0).length;
          return (
            <div key={r.mode}>
              <p className="mb-2 flex justify-between text-[12px] text-slate-400">
                <span className={r.mode === "glass_wall" ? "text-purple-300" : ""}>{r.label}</span>
                <span>{leaked} of {attacks.length} attack types leaked at least once</span>
              </p>
              <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${PER_ROW}, minmax(0, 1fr))` }}>
                {attacks.map((id) => {
                  const c = cell(id, r.mode);
                  return (
                    <span key={id} title={`${id} · ${c.title} · ${r.label}: ${c.leaked} of ${c.runs} runs leaked`}
                          className={`aspect-square rounded-[6px] ${c.runs ? shade(c.leaked / c.runs) : "border border-white/[0.06]"}`} />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-slate-500">
        <span>{attacks[0]} – {attacks[attacks.length - 1]} · hover a square for the attack</span>
        <span className="flex items-center gap-1.5">
          none <span className="h-3 w-3 rounded-[3px] bg-white/[0.08]" /><span className="h-3 w-3 rounded-[3px] bg-purple-800" />
          <span className="h-3 w-3 rounded-[3px] bg-purple-600" /><span className="h-3 w-3 rounded-[3px] bg-purple-400" /> every run leaked
        </span>
      </div>
    </div>
  );
}
