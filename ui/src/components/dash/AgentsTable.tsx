import { shortModel, type Latest, type Mode } from "../../lib/types";

const MODES: [Mode, string][] = [["no_wall", "No wall"], ["instructions_only", "Rules in the prompt"], ["glass_wall", "Glass Wall"]];

/** Every agent we ran: where it ran, how many runs, and its leak rate per setup. */
export function AgentsTable({ data }: { data: Latest }) {
  const rows = data.models.map((m) => {
    const s = data.summary[m];
    const runs = MODES.reduce((n, [mode]) => n + (s?.[mode]?.runs ?? 0), 0);
    return { m, s, runs, local: m.startsWith("ollama"), partial: data.partial_models?.[m] };
  });
  const cell = (leaks?: number, runs?: number) => {
    if (!runs) return <span className="text-slate-600">–</span>;
    const pct = Math.round((100 * (leaks ?? 0)) / runs);
    return (
      <span className="inline-flex items-baseline gap-1.5">
        <span className="text-[20px] font-light tracking-[-0.02em] text-white">{pct}%</span>
        <span className="text-[12px] text-slate-500">{leaks} of {runs}</span>
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead className="text-[12px] text-slate-500">
          <tr>
            <th className="pb-3 font-normal">Agent (LLM)</th>
            <th className="pb-3 font-normal">Ran on</th>
            <th className="pb-3 font-normal">Runs</th>
            {MODES.map(([mode, label]) => (
              <th key={mode} className={`pb-3 font-normal ${mode === "glass_wall" ? "text-purple-300" : ""}`}>{label} · attacks leaked</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.m} className="border-t border-white/[0.06]">
              <td className="py-3 text-[14px] text-white">
                {shortModel(r.m)}
                {r.partial && <span className="ml-2 rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-slate-400">partial: free quota ran out</span>}
              </td>
              <td className="py-3 text-slate-400">{r.local ? "your GPU (Ollama)" : r.m.startsWith("gemini") ? "Gemini API (free tier)" : "Groq API (free tier)"}</td>
              <td className="py-3 font-mono text-slate-300">{r.runs}</td>
              {MODES.map(([mode]) => (
                <td key={mode} className="py-3">{cell(r.s?.[mode]?.attack_leak_runs, r.s?.[mode]?.attack_runs)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
