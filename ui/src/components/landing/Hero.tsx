export interface HeadlineStats {
  wallLeak: number | null;
  noWallLeak: [number, number] | null;   // min–max across models
  rulesLeakMax: number | null;
  wallCorrect: number | null;
  wallRuns: number;
  models: number;
}

const fmt = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);

export function Hero({ stats, onTryLive }: { stats: HeadlineStats; onTryLive: () => void }) {
  return (
    <div id="top" className="relative overflow-hidden bg-[#050408] text-white">
      {/* soft glows, like the logo badge */}
      <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[480px] w-[480px] rounded-full bg-purple-500/25 blur-[130px]" />
      <div aria-hidden className="pointer-events-none absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-purple-700/30 blur-[130px]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]"
           style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-36">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[12px] text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400" /> Open source · MCP · Postgres · Syntax Error 2026
          </p>
          <h1 className="mt-6 text-[40px] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-[56px] lg:text-[64px]">
            AI agents see your data's shape.{" "}
            <span className="bg-gradient-to-r from-purple-200 via-purple-400 to-purple-500 bg-clip-text text-transparent">Never your users.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed text-slate-300 sm:text-[18px]">
            Glass Wall sits between AI agents and your database. Agents can still count, group and find duplicates,
            but every name, email and phone number reaches them as a token. The real values never leave the database.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onTryLive}
                    className="rounded-xl px-5 py-3 text-[15px] font-semibold transition bg-gradient-to-r from-purple-400 to-purple-600 text-white shadow-[0_0_28px_rgba(181,119,243,.35)] hover:shadow-[0_0_40px_rgba(181,119,243,.6)]">
              Run the live demo
            </button>
            <a href="#results" className="rounded-xl border border-purple-300/30 px-5 py-3 text-[15px] font-semibold text-white hover:bg-white/10">
              See the results
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[420px]">
          <div aria-hidden className="absolute inset-6 rounded-[80px] bg-purple-500/30 blur-3xl" />
          <img src="/mark.svg" alt="A person passes through a glass pane and comes out as token blocks"
               className="relative w-full drop-shadow-[0_30px_60px_rgba(0,0,0,0.45)]" />
        </div>
      </div>

      {/* stat strip: measured, not claimed */}
      <div className="relative border-t border-purple-400/15 bg-purple-900/10">
        <dl className="mx-auto grid max-w-[1200px] grid-cols-2 gap-y-6 px-4 py-8 sm:px-6 lg:grid-cols-4">
          {[
            [fmt(stats.wallLeak), "of attacks leaked data with Glass Wall", `${stats.wallRuns} runs, ${stats.models} models`, "text-purple-300"],
            [stats.noWallLeak ? `${Math.round(stats.noWallLeak[0])}–${Math.round(stats.noWallLeak[1])}%` : "—", "leaked with no wall", "same agents, same attacks", "text-[#fb7185]"],
            [stats.rulesLeakMax == null ? "—" : `up to ${Math.round(stats.rulesLeakMax)}%`, "leaked when the model was only told “never reveal”", "rules in the prompt", "text-[#fbbf24]"],
            [fmt(stats.wallCorrect), "of everyday questions still answered correctly", "with Glass Wall on", "text-white"],
          ].map(([value, label, sub, color]) => (
            <div key={label} className="px-2">
              <dt className="sr-only">{label}</dt>
              <dd className={`font-mono text-[32px] font-semibold leading-none tracking-[-0.02em] ${color}`}>{value}</dd>
              <dd className="mt-2 text-[14px] text-slate-200">{label}</dd>
              <dd className="text-[12px] text-slate-400">{sub}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
