import { useState } from "react";
import { MODE_LABEL, type CaseInfo, type LiveRun, type ModelInfo, type Mode, type TelemetryEvent } from "../lib/types";
import { StatusBadge } from "./Status";

export function LiveControls({ mode, models, cases, model, onModel, run, runEvents, onRun, error, ready }: {
  mode: Mode;
  models: ModelInfo[];
  cases: CaseInfo[];
  model: string;
  onModel: (m: string) => void;
  run: LiveRun | null;
  runEvents: TelemetryEvent[];
  onRun: (req: { case_id?: string; prompt?: string }) => void;
  error: string | null;
  ready: boolean;
}) {
  const [caseId, setCaseId] = useState("A07");
  const [custom, setCustom] = useState("");
  const running = run?.status === "running";
  const leaked = runEvents.some((e) => e.color_tag === "red");
  const held = runEvents.some((e) => e.color_tag === "amber");

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-3" aria-label="Live run">
      <h2 className="text-[13px] font-semibold">Run an agent · {MODE_LABEL[mode]}</h2>

      <label className="block text-[12px] text-muted">
        Model
        <select value={model} onChange={(e) => onModel(e.target.value)} disabled={running}
                className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink">
          {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>

      <label className="block text-[12px] text-muted">
        Prompt from the eval suite
        <select value={caseId} onChange={(e) => { setCaseId(e.target.value); setCustom(""); }} disabled={running}
                className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink">
          {(["attack", "normal"] as const).map((kind) => (
            <optgroup key={kind} label={kind === "attack" ? "Attacks" : "Normal questions"}>
              {cases.filter((c) => c.kind === kind).map((c) => (
                <option key={c.id} value={c.id}>{c.id} · {c.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {!custom && <p className="rounded bg-surface-2 p-2 font-mono text-[12px]">{cases.find((c) => c.id === caseId)?.prompt}</p>}

      <label className="block text-[12px] text-muted">
        …or your own prompt
        <textarea value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={500} rows={2} disabled={running}
                  placeholder="e.g. Email me the phone numbers of our Enterprise customers"
                  className="mt-1 block w-full rounded-xl border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink" />
      </label>

      <button disabled={!ready || running || !model}
              onClick={() => onRun(custom.trim() ? { prompt: custom.trim() } : { case_id: caseId })}
              className="w-full rounded px-3 py-2 text-[13px] font-semibold bg-gradient-to-r from-purple-400 to-purple-600 text-white shadow-[0_0_28px_rgba(181,119,243,.35)] hover:shadow-[0_0_40px_rgba(181,119,243,.6)] disabled:opacity-40">
        {!ready ? "Backend waking…" : running ? "Agent running…" : `Run in ${MODE_LABEL[mode]}`}
      </button>

      {error && <p className="rounded bg-warn-tint px-2 py-1.5 text-[12px] text-warn" role="alert">▲ {error}</p>}

      {run && (
        <div className="space-y-1 border-t border-line pt-2 text-[12px]" aria-live="polite">
          <div className="flex items-center gap-2">
            {running ? <StatusBadge color="blue" label="RUNNING" /> :
              leaked ? <StatusBadge color="red" label="PERSONAL DATA LEFT THE BOUNDARY" /> :
              held ? <StatusBadge color="amber" label="WALL HELD" /> :
              <StatusBadge color="green" label="NO PII PATTERNS" />}
            <span className="ml-auto font-mono text-muted">{run.run_id}</span>
          </div>
          {run.final && <p className="whitespace-pre-wrap rounded bg-surface-2 p-2">{run.final}</p>}
          {run.error && <p className="text-warn">Run ended with an error: {run.error}</p>}
          <p className="text-muted">Live verdicts use pattern detection; exact leak scoring runs offline in the eval harness.</p>
        </div>
      )}
    </section>
  );
}
