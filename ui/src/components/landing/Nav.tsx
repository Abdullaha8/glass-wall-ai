import { useEffect, useState } from "react";

const LINKS = [
  ["How it works", "how"],
  ["Live demo", "demo"],
  ["Results", "results"],
] as const;
export const REPO_URL = "https://github.com/Abdullaha8/glass-wall-ai";

export function GitHubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

/** Floating glass nav: highlights the section in view, darkens once you scroll. */
export function Nav({ onTryLive }: { onTryLive: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    LINKS.forEach(([, id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); };
  }, []);

  return (
    <header className="fixed inset-x-0 top-3 z-40 px-3">
      <nav aria-label="Main"
           className={`mx-auto flex max-w-[1120px] items-center gap-2 rounded-2xl border px-2.5 py-2 backdrop-blur-xl transition-all duration-300 ${
             scrolled ? "border-white/10 bg-[#0b1220]/85 shadow-[0_10px_40px_rgba(2,6,23,.45)]" : "border-white/10 bg-white/[0.06]"}`}>
        <a href="#top" className="flex items-center gap-2.5 rounded-xl px-2 py-1 text-white">
          <img src="/logo.svg" width={30} height={30} alt="" className="rounded-[8px] shadow-[0_0_18px_rgba(94,234,212,.35)]" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Glass Wall <span className="text-[#5eead4]">AI</span></span>
        </a>

        <div className="mx-auto hidden items-center gap-1 md:flex">
          {LINKS.map(([label, id]) => (
            <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined}
               className={`rounded-xl px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                 active === id ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
              {label}
            </a>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="GitHub repository (opens in a new tab)"
             className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 text-slate-200 hover:bg-white/10 hover:text-white">
            <GitHubIcon />
          </a>
          <button onClick={onTryLive}
                  className="rounded-xl bg-gradient-to-r from-[#5eead4] to-[#34d399] px-4 py-2 text-[14px] font-semibold text-[#0b1220] shadow-[0_0_24px_rgba(94,234,212,.35)] transition hover:shadow-[0_0_32px_rgba(94,234,212,.6)]">
            Try it live
          </button>
        </div>
      </nav>
    </header>
  );
}
