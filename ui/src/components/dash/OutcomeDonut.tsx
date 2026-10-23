import { useState } from "react";

export interface Outcomes { blocked: number; refused: number; tokens_only: number; leaked: number }

/** How attacks ended in one setup. Purple = safe outcomes; red = real data leaked.
 *  Hovering or tapping a legend row or an arc highlights the other; the centre shows the active slice. */
export function OutcomeDonut({ outcomes, walled }: { outcomes: Outcomes; walled: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const items = walled
    ? [
        { key: "tokens_only", label: "answered with tokens only", value: outcomes.tokens_only, color: "#b577f3" },
        { key: "blocked", label: "blocked by the database", value: outcomes.blocked, color: "#6a2ea3" },
        { key: "refused", label: "refused by the model", value: outcomes.refused, color: "#3a3446" },
        { key: "leaked", label: "leaked real data", value: outcomes.leaked, color: "#f07a70" },
      ]
    : [
        { key: "leaked", label: "leaked real data", value: outcomes.leaked, color: "#f07a70" },
        { key: "tokens_only", label: "answered without leaking", value: outcomes.tokens_only, color: "#6e6680" },
        { key: "refused", label: "refused by the model", value: outcomes.refused, color: "#3a3446" },
        { key: "blocked", label: "blocked by the database", value: outcomes.blocked, color: "#6a2ea3" },
      ];
  const total = items.reduce((n, i) => n + i.value, 0) || 1;
  const R = 70, C = 2 * Math.PI * R;
  let offset = 0;
  const cur = items.find((i) => i.key === active);
  const pick = (k: string) => ({
    onMouseEnter: () => setActive(k), onMouseLeave: () => setActive(null),
    onFocus: () => setActive(k), onBlur: () => setActive(null),
    onClick: () => setActive(k),
  });

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_170px] items-center gap-4">
      <ul className="space-y-2">
        {items.map((i, idx) => (
          <li key={i.key}>
           <button type="button" {...pick(i.key)} aria-pressed={active === i.key}
                   className={`w-full rounded-xl px-3 py-2 text-left transition ${
                     active === i.key || (!active && idx === 0) ? "bg-white/[0.06] ring-1 ring-white/10" : ""} ${
                     active && active !== i.key ? "opacity-40" : ""}`}>
            <p className="flex items-center gap-2 text-[24px] font-light leading-none tracking-[-0.02em] text-white">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: i.color }} aria-hidden />
              {i.value}
            </p>
            <p className="mt-1 pl-4 text-[12px] text-slate-400">{i.label}</p>
           </button>
          </li>
        ))}
      </ul>
      <svg viewBox="0 0 180 180" className="h-auto w-full" role="img" aria-label={items.map((i) => `${i.value} ${i.label}`).join(", ")}>
        <defs>
          <linearGradient id="donut-purple" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#dcc2fb" /><stop offset="1" stopColor="#9d55e6" />
          </linearGradient>
          <linearGradient id="donut-red" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffb3ab" /><stop offset="1" stopColor="#e2554a" />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={R} fill="none" stroke="#1d1a24" strokeWidth={34} />
        {items.map((i, idx) => {
          const len = (i.value / total) * C;
          const stroke = idx === 0 ? (walled ? "url(#donut-purple)" : "url(#donut-red)") : i.color;
          const on = active === i.key;
          const el = len > 0 && (
            <circle key={i.key} cx="90" cy="90" r={R} fill="none" stroke={stroke} strokeWidth={on ? 42 : 34}
                    strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-offset} transform="rotate(-90 90 90)"
                    {...pick(i.key)} className="cursor-pointer outline-none transition-[stroke-width,opacity] duration-200"
                    opacity={active && !on ? 0.25 : 1}
                    style={on ? { filter: `drop-shadow(0 0 6px ${i.color})` } : undefined} />
          );
          offset += len;
          return el;
        })}
        {cur ? (<>
          <text x="90" y="86" textAnchor="middle" fill="#fff" fontSize="28" fontWeight={300}>{Math.round((100 * cur.value) / total)}%</text>
          <text x="90" y="106" textAnchor="middle" fill="#a69fb5" fontSize="11">{cur.key === "tokens_only" ? (walled ? "tokens only" : "no leak") : cur.key}</text>
        </>) : (<>
          <text x="90" y="86" textAnchor="middle" fill={outcomes.leaked ? "#ff8a80" : "#fff"} fontSize="28" fontWeight={300}>{outcomes.leaked}</text>
          <text x="90" y="106" textAnchor="middle" fill="#a69fb5" fontSize="11">leaks</text>
        </>)}
      </svg>
    </div>
  );
}
