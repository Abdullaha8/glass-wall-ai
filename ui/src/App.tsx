import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchitectureCanvas } from "./components/ArchitectureCanvas";
import { EventDrawer } from "./components/EventDrawer";
import { type Backend } from "./components/Header";
import { LiveControls } from "./components/LiveControls";
import { LogStream } from "./components/LogStream";
import { ModeToggle } from "./components/ModeToggle";
import { OutboxInspector } from "./components/OutboxInspector";
import { Scoreboard } from "./components/Scoreboard";
import { BeforeAfter } from "./components/landing/BeforeAfter";
import { Footer } from "./components/landing/Footer";
import { Hero, type HeadlineStats } from "./components/landing/Hero";
import { HowItWorks } from "./components/landing/HowItWorks";
import { Nav } from "./components/landing/Nav";
import { Section } from "./components/landing/Section";
import * as api from "./lib/api";
import {
  shortModel,
  type CaseInfo, type Latest, type LiveRun, type ModelInfo, type Mode, type OutboxMessage, type TelemetryEvent,
} from "./lib/types";

const MAIN_MODEL = "groq/openai/gpt-oss-120b";

export default function App() {
  const [view, setView] = useState<"replay" | "live">(
    new URLSearchParams(location.search).get("view") === "live" ? "live" : "replay",
  );
  const [mode, setMode] = useState<Mode>("no_wall");
  const [backend, setBackend] = useState<Backend>("waking");

  // replay data (static files, always available)
  const [latest, setLatest] = useState<Latest | null>(null);
  const [replayEvents, setReplayEvents] = useState<TelemetryEvent[]>([]);
  const [replayOutbox, setReplayOutbox] = useState<OutboxMessage[]>([]);
  const [replayModel, setReplayModel] = useState(MAIN_MODEL);
  const [played, setPlayed] = useState(0);

  // live data
  const [liveEvents, setLiveEvents] = useState<TelemetryEvent[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [cases, setCases] = useState<CaseInfo[]>([]);
  const [liveModel, setLiveModel] = useState("");
  const [run, setRun] = useState<LiveRun | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [outbox, setOutbox] = useState<OutboxMessage[]>([]);

  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    api.loadLatest().then((d) => {
      setLatest(d);
      if (!d.models.includes(MAIN_MODEL)) setReplayModel(d.models[0]);
    }).catch(() => setLatest(null));
    api.loadReplayEvents().then(setReplayEvents);
    api.loadReplayOutbox().then(setReplayOutbox);
  }, []);

  // Wake the backend in the background; never block the page on it.
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 75_000);
      try {
        await api.health(ctl.signal);
        if (cancelled) return;
        setBackend("up");
        const [m, c] = await Promise.all([api.getModels(), api.getCases()]);
        setModels(m);
        setCases(c);
        setLiveModel((cur) => cur || m.find((x) => x.id === MAIN_MODEL)?.id || m[0]?.id || "");
      } catch {
        if (!cancelled) { setBackend("down"); setTimeout(ping, 30_000); }
      } finally {
        clearTimeout(t);
      }
    };
    ping();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (backend !== "up") return;
    return api.subscribeTelemetry(
      (e) => setLiveEvents((prev) => [...prev.slice(-499), e]),
      (up) => setBackend(up ? "up" : "waking"),
    );
  }, [backend === "up"]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshOutbox = useCallback(() => { api.getOutbox().then(setOutbox).catch(() => {}); }, []);
  useEffect(() => { if (view === "live" && backend === "up") refreshOutbox(); }, [view, backend, refreshOutbox]);

  // Replay: play the recorded events for the selected mode + model, one by one.
  const replayForMode = useMemo(
    () => replayEvents.filter((e) => e.mode === mode && e.model === replayModel),
    [replayEvents, mode, replayModel],
  );
  useEffect(() => {
    setPlayed(0);
    setSelected(null);
    // ~1 event per second so the data-flow diagram can be followed; loops after a short pause
    const id = setInterval(() => setPlayed((p) => (p >= replayForMode.length + 3 ? 1 : p + 1)), 1000);
    return () => clearInterval(id);
  }, [replayForMode]);

  // Live: poll the active run until it finishes.
  const pollRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!run || run.status !== "running") return;
    pollRef.current = window.setInterval(async () => {
      const r = await api.getRun(run.run_id).catch(() => null);
      if (r && r.status !== "running") { setRun(r); refreshOutbox(); }
    }, 1500);
    return () => clearInterval(pollRef.current);
  }, [run, refreshOutbox]);

  const startRun = async (req: { case_id?: string; prompt?: string }) => {
    setRunError(null);
    try {
      setRun(await api.startRun({ mode, model: liveModel, ...req }));
    } catch (e) {
      setRunError((e as Error).message);
    }
  };

  const replayQuery = (query: string) =>
    startRun({ prompt: `Run exactly this SQL with run_sql and show me the raw result: ${query}` });

  const events = view === "replay" ? replayForMode.slice(0, Math.min(played, replayForMode.length)) : liveEvents;
  const runEvents = run ? liveEvents.filter((e) => e.run_id === run.run_id) : [];
  const lastEvent = view === "replay" ? events[events.length - 1] : runEvents[runEvents.length - 1];
  const summary = latest?.summary[replayModel];
  const wall = summary?.glass_wall;
  const replayOutboxShown = replayOutbox.filter((m) => m.model === replayModel && m.mode === mode);

  const headline = useMemo<HeadlineStats>(() => {
    const empty: HeadlineStats = { wallLeak: null, noWallLeak: null, rulesLeakMax: null, wallCorrect: null, wallRuns: 0, models: 0 };
    if (!latest) return empty;
    const sums = Object.values(latest.summary);
    const wallAttacks = sums.reduce((n, s) => n + (s.glass_wall?.attack_runs ?? 0), 0);
    const wallLeaks = sums.reduce((n, s) => n + (s.glass_wall?.attack_leak_runs ?? 0), 0);
    // ranges only from models with a meaningful number of attack runs
    const solid = sums.filter((s) => (s.no_wall?.attack_runs ?? 0) >= 20);
    const noWall = solid.map((s) => s.no_wall?.violation_rate).filter((v): v is number => v != null);
    const rules = solid.map((s) => s.instructions_only?.violation_rate).filter((v): v is number => v != null);
    const correct = sums.map((s) => s.glass_wall?.correctness_core).filter((v): v is number => v != null);
    return {
      wallLeak: wallAttacks ? (100 * wallLeaks) / wallAttacks : null,
      noWallLeak: noWall.length ? [Math.min(...noWall), Math.max(...noWall)] : null,
      rulesLeakMax: rules.length ? Math.max(...rules) : null,
      wallCorrect: correct.length ? Math.min(...correct) : null,
      wallRuns: sums.reduce((n, s) => n + (s.glass_wall?.runs ?? 0), 0),
      models: latest.models.length,
    };
  }, [latest]);

  const card = "rounded-2xl bg-surface shadow-[0_1px_2px_rgba(16,24,40,.06)] ring-1 ring-line";

  return (
    <div className="min-h-screen">
      <Nav />
      <Hero stats={headline} />

      <main>
        <Section eyebrow="What the agent sees" title="Same customers, same query. Only one of them is safe to hand an AI."
                 lead="These rows are exactly what each agent role receives from the database. With the wall on, every personal field arrives as a token, and the real values stay behind.">
          <BeforeAfter />
        </Section>

        <div className="border-y border-line bg-surface">
          <Section id="how" eyebrow="How it works" title="A wall in the database, not a promise from the model"
                   lead="Telling a model to never reveal contact details is advice, and advice can be talked around. Glass Wall makes sure there is nothing real to send.">
            <HowItWorks />
          </Section>
        </div>

        <Section id="demo" eyebrow="Live demo" title="Watch real agents try to leak data"
                 lead={view === "replay"
                   ? "Replaying recorded runs. Switch modes to see the same attacks with and without the wall, or go live to run an agent yourself."
                   : "Run a real agent against the deployed MCP server. Pick a mode and an attack, and watch every query and message as it happens."}>
          <div className={`${card} p-4 sm:p-5`}>
            <div className="flex flex-wrap items-center gap-3">
              <div role="tablist" aria-label="View" className="flex rounded-lg bg-surface-2 p-1">
                {(["replay", "live"] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); setSelected(null); }}
                          className={`rounded-md px-3.5 py-1.5 text-[13px] font-semibold ${view === v ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                    {v === "replay" ? "Replay recorded runs" : "Run it live"}
                  </button>
                ))}
              </div>
              <div className="min-w-[280px] flex-1 sm:max-w-[420px]">
                <ModeToggle value={mode} onChange={setMode} disabled={run?.status === "running"} />
              </div>
              {view === "replay" && latest && (
                <select value={replayModel} onChange={(e) => setReplayModel(e.target.value)} aria-label="Model"
                        className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink">
                  {latest.models.map((m) => <option key={m} value={m}>{shortModel(m)}{latest.partial_models?.[m] ? " (partial)" : ""}</option>)}
                </select>
              )}
              <span className="ml-auto flex items-center gap-2 text-[12px] text-muted" aria-live="polite">
                <span className={`inline-block h-2 w-2 rounded-full ${backend === "up" ? "bg-ok" : backend === "waking" ? "animate-pulse bg-warn" : "bg-muted"}`} aria-hidden />
                {backend === "up" ? "live backend ready" : backend === "waking" ? "waking live backend (~40 s)" : "live backend offline, replay still works"}
              </span>
            </div>

            {view === "replay" && summary && (
              <p className="mt-3 text-[13px] text-muted">
                {shortModel(replayModel)}: with Glass Wall <strong className="text-ink">{wall?.attack_leak_runs ?? 0} of {wall?.attack_runs ?? 0}</strong> attacks
                leaked · no wall <strong className="text-ink">{summary.no_wall?.attack_leak_runs ?? 0} of {summary.no_wall?.attack_runs ?? 0}</strong> ·
                rules in the prompt <strong className="text-ink">{summary.instructions_only?.attack_leak_runs ?? 0} of {summary.instructions_only?.attack_runs ?? 0}</strong>
              </p>
            )}

            <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0 space-y-5">
                <ArchitectureCanvas mode={mode} lastEvent={lastEvent} />
                <LogStream events={events} selectedIndex={selected} onSelect={setSelected} />
              </div>
              <aside className="space-y-4">
                {view === "live" ? (
                  <LiveControls mode={mode} models={models} cases={cases} model={liveModel} onModel={setLiveModel}
                                run={run} runEvents={runEvents} onRun={startRun} error={runError} ready={backend === "up"} />
                ) : (
                  <div className="rounded-xl bg-surface-2 p-4 text-[13px] leading-relaxed text-muted">
                    <p className="font-semibold text-ink">Reading the replay</p>
                    <p className="mt-2"><span className="text-leak">■ red</span>: real personal data left a tool.</p>
                    <p><span className="text-ok">● green</span>: tokens only.</p>
                    <p><span className="text-warn">▲ amber</span>: blocked, the wall held.</p>
                    <p><span className="text-info">◆ blue</span>: everything else.</p>
                    <p className="mt-2">Click any row to see the SQL the agent wrote.</p>
                  </div>
                )}
              </aside>
            </div>

            <div className="mt-5">
              {view === "replay"
                ? <OutboxInspector messages={replayOutboxShown}
                                   note="Messages the agent sent in these runs. Real values are replaced with ‹redacted› markers in this public replay." />
                : <OutboxInspector messages={outbox}
                                   onReview={(id, r) => api.reviewOutbox(id, r).then(refreshOutbox).catch(() => {})} />}
            </div>
          </div>
        </Section>

        <div className="border-t border-line bg-surface">
          <Section id="results" eyebrow="Results" title="Measured, not claimed"
                   lead="Real agents, real attacks, three setups: no wall, rules in the prompt, and Glass Wall. Leaks are scored against every real value, including spelled-out, reversed and encoded forms.">
            {latest ? <Scoreboard data={latest} /> : (
              <p className="text-[13px] text-muted">No recorded results found. Run <code className="font-mono">python -m glasswall.export</code>.</p>
            )}
          </Section>
        </div>
      </main>

      <Footer />

      <EventDrawer event={selected != null ? events[selected] ?? null : null} onClose={() => setSelected(null)}
                   replayMode={mode} onReplay={view === "live" && backend === "up" ? replayQuery : undefined} />
    </div>
  );
}
