export type Backend = "up" | "waking" | "down";

const BACKEND_TEXT: Record<Backend, string> = {
  up: "live ready",
  waking: "waking backend (~40 s)",
  down: "backend offline · replay only",
};

export function Logo({ size = 32 }: { size?: number }) {
  return <img src="/logo.svg" width={size} height={size} alt="" aria-hidden className="rounded-[7px]" />;
}

export function Header({ view, onView, backend }: {
  view: "replay" | "live";
  onView: (v: "replay" | "live") => void;
  backend: Backend;
}) {
  const dot = backend === "up" ? "bg-ok" : backend === "waking" ? "bg-warn animate-pulse" : "bg-muted";
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Logo />
        <div>
          <h1 className="text-[16px] font-semibold leading-tight">Glass Wall AI</h1>
          <p className="text-[12px] text-muted">Agents see the shape of the data, never the people in it.</p>
        </div>
      </div>

      <div role="tablist" aria-label="View" className="ml-auto flex rounded border border-line bg-surface-2 p-0.5">
        {(["replay", "live"] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => onView(v)}
                  className={`rounded px-3 py-1 text-[13px] font-medium ${view === v ? "bg-surface text-ink shadow-[0_0_0_1px_var(--border)]" : "text-muted hover:text-ink"}`}>
            {v === "replay" ? "Replay (recorded)" : "Live"}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-[12px] text-muted" aria-live="polite">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden />
        {BACKEND_TEXT[backend]}
      </div>
    </header>
  );
}
