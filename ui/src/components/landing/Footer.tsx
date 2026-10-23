export function Footer() {
  return (
    <footer className="border-t border-purple-400/15 bg-[#050408] text-slate-300">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-10 text-[14px] sm:px-6">
        <span className="flex items-center gap-2.5 text-white">
          <img src="/logo.svg" width={26} height={26} alt="" className="rounded-[6px]" />
          <span className="font-semibold">Glass Wall AI</span>
        </span>
        <a href="https://github.com/Abdullaha8/glass-wall-ai" target="_blank" rel="noopener noreferrer" className="hover:text-white">GitHub ↗</a>
        <span className="font-mono text-[13px]">MCP endpoint: glass-wall-ai.onrender.com/mcp/wall</span>
        <span className="ml-auto text-[13px] text-slate-400">
          All data is synthetic: example.* emails, 555 phone numbers. Built for Syntax Error 2026.
        </span>
      </div>
    </footer>
  );
}
