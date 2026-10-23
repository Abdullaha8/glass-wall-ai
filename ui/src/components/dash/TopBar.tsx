import { GitHubIcon, REPO_URL } from "../landing/Nav";

export type Tab = "overview" | "demo" | "results" | "how";
const TABS: [Tab, string][] = [["overview", "Overview"], ["demo", "Live demo"], ["results", "Results"], ["how", "How it works"]];

/** Reference-style top bar: logo left, pill tabs centered with a purple action, GitHub right. */
export function TopBar({ tab, onTab, onRunLive }: { tab: Tab; onTab: (t: Tab) => void; onRunLive: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-3 px-4 sm:px-6">
        <button onClick={() => onTab("overview")} className="flex items-center gap-2.5">
          <img src="/logo.svg" width={34} height={34} alt="" className="rounded-[8px]" />
          <span className="hidden text-[16px] font-medium tracking-[-0.01em] sm:inline">Glass Wall <span className="text-purple-300">AI</span></span>
        </button>

        <nav aria-label="Sections" className="mx-auto flex items-center gap-1 overflow-x-auto rounded-xl p-1">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => onTab(id)} aria-current={tab === id ? "page" : undefined}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[14px] transition-colors sm:px-3.5 ${
                      tab === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
              {label}
            </button>
          ))}
          <button onClick={onRunLive}
                  className="ml-1 hidden items-center gap-1.5 whitespace-nowrap rounded-lg bg-purple-400 px-3.5 py-1.5 text-[14px] font-medium text-white shadow-[0_0_18px_rgba(181,119,243,.45)] hover:bg-purple-300 md:flex">
            Run live <span aria-hidden>+</span>
          </button>
        </nav>

        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository (opens in a new tab)"
           className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-slate-300 hover:text-white">
          <GitHubIcon size={18} /><span className="hidden lg:inline">GitHub</span>
        </a>
      </div>
    </header>
  );
}
