import type { Color } from "../lib/types";
import { StatusBadge } from "./Status";

export function MetricCard({ label, value, unit, sublabel, tone, status }: {
  label: string;
  value: string | number | null;
  unit?: string;
  sublabel?: string;
  tone?: Color;
  status?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-muted">{label}</p>
        {tone && <StatusBadge color={tone} label={status} />}
      </div>
      <p className="mt-1 font-mono text-[28px] font-medium leading-none tabular-nums">
        {value ?? "—"}
        {value != null && unit && <span className="ml-0.5 text-[16px] text-muted">{unit}</span>}
      </p>
      {sublabel && <p className="mt-1.5 text-[12px] text-muted">{sublabel}</p>}
    </div>
  );
}
