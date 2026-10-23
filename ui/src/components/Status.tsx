import type { Color } from "../lib/types";

/** Status always carries glyph + label, never color alone (SPEC §5.1). */
export const STATUS: Record<Color, { glyph: string; label: string; text: string; tint: string; bar: string }> = {
  green: { glyph: "●", label: "OK", text: "text-ok", tint: "bg-ok-tint", bar: "bg-ok" },
  red: { glyph: "■", label: "LEAK", text: "text-leak", tint: "bg-leak-tint", bar: "bg-leak" },
  blue: { glyph: "◆", label: "INFO", text: "text-info", tint: "bg-info-tint", bar: "bg-info" },
  amber: { glyph: "▲", label: "WARN", text: "text-warn", tint: "bg-warn-tint", bar: "bg-warn" },
};

export function StatusBadge({ color, label }: { color: Color; label?: string }) {
  const s = STATUS[color];
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[12px] font-medium ${s.text}`}>
      <span aria-hidden>{s.glyph}</span>
      {label ?? s.label}
    </span>
  );
}
