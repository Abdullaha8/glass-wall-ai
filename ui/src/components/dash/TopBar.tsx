import { useEffect, useRef } from "react";
import { GitHubIcon, REPO_URL } from "../landing/Nav";

export type Tab = "home" | "overview" | "demo" | "results" | "how";
const TABS: [Tab, string][] = [["home", "Home"], ["how", "How it works"], ["demo", "Live demo"], ["overview", "Dashboard"], ["results", "Results"]];

function Tabs({ tab, onTab, className = "" }: { tab: Tab; onTab: (t: Tab) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // keep the current tab in view on narrow screens
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [tab]);
  return (
    <div ref={ref} className={`flex items-center gap-1 ${className}`}>
      {TABS.map(([id, label]) => (
        <button key={id} onClick={() => onTab(id)} aria-current={tab === id ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[14px] transition-colors ${
                  tab === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Top bar: logo left, pill tabs centered, GitHub and the glowing Run live action right.
 *  On phones the tabs move to a swipeable second row. */
export function TopBar({ tab, onTab, onRunLive }: { tab: Tab; onTab: (t: Tab) => void; onRunLive: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-3 px-4 sm:px-6">
        <button onClick={() => onTab("home")} className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.svg" width={34} height={34} alt="" className="rounded-full" />
          <span className="hidden text-[16px] font-medium tracking-[-0.01em] min-[360px]:inline">Glass Wall <span className="text-purple-300">AI</span></span>
        </button>

        <nav aria-label="Sections" className="mx-auto hidden items-center gap-1 rounded-xl p-1 md:flex">
          <Tabs tab={tab} onTab={onTab} />
        </nav>

        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository (opens in a new tab)"
           className="ml-auto flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-300 hover:text-white">
          <GitHubIcon size={18} /><span className="hidden lg:inline">GitHub</span>
        </a>

        {/* the main action: always visible, on every page and every screen size */}
        <button onClick={onRunLive}
                className="group relative flex shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-xl bg-gradient-to-br from-purple-300 via-purple-400 to-purple-600 py-2 pl-3 pr-4 text-[14px] font-semibold text-white shadow-[0_0_28px_rgba(181,119,243,.6)] ring-1 ring-white/30 transition-all hover:-translate-y-0.5 hover:shadow-[0_0_40px_rgba(181,119,243,.85)] active:translate-y-0">
          <span aria-hidden className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
          </span>
          Run live <span aria-hidden className="hidden transition-transform group-hover:translate-x-0.5 sm:inline">→</span>
          {/* a slow shine across the button */}
          <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/25 blur-sm animate-[shine_3.5s_ease-in-out_infinite]" />
        </button>
      </div>

      {/* phones: full-width, swipeable tab row */}
      <nav aria-label="Sections (mobile)" className="border-t border-white/[0.06] md:hidden">
        <Tabs tab={tab} onTab={onTab}
              className="snap-x justify-between overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[440px]:[&>button]:px-2.5 max-[440px]:[&>button]:text-[13px]" />
      </nav>
    </header>
  );
}
