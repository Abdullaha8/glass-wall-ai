const LINKS = [
  ["How it works", "#how"],
  ["Results", "#results"],
  ["Live demo", "#demo"],
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1220]/85 backdrop-blur">
      <nav className="mx-auto flex max-w-[1200px] items-center gap-6 px-4 py-3 sm:px-6" aria-label="Main">
        <a href="#top" className="flex items-center gap-2.5 text-white">
          <img src="/logo.svg" width={30} height={30} alt="" className="rounded-[7px]" />
          <span className="text-[16px] font-semibold tracking-[-0.01em]">Glass Wall <span className="text-[#5eead4]">AI</span></span>
        </a>
        <div className="ml-auto hidden items-center gap-6 text-[14px] text-slate-300 md:flex">
          {LINKS.map(([label, href]) => <a key={href} href={href} className="hover:text-white">{label}</a>)}
          <a href="https://github.com/Abdullaha8/glass-wall-ai" className="hover:text-white">GitHub</a>
        </div>
        <a href="#demo" className="ml-auto rounded-lg bg-[#5eead4] px-3.5 py-2 text-[13px] font-semibold text-[#0b1220] hover:bg-[#99f6e4] md:ml-0">
          Try it live
        </a>
      </nav>
    </header>
  );
}
