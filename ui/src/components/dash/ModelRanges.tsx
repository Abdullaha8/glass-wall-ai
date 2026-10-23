import { shortModel, type Latest } from "../../lib/types";

/** Per model: a line from Glass Wall to No wall, with the rules-in-prompt dot between (like the reference "Trend"). */
export function ModelRanges({ data }: { data: Latest }) {
  const rows = data.models.map((m) => ({
    m,
    wall: data.summary[m]?.glass_wall?.violation_rate ?? null,
    rules: data.summary[m]?.instructions_only?.violation_rate ?? null,
    open: data.summary[m]?.no_wall?.violation_rate ?? null,
    partial: !!data.partial_models?.[m],
  }));
  const x = (v: number) => `${4 + v * 0.92}%`;

  return (
    <div>
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.m} className="grid grid-cols-[110px_minmax(0,1fr)] items-center gap-3">
            <span className="truncate text-[12px] text-slate-400">{shortModel(r.m)}{r.partial ? "*" : ""}</span>
            <div className="relative h-4" role="img"
                 aria-label={`${shortModel(r.m)}: Glass Wall ${r.wall ?? "n/a"}%, rules ${r.rules ?? "n/a"}%, no wall ${r.open ?? "n/a"}%`}>
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/[0.06]" />
              {r.wall != null && r.open != null && (
                <div className="absolute top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-purple-400 to-slate-500"
                     style={{ left: x(r.wall), width: `${(r.open - r.wall) * 0.92}%` }} />
              )}
              {r.open != null && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400" style={{ left: x(r.open) }} />}
              {r.rules != null && <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-300 bg-black" style={{ left: x(r.rules) }} />}
              {r.wall != null && <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-400 shadow-[0_0_12px_rgba(181,119,243,.8)]" style={{ left: x(r.wall) }} />}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 grid grid-cols-[110px_minmax(0,1fr)] gap-3 text-[11px] text-slate-500">
        <span />
        <div className="flex justify-between"><span>0%</span><span>50%</span><span>100% leaked</span></div>
      </div>
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-400">
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-400" />Glass Wall</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-slate-300" />Rules in the prompt</li>
        <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" />No wall</li>
      </ul>
    </div>
  );
}
