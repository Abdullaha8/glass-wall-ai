import type { ReactNode } from "react";

/** Bento card: black glass with a faint top highlight, like the reference design. */
export function Card({ title, right, children, className = "" }: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-white/[0.01] p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[17px] font-medium tracking-[-0.01em] text-white">{title}</h2>}
          {right && <div className="text-[13px] text-slate-400">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-lg border border-white/10 px-2.5 py-1 text-[12px] text-slate-300">{children}</span>;
}

/** Large, light-weight number, the signature of the reference design. */
export function BigNumber({ value, label, className = "" }: { value: string; label: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[36px] font-light leading-none tracking-[-0.03em] text-white sm:text-[40px]">{value}</p>
      <p className="mt-1.5 text-[12px] text-slate-400">{label}</p>
    </div>
  );
}
