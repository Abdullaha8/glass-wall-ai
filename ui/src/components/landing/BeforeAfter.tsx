// Three real rows from the (fully synthetic) demo database: what each agent role actually receives.
const ROWS = [
  { id: 2, raw: ["Anvi Konda", "anvi.konda@example.net", "+1 555 914 9732"], tok: ["tok_002b3b31", "tok_bc3e8aa5", "tok_52eb481d"], city: "Mumbai", plan: "Free" },
  { id: 9, raw: ["Rushil Saini", "rushil.saini@example.com", "555 447 9144"], tok: ["tok_8e3f6e93", "tok_3f9183c1", "tok_a26f736c"], city: "Chennai", plan: "Business" },
  { id: 15, raw: ["Gayathri Chaudry", "gayathri.chaudry@example.org", "555 019 2619"], tok: ["tok_665e6d57", "tok_d01f6c48", "tok_89047ea1"], city: "Chennai", plan: "Pro" },
];

function Card({ walled }: { walled: boolean }) {
  const tone = walled
    ? { ring: "ring-[#14b8a6]/40", head: "bg-[#ecfdf5] text-[#047857]", cell: "text-[#047857]", badge: "● Tokens only" }
    : { ring: "ring-[#f43f5e]/30", head: "bg-[#fff1f2] text-[#be123c]", cell: "text-[#be123c]", badge: "■ Real personal data" };
  return (
    <div className={`overflow-hidden rounded-2xl bg-surface shadow-[0_1px_2px_rgba(16,24,40,.06),0_8px_24px_rgba(16,24,40,.06)] ring-1 ${tone.ring}`}>
      <div className={`flex items-center justify-between px-5 py-3 ${tone.head}`}>
        <span className="text-[14px] font-semibold">{walled ? "With Glass Wall" : "Without a wall"}</span>
        <span className="font-mono text-[12px] font-medium">{tone.badge}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] whitespace-nowrap text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-wide text-muted">
            <tr>{["id", "name", "email", "phone", "plan"].map((h) => <th key={h} className="px-4 pb-2 pt-4 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="font-mono">
            {ROWS.map((r) => (
              <tr key={r.id} className="border-t border-line/70">
                <td className="px-4 py-2.5 text-muted">{r.id}</td>
                {(walled ? r.tok : r.raw).map((v, i) => <td key={i} className={`px-4 py-2.5 ${tone.cell}`}>{v}</td>)}
                <td className="px-4 py-2.5">{r.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line/70 px-5 py-3 text-[13px] text-muted">
        {walled
          ? "Same rows, same query. City, plan and spend stay readable, and equal values get equal tokens, so the agent can still count and find duplicates."
          : "The agent sees everything, so one tricked or over-helpful answer is a data leak."}
      </p>
    </div>
  );
}

export function BeforeAfter() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card walled={false} />
      <Card walled />
    </div>
  );
}
