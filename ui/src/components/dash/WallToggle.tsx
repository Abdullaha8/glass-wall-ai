/** The small Glass Wall control: a pane of glass rises between the agent and the database (on) or sinks out of the way (off). */
export function WallToggle({ walled, label, onToggle }: { walled: boolean; label: string; onToggle: () => void }) {
  return (
    <button role="switch" aria-checked={walled} onClick={onToggle}
            className={`group flex items-center gap-3 rounded-2xl border py-1.5 pl-3 pr-4 text-[14px] transition-colors ${
              walled ? "border-purple-400/40 bg-purple-900/25 text-white" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20"}`}>
      <span aria-hidden className="relative flex h-9 w-[104px] items-center justify-between overflow-hidden rounded-xl bg-black/40 px-2 font-mono text-[10px] text-slate-400">
        <span>agent</span>
        <span>db</span>
        {/* data flowing across */}
        <span className={`absolute left-[38px] right-[24px] top-1/2 h-px -translate-y-1/2 ${walled ? "bg-purple-300/50" : "bg-leak/60"}`} />
        {/* the pane */}
        <span className={`absolute left-1/2 top-1 h-7 w-[6px] -translate-x-1/2 rounded-full border border-white/40 bg-gradient-to-b from-purple-200/80 via-white/40 to-purple-300/80 shadow-[0_0_14px_rgba(181,119,243,.9)] transition-all duration-500 ease-out ${
          walled ? "translate-y-0 opacity-100" : "translate-y-8 opacity-30"}`} />
      </span>
      <span className="text-left leading-tight">
        <span className="block font-medium">{label}</span>
        <span className="block text-[11px] text-slate-400">{walled ? "click to lower the wall" : "click to raise the wall"}</span>
      </span>
    </button>
  );
}
