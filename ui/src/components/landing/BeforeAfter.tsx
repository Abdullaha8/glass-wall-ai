// Three real rows from the (fully synthetic) demo database: what each agent role actually receives.
export const ROWS = [
  { id: 2, raw: ["Anvi Konda", "anvi.konda@example.net", "+1 555 914 9732"], tok: ["tok_002b3b31", "tok_bc3e8aa5", "tok_52eb481d"], city: "Mumbai", plan: "Free" },
  { id: 9, raw: ["Rushil Saini", "rushil.saini@example.com", "555 447 9144"], tok: ["tok_8e3f6e93", "tok_3f9183c1", "tok_a26f736c"], city: "Chennai", plan: "Business" },
  { id: 15, raw: ["Gayathri Chaudry", "gayathri.chaudry@example.org", "555 019 2619"], tok: ["tok_665e6d57", "tok_d01f6c48", "tok_89047ea1"], city: "Chennai", plan: "Pro" },
];

/** One table, driven by the Glass Wall switch: the same customers, real values or tokens. */
export function BeforeAfter({ walled }: { walled: boolean }) {
  const tone = walled
    ? { ring: "ring-purple-400/40", head: "bg-purple-400/10 text-purple-200", cell: "text-purple-200", badge: "● Tokens only" }
    : { ring: "ring-leak/40", head: "bg-leak-tint text-leak", cell: "text-leak", badge: "■ Real personal data" };
  return (
    <div className={`overflow-hidden rounded-2xl bg-surface ring-1 transition-colors duration-300 ${tone.ring}`}>
      <div className={`flex items-center justify-between px-5 py-3 transition-colors duration-300 ${tone.head}`}>
        <span className="text-[15px] font-semibold">{walled ? "With Glass Wall: what the agent gets" : "Without a wall: what the agent gets"}</span>
        <span className="font-mono text-[12px] font-medium">{tone.badge}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead className="text-[11px] uppercase tracking-wide text-muted">
            <tr>{["id", "name", "email", "phone", "city", "plan"].map((h) => <th key={h} className="px-5 pb-2 pt-4 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody key={String(walled)} className="animate-[fadein_.35s_ease] font-mono">
            {ROWS.map((r) => (
              <tr key={r.id} className="border-t border-line/70">
                <td className="px-5 py-3 text-muted">{r.id}</td>
                {(walled ? r.tok : r.raw).map((v, i) => <td key={i} className={`whitespace-nowrap px-5 py-3 ${tone.cell}`}>{v}</td>)}
                <td className="px-5 py-3">{r.city}</td>
                <td className="px-5 py-3">{r.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line/70 px-5 py-3 text-[13px] text-muted">
        {walled
          ? "Same rows, same query. City, plan and spend stay readable, and equal values get equal tokens, so the agent can still count and find duplicates. Flip the switch to see what it gets without the wall."
          : "The agent sees everything, so one tricked or over-helpful answer is a data leak. Flip the switch to turn the wall on."}
      </p>
    </div>
  );
}
