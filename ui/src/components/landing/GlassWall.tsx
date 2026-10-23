import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/** Which side of the wall a subtree is rendered on: false = no wall, true = behind the wall, null = not inside a GlassWall. */
export const WallLayer = createContext<boolean | null>(null);

/** Both versions stacked in one grid cell, only this layer's visible, so both layers lay out identically. */
export function Both({ off, on }: { off: ReactNode; on: ReactNode }) {
  const layer = useContext(WallLayer);
  return (
    <span className="inline-grid">
      <span className={`[grid-area:1/1] ${layer ? "invisible" : ""}`}>{off}</span>
      <span className={`[grid-area:1/1] ${layer ? "" : "invisible"}`}>{on}</span>
    </span>
  );
}

/** Picks per layer inside a GlassWall, or by the given flag outside one. */
export function useWallView(walled: boolean) {
  const layer = useContext(WallLayer);
  const w = layer ?? walled;
  const pick = (off: ReactNode, on: ReactNode) => (layer === null ? (walled ? on : off) : <Both off={off} on={on} />);
  return { w, pick, inside: layer !== null };
}

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const HINT = [38, 64, 50];

/** A literal pane of glass dragged across the content: left of it the agent sees real data, right of it only tokens.
 *  The content is rendered twice (once per side) and the walled copy is clipped at the wall's position. */
export function GlassWall({ children, bg = "", initial = 50, captionClass = "" }: {
  children: ReactNode; bg?: string; initial?: number; captionClass?: string;
}) {
  const [x, setX] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // a short sweep once, so people notice the wall moves
  useEffect(() => {
    if (touched || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ids = HINT.map((v, i) => window.setTimeout(() => setX(v), 1400 + i * 750));
    return () => ids.forEach(clearTimeout);
  }, [touched]);

  const moveTo = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    setX(clamp(((clientX - r.left) / r.width) * 100));
  };
  const anim = dragging ? "" : "duration-700 ease-out";

  return (
    <div className="select-none">
      <div ref={ref} className="relative">
        <WallLayer.Provider value={false}><div aria-hidden>{children}</div></WallLayer.Provider>
        <div className={`absolute inset-0 overflow-hidden transition-[clip-path] ${anim} ${bg}`}
             style={{ clipPath: `inset(0 0 0 ${x}%)` }}>
          <WallLayer.Provider value={true}>{children}</WallLayer.Provider>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-purple-300/[0.07] to-transparent" />
        </div>

        <div role="slider" tabIndex={0} aria-label="Glass Wall position: everything right of the wall is behind Glass Wall"
             aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(x)} aria-valuetext={`${Math.round(100 - x)}% behind the wall`}
             onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setTouched(true); setDragging(true); moveTo(e.clientX); }}
             onPointerMove={(e) => dragging && moveTo(e.clientX)}
             onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
             onKeyDown={(e) => {
               const d = e.key === "ArrowLeft" ? -5 : e.key === "ArrowRight" ? 5 : e.key === "Home" ? -100 : e.key === "End" ? 100 : 0;
               if (d) { e.preventDefault(); setTouched(true); setX((v) => clamp(v + d)); }
             }}
             className={`group absolute inset-y-[-6px] z-10 w-10 -translate-x-1/2 cursor-ew-resize touch-none outline-none transition-[left] ${anim}`}
             style={{ left: `${x}%` }}>
          {/* the pane */}
          <div className="mx-auto h-full w-[7px] rounded-full border border-white/40 bg-gradient-to-b from-purple-200/60 via-white/25 to-purple-300/60 shadow-[0_0_24px_rgba(181,119,243,.75),inset_0_0_6px_rgba(255,255,255,.5)] backdrop-blur-md" />
          {/* the handle */}
          <div className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-purple-400/80 text-[13px] font-semibold text-white shadow-[0_0_24px_rgba(181,119,243,.8)] backdrop-blur-md transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-white">
            ‹›
          </div>
        </div>
      </div>
      <div className={`mt-3 flex items-center justify-between gap-3 text-[12px] ${captionClass}`}>
        <span className="text-leak">◂ no wall: real data</span>
        <span className={`text-slate-500 transition-opacity ${touched ? "opacity-0" : ""}`}>drag the glass</span>
        <span className="text-purple-300">behind Glass Wall: tokens ▸</span>
      </div>
    </div>
  );
}
