import type { ReactNode } from "react";

/** A page section with the eyebrow / title / lead pattern used across the landing page. */
export function Section({ id, eyebrow, title, lead, children, className = "" }: {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 ${className}`}>
      <p className="font-mono text-[12px] font-medium uppercase tracking-[0.14em] text-[#0f9f8f]">{eyebrow}</p>
      <h2 className="mt-2 max-w-[760px] text-[30px] font-bold leading-[1.15] tracking-[-0.02em] sm:text-[38px]">{title}</h2>
      {lead && <p className="mt-3 max-w-[720px] text-[16px] leading-relaxed text-muted sm:text-[17px]">{lead}</p>}
      <div className="mt-10">{children}</div>
    </section>
  );
}
