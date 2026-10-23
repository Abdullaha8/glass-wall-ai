import { useWallView } from "./GlassWall";

// Three real rows from the (fully synthetic) demo database: what each agent role actually receives.
export const ROWS = [
  { id: 2, raw: ["Anvi Konda", "anvi.konda@example.net", "+1 555 914 9732"], tok: ["tok_002b3b31", "tok_bc3e8aa5", "tok_52eb481d"], city: "Mumbai", plan: "Free" },
  { id: 9, raw: ["Rushil Saini", "rushil.saini@example.com", "555 447 9144"], tok: ["tok_8e3f6e93", "tok_3f9183c1", "tok_a26f736c"], city: "Chennai", plan: "Business" },
  { id: 15, raw: ["Gayathri Chaudry", "gayathri.chaudry@example.org", "555 019 2619"], tok: ["tok_665e6d57", "tok_d01f6c48", "tok_89047ea1"], city: "Chennai", plan: "Pro" },
];

/** One table: the same customers, real values or tokens. Driven by the wall flag, or by the side of a GlassWall it sits on.
 *  Inside a GlassWall both copies must lay out identically, so the table never scrolls sideways there (it wraps instead). */
export function BeforeAfter({ walled }: { walled: boolean }) {
  const { w, pick, inside } = useWallView(walled);
  const tone = w
    ? { ring: "ring-purple-400/40", head: "bg-purple-400/10 text-purple-200", cell: "text-purple-200" }
    : { ring: "ring-leak/40", head: "bg-leak-tint text-leak", cell: "text-leak" };
  const pad = "px-5";
    return (
    <div className={`overflow-hidden rounded-2xl bg-surface ring-1 transition-colors duration-300 ${tone.ring}`}>
      <div className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-3 transition-colors duration-300 ${tone.head}`}>
        <span className="text-[15px] font-semibold">{pick("Without a wall: what the agent gets", "With Glass Wall: what the agent gets")}</span>
        <span className="shrink-0 font-mono text-[12px] font-medium">{pick("■ Real personal data", "● Tokens only")}</span>
      </div>
      {inside && (
        <ul className="divide-y divide-line/70 font-mono text-[13px] sm:hidden">
          {ROWS.map((r) => (
            <li key={r.id} className="flex gap-3 px-4 py-3">
              <span className="w-5 shrink-0 text-muted">{r.id}</span>
              <span className={`min-w-0 space-y-0.5 ${tone.cell}`}>
                {r.raw.map((raw, i) => <span key={i} className="block">{pick(raw, r.tok[i])}</span>)}
              </span>
              <span className="ml-auto shrink-0 text-right text-[12px] text-slate-300">{r.city}<br />{r.plan}</span>
            </li>
          ))}
        </ul>
      )}
      <div className={inside ? "hidden sm:block" : "overflow-x-auto"}>
        <table className={`w-full text-left text-[14px] ${inside ? "table-fixed" : ""}`}>
          <thead className="text-[11px] uppercase tracking-wide text-muted">
            <tr>{["id", "name", "email", "phone", "city", "plan"].map((h, i) => (
              <th key={h} className={`${pad} pb-2 pt-4 font-medium ${inside && i === 0 ? "w-12" : ""} ${inside && i === 2 ? "w-[34%]" : ""}`}>{h}</th>
            ))}</tr>
          </thead>
          <tbody key={inside ? undefined : String(w)} className={`font-mono ${inside ? "" : "animate-[fadein_.35s_ease]"}`}>
            {ROWS.map((r) => (
              <tr key={r.id} className="border-t border-line/70">
                <td className={`${pad} py-3 text-muted`}>{r.id}</td>
                {r.raw.map((raw, i) => (
                  <td key={i} className={`${pad} py-3 ${tone.cell} ${inside ? "break-all" : "whitespace-nowrap"}`}>{pick(raw, r.tok[i])}</td>
                ))}
                <td className={`${pad} py-3`}>{r.city}</td>
                <td className={`${pad} py-3`}>{r.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line/70 px-5 py-3 text-[13px] text-muted">
        {pick(
          inside ? "Without the wall the agent sees everything, so one tricked or over-helpful answer is a data leak."
                 : "The agent sees everything, so one tricked or over-helpful answer is a data leak. Flip the switch to turn the wall on.",
          "Same rows, same query. City, plan and spend stay readable, and equal values get equal tokens, so the agent can still count and find duplicates.",
        )}
      </p>
    </div>
  );
}
