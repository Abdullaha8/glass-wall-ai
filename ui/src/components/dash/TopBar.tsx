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

/** Reference-style top bar: logo left, pill tabs centered with a purple action, GitHub right.
 *  On phones the tabs move to a swipeable second row. */
export function TopBar({ tab, onTab, onRunLive }: { tab: Tab; onTab: (t: Tab) => void; onRunLive: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-3 px-4 sm:px-6">
        <button onClick={() => onTab("home")} className="flex shrink-0 items-center gap-2.5">
          <img src="/logo.svg" width={34} height={34} alt="" className="rounded-[8px]" />
          <span className="text-[16px] font-medium tracking-[-0.01em]">Glass Wall <span className="text-purple-300">AI</span></span>
        </button>

        <nav aria-label="Sections" className="mx-auto hidden items-center gap-1 rounded-xl p-1 md:flex">
          <Tabs tab={tab} onTab={onTab} />
          <button onClick={onRunLive}
                  className="ml-1 flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-purple-400 px-3.5 py-1.5 text-[14px] font-medium text-white shadow-[0_0_18px_rgba(181,119,243,.45)] hover:bg-purple-300">
            Run live <span aria-hidden>+</span>
          </button>
        </nav>

        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository (opens in a new tab)"
           className="ml-auto flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-300 hover:text-white md:ml-0">
          <GitHubIcon size={18} /><span className="hidden lg:inline">GitHub</span>
        </a>
      </div>

      {/* phones: full-width, swipeable tab row */}
      <nav aria-label="Sections (mobile)" className="border-t border-white/[0.06] md:hidden">
        <Tabs tab={tab} onTab={onTab}
              className="snap-x justify-between overflow-x-auto px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-[440px]:[&>button]:px-2.5 max-[440px]:[&>button]:text-[13px]" />
      </nav>
    </header>
  );
}
