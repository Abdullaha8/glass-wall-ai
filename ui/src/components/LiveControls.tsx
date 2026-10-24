import { useState } from "react";
import { MODE_LABEL, type CaseInfo, type LiveRun, type ModelHealth, type ModelInfo, type Mode, type QuotaStatus, type TelemetryEvent } from "../lib/types";
import { StatusBadge } from "./Status";

const wait = (s: number | null) =>
  s == null ? "" : s < 90 ? `${s} s` : s < 5400 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`;

/** One line per model state, in plain words. */
function health(h: ModelHealth | undefined): { text: string; blocked: boolean } {
  const calls = h?.calls_24h ? ` · ${h.calls_24h} model call${h.calls_24h === 1 ? "" : "s"} today` : "";
  switch (h?.state) {
    case "ready": return { text: `free quota available${calls}`, blocked: false };
    case "cooling": return { text: `per-minute limit hit · back in ~${wait(h.wait_s)}`, blocked: true };
    case "out": return { text: `daily free quota used up · back in ~${wait(h.wait_s)}`, blocked: true };
    default: return { text: "free tier · not used yet today", blocked: false };
  }
}

// red (used up) -> amber -> purple (available); the fill shows the slice of this scale up to the model's level
const SCALE = "linear-gradient(90deg, #f07a70 0%, #e0a548 45%, #b577f3 100%)";

/** A model's free-tier meter: full when available, drops to red at a limit and refills as the reset nears. */
function Meter({ level, known }: { level: number; known: boolean }) {
  const pct = Math.max(4, Math.round(level * 100));
  return (
    <span className="relative block h-2 w-full overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
      <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ${known ? "" : "opacity-40"}`}
            style={{ width: `${pct}%`, backgroundImage: SCALE, backgroundSize: `${(100 / pct) * 100}% 100%`,
                     boxShadow: level >= 1 && known ? "0 0 10px rgba(181,119,243,.55)" : undefined }} />
    </span>
  );
}

/** Provider errors in plain words; the raw text stays in the telemetry log. */
function explainError(error: string): string {
  if (error.includes("Failed to parse tool call"))
    return "the model sent a garbled tool call (a known quirk of this model on Groq). Nothing leaked. Try again, or pick Gemini.";
  if (/ratelimit|rate limit|quota|429|resource_exhausted/i.test(error))
    return "the model's free quota is busy right now. Nothing leaked. Wait a minute, or pick another model.";
  if (/timeout|timed out/i.test(error))
    return "the model took too long to answer. Nothing leaked. Try again.";
  return error;
}

export function LiveControls({ mode, models, cases, model, onModel, run, runEvents, onRun, error, ready, quota }: {
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
  quota: QuotaStatus | null;
}) {
  const [caseId, setCaseId] = useState("A07");
  const [custom, setCustom] = useState("");
  const running = run?.status === "running";
  const leaked = runEvents.some((e) => e.color_tag === "red");
  const held = runEvents.some((e) => e.color_tag === "amber");
  const h = health(quota?.models[model]);
  // the per-visitor hourly cap is enforced by the backend; it only surfaces here once it's hit
  const noRunsLeft = quota != null && quota.runs_left === 0;

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-3" aria-label="Live run">
      <h2 className="text-[13px] font-semibold">Run an agent · {MODE_LABEL[mode]}</h2>

      <div role="radiogroup" aria-label="Model and its free-tier quota" className="space-y-1.5">
        <p className="flex items-center justify-between text-[12px] text-muted">
          Model <span className="text-[11px]">free-tier quota</span>
        </p>
        {models.map((m) => {
          const mh = quota?.models[m.id];
          const info = health(mh);
          const on = m.id === model;
          return (
            <button key={m.id} role="radio" aria-checked={on} disabled={running} onClick={() => onModel(m.id)}
                    className={`block w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                      on ? "border-purple-300/60 bg-purple-400/10" : "border-line bg-surface-2 hover:border-white/20"} ${info.blocked ? "opacity-80" : ""}`}>
              <span className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                <span className={on ? "font-medium text-white" : "text-slate-200"}>{m.label}</span>
                {on && <span className="text-[11px] text-purple-200">selected</span>}
              </span>
              <Meter level={mh?.available ?? 1} known={!!mh && mh.state !== "unknown"} />
              <span className={`mt-1 block text-[11px] ${info.blocked ? (mh?.state === "out" ? "text-leak" : "text-warn") : "text-slate-400"}`}>
                {quota ? info.text : "checking…"}
              </span>
            </button>
          );
        })}
      </div>

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

      <button disabled={!ready || running || !model || h.blocked || noRunsLeft}
              onClick={() => onRun(custom.trim() ? { prompt: custom.trim() } : { case_id: caseId })}
              className="w-full rounded px-3 py-2 text-[13px] font-semibold bg-gradient-to-r from-purple-400 to-purple-600 text-white shadow-[0_0_28px_rgba(181,119,243,.35)] hover:shadow-[0_0_40px_rgba(181,119,243,.6)] disabled:opacity-40">
        {!ready ? "Backend waking…" : running ? "Agent running…" : noRunsLeft ? `Hourly limit reached · try again in ~${wait(quota?.next_run_s ?? null)}`
          : h.blocked ? "Model out of free quota, pick another" : `Run in ${MODE_LABEL[mode]}`}
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
          {run.error && <p className="text-warn">Run ended with an error: {explainError(run.error)}</p>}
          <p className="text-muted">Live verdicts use pattern detection; exact leak scoring runs offline in the eval harness.</p>
        </div>
      )}
    </section>
  );
}
