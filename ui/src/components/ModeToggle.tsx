import { MODES, MODE_LABEL, MODE_VAR, type Mode } from "../lib/types";

export function ModeToggle({ value, onChange, disabled }: {
  value: Mode;
  onChange: (m: Mode) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Mode" className="grid grid-cols-3 gap-1 rounded border border-line bg-surface-2 p-1">
      {MODES.map((m) => {
        const on = m === value;
        return (
          <button key={m} role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(m)}
                  className={`flex items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-medium disabled:opacity-50 ${on ? "bg-surface text-ink shadow-[0_0_0_1px_var(--border)]" : "text-muted hover:text-ink"}`}>
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: MODE_VAR[m] }} aria-hidden />
            {MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}
