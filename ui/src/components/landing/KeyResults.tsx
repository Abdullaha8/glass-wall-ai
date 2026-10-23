import type { HeadlineStats } from "./Hero";

/** The four numbers that matter, big, at the top of the results section. */
export function KeyResults({ stats }: { stats: HeadlineStats }) {
  const tiles = [
    {
      label: "No wall", value: stats.noWallLeak ? `${Math.round(stats.noWallLeak[0])}–${Math.round(stats.noWallLeak[1])}%` : "—",
      note: "of attacks leaked real data", tone: "text-[#ff8a80]", ring: "ring-[#f07a70]/30", glow: "bg-[#f07a70]/15",
    },
    {
      label: "Rules in the prompt", value: stats.rulesLeakMax == null ? "—" : `≤${Math.round(stats.rulesLeakMax)}%`,
      note: "still leaked when told “never reveal”", tone: "text-[#f3b95f]", ring: "ring-[#e0a548]/30", glow: "bg-[#e0a548]/12",
    },
    {
      label: "Glass Wall", value: stats.wallLeak == null ? "—" : `${Math.round(stats.wallLeak)}%`,
      note: `leaked · ${stats.wallRuns} runs across ${stats.models} models`, tone: "text-purple-200", ring: "ring-purple-400/50", glow: "bg-purple-500/25",
      hero: true,
    },
    {
      label: "Still useful", value: stats.wallCorrect == null ? "—" : `${Math.round(stats.wallCorrect)}%`,
      note: "of everyday questions answered correctly with the wall on", tone: "text-white", ring: "ring-white/15", glow: "bg-white/5",
    },
  ];
  return (
    <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className={`relative overflow-hidden rounded-2xl bg-surface p-5 ring-1 ${t.ring} ${t.hero ? "shadow-[0_0_50px_rgba(181,119,243,.25)]" : ""}`}>
          <div aria-hidden className={`absolute -right-10 -top-10 h-32 w-32 rounded-full blur-2xl ${t.glow}`} />
          <p className="relative font-mono text-[12px] uppercase tracking-[0.12em] text-muted">{t.label}</p>
          <p className={`relative mt-2 font-mono text-[48px] font-semibold leading-none tracking-[-0.03em] ${t.tone}`}>{t.value}</p>
          <p className="relative mt-3 text-[14px] leading-snug text-muted">{t.note}</p>
        </div>
      ))}
    </div>
  );
}
