import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchitectureCanvas } from "./components/ArchitectureCanvas";
import { EventDrawer } from "./components/EventDrawer";
import { Header, type Backend } from "./components/Header";
import { LiveControls } from "./components/LiveControls";
import { LogStream } from "./components/LogStream";
import { MetricCard } from "./components/MetricCard";
import { ModeToggle } from "./components/ModeToggle";
import { OutboxInspector } from "./components/OutboxInspector";
import { Scoreboard } from "./components/Scoreboard";
import * as api from "./lib/api";
import {
  MODE_LABEL, shortModel,
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

  return (
    <div className="min-h-screen">
      <Header view={view} onView={(v) => { setView(v); setSelected(null); }} backend={backend} />

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-4">
        {view === "replay" ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Attacks that leaked data · with Glass Wall" value={summary?.glass_wall?.violation_rate ?? null} unit="%"
                        tone={summary?.glass_wall?.violation_rate == null ? undefined : summary.glass_wall.violation_rate === 0 ? "green" : "red"}
                        status={summary?.glass_wall?.violation_rate === 0 ? "WALL HELD" : "LEAK"}
                        sublabel={wall ? `${wall.attack_leak_runs} of ${wall.attack_runs} attacks · ${wall.attack_leak_runs + wall.normal_leak_runs} leaks in all ${wall.runs} runs` : undefined} />
            <MetricCard label="Attacks that leaked data · no wall" value={summary?.no_wall?.violation_rate ?? null} unit="%"
                        tone={summary?.no_wall?.violation_rate == null ? undefined : summary.no_wall.violation_rate ? "red" : "green"}
                        sublabel={summary?.no_wall ? `${summary.no_wall.attack_leak_runs} of ${summary.no_wall.attack_runs} attacks got real data out` : undefined} />
            <MetricCard label="Attacks that leaked data · rules in the prompt" value={summary?.instructions_only?.violation_rate ?? null} unit="%"
                        tone={summary?.instructions_only?.violation_rate == null ? undefined : summary.instructions_only.violation_rate ? "red" : "green"}
                        sublabel={'Same access as "no wall", but told "never reveal contact details"'} />
            <MetricCard label="Normal questions answered correctly · with Glass Wall" value={summary?.glass_wall?.correctness_core ?? null} unit="%"
                        tone="blue" status="STILL USEFUL"
                        sublabel={summary?.no_wall?.correctness_core != null ? `Without the wall: ${Math.round(summary.no_wall.correctness_core)}%` : undefined} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard label="Events this session" value={liveEvents.length} tone="blue" />
            <MetricCard label="Leak signals" value={liveEvents.filter((e) => e.color_tag === "red").length} tone="red" sublabel="PII patterns left a tool" />
            <MetricCard label="Tokens-only results" value={liveEvents.filter((e) => e.color_tag === "green").length} tone="green" />
            <MetricCard label="Wall held" value={liveEvents.filter((e) => e.color_tag === "amber").length} tone="amber" status="WARN" sublabel="blocked or denied by the database" />
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <ArchitectureCanvas mode={mode} lastEvent={lastEvent} />
            <LogStream events={events} selectedIndex={selected} onSelect={setSelected} />
          </div>

          <aside className="space-y-3">
            <section className="space-y-2 rounded border border-line bg-surface p-3">
              <h2 className="text-[13px] font-semibold">Mode</h2>
              <ModeToggle value={mode} onChange={setMode} disabled={run?.status === "running"} />
              {view === "replay" && latest && (
                <label className="block text-[12px] text-muted">
                  Model
                  <select value={replayModel} onChange={(e) => setReplayModel(e.target.value)}
                          className="mt-1 block w-full rounded border border-line bg-surface-2 px-2 py-1.5 text-[13px] text-ink">
                    {latest.models.map((m) => <option key={m} value={m}>{shortModel(m)}</option>)}
                  </select>
                </label>
              )}
              <p className="text-[12px] text-muted">
                {view === "replay"
                  ? `Replaying recorded telemetry for featured attacks in ${MODE_LABEL[mode]}.`
                  : "Switches which MCP endpoint and prompt the next run uses. The agent can't change it."}
              </p>
            </section>

            {view === "live" && (
              <LiveControls mode={mode} models={models} cases={cases} model={liveModel} onModel={setLiveModel}
                            run={run} runEvents={runEvents} onRun={startRun} error={runError} ready={backend === "up"} />
            )}
          </aside>
        </div>

        {view === "replay"
          ? <OutboxInspector messages={replayOutboxShown}
                             note="Recorded messages from featured attacks. Real values are replaced with ‹redacted› markers in this public replay." />
          : <OutboxInspector messages={outbox}
                             onReview={(id, r) => api.reviewOutbox(id, r).then(refreshOutbox).catch(() => {})} />}

        {latest ? <Scoreboard data={latest} /> : (
          <p className="rounded border border-line bg-surface p-4 text-[13px] text-muted">
            No recorded results found. Run <code className="font-mono">python -m glasswall.export</code>.
          </p>
        )}
      </main>

      <EventDrawer event={selected != null ? events[selected] ?? null : null} onClose={() => setSelected(null)}
                   replayMode={mode} onReplay={view === "live" && backend === "up" ? replayQuery : undefined} />
    </div>
  );
}
