/** Solid tile with the two numbers that matter most for the selected setup (reference: "Live" tile). */
export function LiveTile({ walled, leaks, runs, onRunLive }: { walled: boolean; leaks: number; runs: number; onRunLive: () => void }) {
  const bg = walled ? "from-purple-300 via-purple-400 to-purple-600 shadow-[0_0_60px_rgba(181,119,243,.35)]"
                    : "from-[#ff9b91] via-[#e2554a] to-[#8f2b3f] shadow-[0_0_60px_rgba(240,122,112,.3)]";
  return (
    <section className={`relative flex h-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white transition-colors ${bg}`}>
      <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
      <header className="relative flex items-center justify-between">
        <h2 className="text-[17px] font-medium">{walled ? "Glass Wall on" : "Glass Wall off"}</h2>
        <button onClick={onRunLive} aria-label="Open the live demo" className="rounded-md p-1 hover:bg-white/15">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" />
          </svg>
        </button>
      </header>
      <p className="relative mt-1 text-[13px] text-white/80">Leak tracker</p>
      <p className="relative mt-5 text-[64px] font-light leading-none tracking-[-0.04em]">{leaks}</p>
      <p className="relative mt-1 text-[13px] text-white/80">{walled ? "real values leaked" : "attack runs leaked real data"}</p>
      <p className="relative mt-5 text-[44px] font-light leading-none tracking-[-0.03em]">{runs}</p>
      <p className="relative mt-1 text-[13px] text-white/80">{walled ? "protected agent runs" : "unprotected attack runs"}</p>
      <button onClick={onRunLive}
              className="relative mt-auto w-full rounded-xl bg-black/25 py-2.5 text-[14px] font-medium backdrop-blur hover:bg-black/35">
        Run it live →
      </button>
    </section>
  );
}
