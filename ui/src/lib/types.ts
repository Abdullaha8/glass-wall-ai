export type Mode = "no_wall" | "instructions_only" | "glass_wall";
export type Color = "blue" | "green" | "amber" | "red";

export const MODES: Mode[] = ["no_wall", "instructions_only", "glass_wall"];
export const MODE_LABEL: Record<Mode, string> = {
  no_wall: "No-Wall",
  instructions_only: "Instructions-Only",
  glass_wall: "Glass Wall",
};
export const MODE_VAR: Record<Mode, string> = {
  no_wall: "var(--mode-no-wall)",
  instructions_only: "var(--mode-instr)",
  glass_wall: "var(--mode-wall)",
};

/** SPEC §3.4 */
export interface TelemetryEvent {
  timestamp: string;
  event_type: string;
  agent_id: string;
  run_id: string;
  mode: Mode;
  model: string;
  role: string | null;
  tool: string | null;
  query_hash: string | null;
  query: string | null;
  row_count: number | null;
  token_count: number;
  pii_pattern_count: number;
  duration_ms: number;
  severity: "info" | "ok" | "warn" | "critical";
  color_tag: Color;
  detail: string;
  recipient?: string;
  original_color_tag?: Color;
}

export interface ModeSummary {
  runs: number;
  attack_runs: number;
  attack_leak_runs: number;
  violation_rate: number | null;
  mean_severity: number | null;
  leaked_items: { name: number; email: number; phone: number };
  by_family: Record<string, { runs: number; leak_runs: number; violation_rate: number | null }>;
  normal_runs: number;
  correctness: number | null;
  correctness_core: number | null;
  normal_leak_runs: number;
  refusal_rate: number | null;
  error_rate: number | null;
  latency_p50_ms: number | null;
  latency_p95_ms: number | null;
  avg_tokens: number | null;
}

export interface CaseCell {
  model: string;
  case_id: string;
  mode: Mode;
  title: string;
  kind: "attack" | "normal";
  runs: number;
  leaked: number;
  correct: number;
  refused: number;
  errors: number;
}

export interface Latest {
  batch: string;
  exported_at: string;
  first_run: string;
  last_run: string;
  models: string[];
  modes: Mode[];
  trials: number;
  attack_cases?: number;
  summary: Record<string, Partial<Record<Mode, ModeSummary>> & { _utility_cost: number | null }>;
  cases: CaseCell[];
  notes: { leak_definition: string; manual_review: string[]; expected_unanswerable_under_wall: string[] };
}

export interface OutboxMessage {
  id: number;
  ts: string;
  run_id: string;
  mode: Mode;
  model: string;
  recipient: string;
  body: string;
  token_count: number;
  pii_suspected: boolean;
  review: "unreviewed" | "confirmed_leak" | "false_positive";
  case_id?: string;
}

export interface ModelInfo { id: string; label: string }
export interface CaseInfo { id: string; kind: "attack" | "normal"; title: string; family: string; prompt: string }

export interface LiveRun {
  run_id: string;
  status: "running" | "done" | "error";
  mode: Mode;
  model: string;
  prompt: string;
  final?: string;
  error?: string | null;
  steps?: number;
  latency_ms?: number;
}

export const shortModel = (id: string) => id.split("/").pop() ?? id;
