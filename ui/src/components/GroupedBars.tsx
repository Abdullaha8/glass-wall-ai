import { useState } from "react";
import { MODES, MODE_LABEL, MODE_VAR, shortModel, type Mode } from "../lib/types";

type Values = Record<string, Partial<Record<Mode, number | null>>>;

/**
 * Grouped bars: x = model, series = mode (categorical, fixed order).
 * Marks: 4px rounded data-ends on the baseline, 2px gaps, value labels on every
 * bar (relief for the low-contrast aqua slot), hover tooltip, legend above.
 */
export function GroupedBars({ title, subtitle, values, models, label = shortModel }: {
  title: string;
  subtitle: string;
  values: Values;
  models: string[];
  label?: (model: string) => string;
}) {
  const [hover, setHover] = useState<{ model: string; mode: Mode; x: number; y: number } | null>(null);
  const W = 520, H = 210, left = 36, right = 8, top = 22, bottom = 30;
  const plotW = W - left - right, plotH = H - top - bottom;
  const groupW = plotW / Math.max(models.length, 1);
  const barW = Math.min(34, (groupW - 28) / 3);
  const y = (v: number) => top + plotH - (v / 100) * plotH;

  const bar = (x: number, v: number) => {
    const h = Math.max((v / 100) * plotH, 0);
    const r = Math.min(4, h);
    const b = top + plotH;
    return `M${x},${b} V${b - h + r} Q${x},${b - h} ${x + r},${b - h} H${x + barW - r} Q${x + barW},${b - h} ${x + barW},${b - h + r} V${b} Z`;
  };

  return (
    <figure className="relative rounded-xl border border-line bg-surface p-3">
      <figcaption>
        <h3 className="text-[13px] font-semibold">{title}</h3>
        <p className="text-[12px] text-muted">{subtitle}</p>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]" aria-label="Legend">
          {MODES.map((m) => (
            <li key={m} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MODE_VAR[m] }} aria-hidden />
              {MODE_LABEL[m]}
            </li>
          ))}
        </ul>
      </figcaption>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full" role="img"
           aria-label={`${title}: ${models.map((md) => `${shortModel(md)} ${MODES.map((m) => `${MODE_LABEL[m]} ${values[md]?.[m] ?? "n/a"}%`).join(", ")}`).join("; ")}`}>
        {[0, 25, 50, 75, 100].map((t) => (
          <g key={t}>
            <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1 : 0.5} />
            <text x={left - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">{t}%</text>
          </g>
        ))}
        {models.map((md, gi) => {
          const gx = left + gi * groupW + (groupW - (3 * barW + 4)) / 2;
          if (MODES.every((m) => values[md]?.[m] == null)) {
            return (
              <g key={md}>
                <text x={left + gi * groupW + groupW / 2} y={top + plotH / 2} textAnchor="middle" fontSize={11} fill="var(--text-muted)">not run yet</text>
                <text x={left + gi * groupW + groupW / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{label(md)}</text>
              </g>
            );
          }
          return (
            <g key={md}>
              {MODES.map((m, si) => {
                const v = values[md]?.[m];
                const x = gx + si * (barW + 2);
                if (v == null) {
                  return <text key={m} x={x + barW / 2} y={top + plotH - 4} textAnchor="middle" fontSize={10} fill="var(--text-muted)">–</text>;
                }
                return (
                  <g key={m} onMouseEnter={() => setHover({ model: md, mode: m, x: x + barW / 2, y: y(v) })}
                     onMouseLeave={() => setHover(null)}>
                    {/* hit target taller than the mark */}
                    <rect x={x - 1} y={top} width={barW + 2} height={plotH} fill="transparent" />
                    <path d={bar(x, v)} fill={MODE_VAR[m]} opacity={hover && (hover.model !== md || hover.mode !== m) ? 0.45 : 1} />
                    {v === 0 && <rect x={x} y={top + plotH - 2} width={barW} height={2} fill={MODE_VAR[m]} />}
                    <text x={x + barW / 2} y={y(v) - 5} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text)">
                      {Math.round(v)}
                    </text>
                  </g>
                );
              })}
              <text x={left + gi * groupW + groupW / 2} y={H - 10} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
                {label(md)}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && (
        <div role="tooltip"
             className="pointer-events-none absolute z-10 rounded-xl border border-line bg-surface px-2 py-1 text-[12px] shadow"
             style={{ left: `calc(${(hover.x / W) * 100}% + 12px)`, top: `${(hover.y / H) * 100}%` }}>
          <div className="font-medium">{label(hover.model)} · {MODE_LABEL[hover.mode]}</div>
          <div className="font-mono">{values[hover.model]?.[hover.mode]}%</div>
        </div>
      )}
    </figure>
  );
}
