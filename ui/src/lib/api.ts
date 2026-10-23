import type { CaseInfo, Latest, LiveRun, ModelInfo, Mode, OutboxMessage, TelemetryEvent } from "./types";

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---- Replay: static files bundled with the site ----------------------------
export const loadLatest = () => fetch("/results/latest.json").then((r) => json<Latest>(r));

export const loadReplayEvents = async (): Promise<TelemetryEvent[]> => {
  const res = await fetch("/results/events_sample.jsonl");
  if (!res.ok) return [];
  return (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l) as TelemetryEvent);
};

export const loadReplayOutbox = () =>
  fetch("/results/outbox_sample.json").then((r) => (r.ok ? (r.json() as Promise<OutboxMessage[]>) : []));

// ---- Live: the backend ------------------------------------------------------
export const health = (signal?: AbortSignal) =>
  fetch(`${API_URL}/health`, { signal }).then((r) => json<{ status: string; mounts: string[] }>(r));

export const getModels = () => fetch(`${API_URL}/api/models`).then((r) => json<ModelInfo[]>(r));
export const getCases = () => fetch(`${API_URL}/api/cases`).then((r) => json<CaseInfo[]>(r));
export const getOutbox = () => fetch(`${API_URL}/api/outbox?limit=50`).then((r) => json<OutboxMessage[]>(r));
export const getRun = (id: string) => fetch(`${API_URL}/api/runs/${id}`).then((r) => json<LiveRun>(r));

export const startRun = (body: { mode: Mode; model: string; case_id?: string; prompt?: string }) =>
  fetch(`${API_URL}/api/run`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json<LiveRun>(r));

export const reviewOutbox = (id: number, review: OutboxMessage["review"]) =>
  fetch(`${API_URL}/api/outbox/${id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ review }),
  }).then((r) => json<{ id: number; review: string }>(r));

/** Subscribe to live telemetry; reconnects with backoff. Returns an unsubscribe function. */
export function subscribeTelemetry(onEvent: (e: TelemetryEvent) => void, onStatus: (up: boolean) => void) {
  let ws: WebSocket | null = null;
  let closed = false;
  let delay = 1000;
  const connect = () => {
    ws = new WebSocket(`${API_URL.replace(/^http/, "ws")}/ws/telemetry`);
    ws.onopen = () => { delay = 1000; onStatus(true); };
    ws.onmessage = (m) => onEvent(JSON.parse(m.data as string) as TelemetryEvent);
    ws.onclose = () => {
      onStatus(false);
      if (!closed) setTimeout(connect, (delay = Math.min(delay * 2, 15000)));
    };
  };
  connect();
  return () => { closed = true; ws?.close(); };
}
