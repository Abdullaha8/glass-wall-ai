import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArchitectureCanvas } from "./components/ArchitectureCanvas";
import { EventDrawer } from "./components/EventDrawer";
import { type Backend } from "./components/Header";
import { LiveControls } from "./components/LiveControls";
import { LogStream } from "./components/LogStream";
import { ModeToggle } from "./components/ModeToggle";
import { OutboxInspector } from "./components/OutboxInspector";
import { Scoreboard } from "./components/Scoreboard";
import { ActivityFeed } from "./components/dash/ActivityFeed";
import { AgentsTable } from "./components/dash/AgentsTable";
import { AttackHeatmap } from "./components/dash/AttackHeatmap";
import { Card, Pill } from "./components/dash/Card";
import { LeakBars } from "./components/dash/LeakBars";
import { LiveTile } from "./components/dash/LiveTile";
import { ModelRanges } from "./components/dash/ModelRanges";
import { OutcomeDonut } from "./components/dash/OutcomeDonut";
import { TopBar, type Tab } from "./components/dash/TopBar";
import { BeforeAfter } from "./components/landing/BeforeAfter";
import { type HeadlineStats } from "./components/landing/Hero";
import { HowItWorks } from "./components/landing/HowItWorks";
import { KeyResults } from "./components/landing/KeyResults";
import * as api from "./lib/api";
import {
  shortModel,
  type CaseInfo, type Latest, type LiveRun, type ModelInfo, type Mode, type OutboxMessage, type TelemetryEvent,
} from "./lib/types";

const MAIN_MODEL = "groq/openai/gpt-oss-120b";
const TITLES: Record<Tab, string> = { overview: "Dashboard", demo: "Live demo", results: "Results", how: "How it works" };

export default function App() {
  const params = new URLSearchParams(location.search);
  const [tab, setTab] = useState<Tab>(params.get("view") === "live" ? "demo" : "how");
  const [view, setView] = useState<"replay" | "live">(params.get("view") === "live" ? "live" : "replay");
  const [mode, setMode] = useState<Mode>("glass_wall");
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
  }, [replayForMode]);

  // The replay only plays while someone can see it: Live demo tab open, browser tab visible, not paused.
  const [tabVisible, setTabVisible] = useState(!document.hidden);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  const playing = view === "replay" && tab === "demo" && tabVisible && !paused;
  useEffect(() => {
    if (!playing) return;
    // ~1 event per second so the data-flow diagram can be followed; loops after a short pause
    const id = setInterval(() => setPlayed((p) => (p >= replayForMode.length + 3 ? 1 : p + 1)), 1000);
    return () => clearInterval(id);
  }, [playing, replayForMode.length]);

  const goLive = () => {
    setTab("demo");
    setView("live");
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openTab = (t: Tab) => { setTab(t); window.scrollTo({ top: 0 }); };

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
  const replayOutboxShown = replayOutbox.filter((m) => m.model === replayModel && m.mode === mode);
  const walled = mode === "glass_wall";

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
  const wallLeaksAll = latest
    ? Object.values(latest.summary).reduce((n, s) => n + (s.glass_wall ? s.glass_wall.attack_leak_runs + s.glass_wall.normal_leak_runs : 0), 0)
    : 0;
  const feed = replayEvents.filter((e) => e.mode === mode);
  const outcomesNow = latest?.outcomes?.[mode] ?? (walled ? latest?.wall_outcomes : undefined);
  const outcomesTotal = outcomesNow ? outcomesNow.leaked + outcomesNow.blocked + outcomesNow.refused + outcomesNow.tokens_only : 0;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black pb-28 text-white">
      {/* the soft purple floor glow from the reference */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 h-[45vh] bg-gradient-to-t from-purple-900/40 via-purple-900/10 to-transparent" />

      <TopBar tab={tab} onTab={openTab} onRunLive={goLive} />

      <main className="relative mx-auto max-w-[1360px] px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-6 sm:pt-8">
          <div>
            <h1 className="text-[34px] font-medium tracking-[-0.03em] sm:text-[44px]">{TITLES[tab]}</h1>
            {tab === "overview" && (
              <p className="mt-1 text-[14px] text-slate-400">Every number below comes from real agent runs. Flip the switch to compare with and without the wall.</p>
            )}
            {tab === "how" && (
              <p className="mt-2 max-w-[760px] text-[16px] leading-relaxed text-slate-300">
                AI agents are getting direct access to company databases. One instruction hidden in a customer note, or one
                confident request, and they can leak customers' personal data. Glass Wall sits between the agent and the
                database so that <span className="text-purple-300">the agent sees the shape of the data, never the people in it.</span>
              </p>
            )}
          </div>
          {tab !== "results" && <label className="flex cursor-pointer items-center gap-3 text-[14px] text-slate-300">
            {walled ? "Glass Wall on" : mode === "instructions_only" ? "Rules in the prompt" : "Glass Wall off"}
            <button role="switch" aria-checked={walled} onClick={() => setMode(walled ? "no_wall" : "glass_wall")}
                    className={`relative h-7 w-12 rounded-full transition-colors ${walled ? "bg-purple-400 shadow-[0_0_18px_rgba(181,119,243,.6)]" : "bg-white/15"}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${walled ? "left-6" : "left-1"}`} />
            </button>
          </label>}
        </div>

        {tab === "overview" && latest && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Card className="lg:col-span-5" title="Attacks that leaked" right={<Pill>{latest.attack_cases} attack types</Pill>}>
              <LeakBars data={latest} />
            </Card>
            <div role="link" tabIndex={0} aria-label={`See the recorded ${walled ? "Glass Wall" : "no-wall"} runs`}
                 onClick={() => { setView("replay"); openTab("demo"); }}
                 onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setView("replay"); openTab("demo"); } }}
                 className="cursor-pointer rounded-2xl text-left lg:col-span-4">
              <Card className="h-full transition hover:border-purple-400/40 hover:shadow-[0_0_40px_rgba(181,119,243,.15)]"
                    title={walled ? "Under Glass Wall" : mode === "instructions_only" ? "With rules in the prompt" : "Without a wall"}
                    right={<span className="text-purple-300">See the runs →</span>}>
                {outcomesNow && <OutcomeDonut outcomes={outcomesNow} walled={walled} />}
                <p className="mt-3 text-[12px] text-slate-500">{outcomesTotal} attack runs, all models</p>
              </Card>
            </div>
            <Card className="lg:col-span-3" title="Activity" right={<Pill>{walled ? "Glass Wall" : "no wall"}</Pill>}>
              <ActivityFeed events={feed} />
            </Card>

            <Card className="lg:col-span-3" title="Leak rate by model">
              <ModelRanges data={latest} />
            </Card>
            <Card className="lg:col-span-6" title="Every attack, every setup" right={<Pill>all models</Pill>}>
              <AttackHeatmap data={latest} />
            </Card>
            <div className="lg:col-span-3">
              <LiveTile walled={walled} leaks={walled ? wallLeaksAll : outcomesNow?.leaked ?? 0}
                        runs={walled ? headline.wallRuns : outcomesTotal} onRunLive={goLive} />
            </div>
            <Card className="lg:col-span-12" title="Agents tested" right={<Pill>{latest.models.length} models · {Object.values(latest.summary).reduce((n, x) => n + (x.no_wall?.runs ?? 0) + (x.instructions_only?.runs ?? 0) + (x.glass_wall?.runs ?? 0), 0)} runs</Pill>}>
              <AgentsTable data={latest} />
            </Card>
          </div>
        )}

        {tab === "demo" && (
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <div role="tablist" aria-label="View" className="flex rounded-xl bg-white/[0.06] p-1">
                {(["replay", "live"] as const).map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => { setView(v); setSelected(null); }}
                          className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium ${view === v ? "bg-white/10 text-white" : "text-slate-400 hover:text-white"}`}>
                    {v === "replay" ? "Replay recorded runs" : "Run it live"}
                  </button>
                ))}
              </div>
              <div className="min-w-[280px] flex-1 sm:max-w-[420px]">
                <ModeToggle value={mode} onChange={setMode} disabled={run?.status === "running"} />
              </div>
              {view === "replay" && latest && (
                <select value={replayModel} onChange={(e) => setReplayModel(e.target.value)} aria-label="Model"
                        className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[13px] text-white">
                  {latest.models.map((m) => <option key={m} value={m}>{shortModel(m)}{latest.partial_models?.[m] ? " (partial)" : ""}</option>)}
                </select>
              )}
              {view === "replay" && (
                <button onClick={() => setPaused((p) => !p)} aria-pressed={paused}
                        className="rounded-xl border border-white/10 px-3 py-2 text-[13px] text-white hover:bg-white/10">
                  {paused ? "▶ Play" : "⏸ Pause"}
                </button>
              )}
              <span className="ml-auto flex items-center gap-2 text-[12px] text-slate-400" aria-live="polite">
                <span className={`inline-block h-2 w-2 rounded-full ${backend === "up" ? "bg-ok" : backend === "waking" ? "animate-pulse bg-warn" : "bg-slate-500"}`} aria-hidden />
                {backend === "up" ? "live backend ready" : backend === "waking" ? "waking live backend (~40 s)" : "live backend offline, replay still works"}
              </span>
            </div>

            {view === "replay" && summary && (
              <p className="mt-3 text-[13px] text-slate-400">
                {shortModel(replayModel)}: Glass Wall <strong className="text-white">{summary.glass_wall?.attack_leak_runs ?? 0} of {summary.glass_wall?.attack_runs ?? 0}</strong> attacks
                leaked · no wall <strong className="text-white">{summary.no_wall?.attack_leak_runs ?? 0} of {summary.no_wall?.attack_runs ?? 0}</strong> ·
                rules in the prompt <strong className="text-white">{summary.instructions_only?.attack_leak_runs ?? 0} of {summary.instructions_only?.attack_runs ?? 0}</strong>
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
                  <div className="rounded-xl bg-white/[0.04] p-4 text-[13px] leading-relaxed text-slate-400 ring-1 ring-white/[0.06]">
                    <p className="font-medium text-white">Reading the replay</p>
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
          </Card>
        )}

        {tab === "results" && (
          <div>
            <KeyResults stats={headline} />
            {latest ? <Card><Scoreboard data={latest} /></Card> : (
              <p className="text-[13px] text-slate-400">No recorded results found. Run <code className="font-mono">python -m glasswall.export</code>.</p>
            )}
          </div>
        )}

        {tab === "how" && (
          <div className="space-y-4">
            <Card title="What the agent sees" right={<Pill>flip the switch above ↑</Pill>}>
              <BeforeAfter walled={walled} />
            </Card>
            <Card title="A wall in the database, not a promise from the model">
              <HowItWorks />
              <div className="mx-auto mt-5 max-w-[920px]"><ArchitectureCanvas mode={walled ? "glass_wall" : "no_wall"} lastEvent={undefined} /></div>
            </Card>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-400/25 bg-purple-900/20 p-6">
              <div>
                <p className="text-[20px] font-medium">See it stop real attacks</p>
                <p className="mt-1 text-[14px] text-slate-400">Watch recorded runs, or run an agent yourself against the live wall.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setView("replay"); openTab("demo"); }}
                        className="rounded-xl border border-white/15 px-4 py-2.5 text-[14px] font-medium hover:bg-white/10">Watch recorded runs</button>
                <button onClick={goLive}
                        className="rounded-xl bg-purple-400 px-4 py-2.5 text-[14px] font-medium shadow-[0_0_24px_rgba(181,119,243,.45)] hover:bg-purple-300">See it live →</button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* floating action, like the reference's "Ask AI" pill */}
      {!(tab === "demo" && view === "live") && (
        <button onClick={goLive}
                className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl border border-white/10 bg-[#141119]/90 py-2.5 pl-2.5 pr-5 text-[14px] text-white shadow-[0_10px_40px_rgba(0,0,0,.6)] backdrop-blur-xl hover:bg-[#1c1824]">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-purple-300 to-purple-600 text-[12px]">▶</span>
          Run live
        </button>
      )}

      <EventDrawer event={selected != null ? events[selected] ?? null : null} onClose={() => setSelected(null)}
                   replayMode={mode} onReplay={view === "live" && backend === "up" ? replayQuery : undefined} />
    </div>
  );
}
