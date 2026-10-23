import { useEffect, useState } from "react";
import { ROWS } from "./BeforeAfter";

const HEX = "0123456789abcdef";
const CYCLE = 90;          // frames per loop (~5.4 s at 60 ms)
const STEP = 60;

/** Real values on one side of the glass; the same values arrive as tokens on the other, decoding in. */
export function HeroVisual() {
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [frame, setFrame] = useState(reduce ? CYCLE : 0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setFrame((f) => (f + 1) % (CYCLE + 30)), STEP);
    return () => clearInterval(id);
  }, [reduce]);

  // each token decodes left to right, staggered by row and column
  const decode = (token: string, start: number) => {
    const body = token.slice(4);
    const shown = Math.max(0, Math.min(body.length, Math.floor((frame - start) / 2)));
    if (frame < start) return "tok_" + "········";
    const scrambled = body.split("").map((c, i) => (i < shown ? c : HEX[(frame * 7 + i * 13 + start) % 16])).join("");
    return "tok_" + scrambled;
  };

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-6 rounded-[40px] bg-purple-500/25 blur-3xl" />
      <div className="relative overflow-hidden rounded-3xl border border-purple-300/20 bg-white/[0.04] shadow-[0_30px_80px_rgba(0,0,0,.55)] backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#f07a70]/80" /><span className="h-2.5 w-2.5 rounded-full bg-[#e0a548]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#4cc38a]/80" />
          <span className="ml-2 truncate font-mono text-[12px] text-slate-400">agent → run_sql("SELECT full_name, email FROM customers_v")</span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr]">
          <div className="px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#f07a70]">In the database</p>
            <ul className="mt-3 space-y-3">
              {ROWS.map((r) => (
                <li key={r.id} className="font-mono text-[13px] leading-tight">
                  <div className="text-white">{r.raw[0]}</div>
                  <div className="truncate text-[#f5a29b]/80">{r.raw[1]}</div>
                </li>
              ))}
            </ul>
          </div>

          {/* the glass */}
          <div aria-hidden className="relative w-6">
            <div className="absolute inset-y-3 left-1/2 w-[10px] -translate-x-1/2 rounded-full border border-purple-200/50 bg-gradient-to-b from-purple-200/30 via-purple-300/10 to-purple-200/30 shadow-[0_0_24px_rgba(181,119,243,.6)]" />
          </div>

          <div className="px-4 py-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-purple-300">What the agent gets</p>
            <ul className="mt-3 space-y-3">
              {ROWS.map((r, i) => (
                <li key={r.id} className="font-mono text-[13px] leading-tight">
                  <div className="text-purple-200">{decode(r.tok[0], 8 + i * 14)}</div>
                  <div className="text-purple-300/80">{decode(r.tok[1], 14 + i * 14)}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 font-mono text-[12px]">
          <span className="text-slate-400">same rows · same query</span>
          <span className="text-purple-300">0 real values reached the agent</span>
        </div>
      </div>
    </div>
  );
}
