/** The small Glass Wall control: a pane of glass rises between the agent and the database (on) or sinks out of the way (off).
 *  Styled as a clear button: filled and glowing when on, a pulsing call to action when off. */
export function WallToggle({ walled, label, onToggle }: { walled: boolean; label: string; onToggle: () => void }) {
  return (
    <button role="switch" aria-checked={walled} onClick={onToggle}
            className={`group relative flex cursor-pointer items-center gap-3 rounded-2xl border py-2 pl-2.5 pr-2.5 text-[14px] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
              walled
                ? "border-purple-300/60 bg-gradient-to-br from-purple-500/40 to-purple-900/50 text-white shadow-[0_0_28px_rgba(181,119,243,.45)] hover:shadow-[0_0_38px_rgba(181,119,243,.65)]"
                : "border-leak/50 bg-leak-tint text-white hover:border-leak"}`}>
      {!walled && <span aria-hidden className="pointer-events-none absolute inset-0 animate-ping rounded-2xl border border-leak/40 [animation-duration:2s]" />}
      <span aria-hidden className="relative flex h-9 w-[96px] items-center justify-between overflow-hidden rounded-xl bg-black/50 px-2 font-mono text-[10px] text-slate-300">
        <span>agent</span>
        <span>db</span>
        {/* data flowing across */}
        <span className={`absolute left-[38px] right-[24px] top-1/2 h-px -translate-y-1/2 ${walled ? "bg-purple-300/60" : "bg-leak"}`} />
        {/* the pane */}
        <span className={`absolute left-1/2 top-1 h-7 w-[6px] -translate-x-1/2 rounded-full border border-white/50 bg-gradient-to-b from-purple-200 via-white/60 to-purple-300 shadow-[0_0_14px_rgba(181,119,243,.95)] transition-all duration-500 ease-out ${
          walled ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`} />
      </span>
      <span className="relative text-left leading-tight">
        <span className="block font-medium">{label}</span>
        <span className={`block text-[11px] ${walled ? "text-purple-200" : "text-leak"}`}>{walled ? "personal data hidden" : "personal data exposed"}</span>
      </span>
      <span className={`relative ml-1 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold transition-colors ${
        walled ? "bg-white/15 text-white group-hover:bg-white/25" : "bg-purple-400 text-white shadow-[0_0_16px_rgba(181,119,243,.6)] group-hover:bg-purple-300"}`}>
        {walled ? "Lower ↓" : "Raise ↑"}
      </span>
    </button>
  );
}
