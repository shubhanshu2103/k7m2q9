import { useEffect, useState } from "react";

// Response shapes of backend/app.py. Retrospective fields are optional because the
// decision view (reveal=false) omits them entirely.
export type Rule = "hour_mean" | "first_half";

export type Point = {
  time: string;
  hour: string;
  forecast: number | null;
  publishTime: string | null;
  fallback: boolean;
  age_hours: number | null;
  actual?: number | null;
  actual_publishTimes?: string[];
  error?: number | null;
};

export type Metrics = {
  n: number;
  mae: number | null;
  bias: number | null;
  rmse: number | null;
  max_abs_error: number | null;
};

export type PriorRun = {
  publishTime: string;
  targets: number;
  points: (number | null)[];
};

export type Replay = {
  decision_date: string;
  delivery_date: string;
  cutoff: string;
  rule: Rule;
  points: Point[];
  coverage: {
    forecast: number;
    expected: number;
    runs: string[];
    fallback_intervals: number;
    actual?: number;
  };
  prior_runs: PriorRun[];
  metrics?: Metrics;
  track_record: TrackRecord;
};

/** Recent delivery days scored with actuals published at or before the decision cutoff. */
export type TrackRecord = {
  available_by: string;
  window_days: number;
  days: (Metrics & { decision_date: string; delivery_date: string })[];
  metrics: Metrics;
  hourly_bias: (number | null)[];
};

export type Day = Metrics & {
  decision_date: string;
  delivery_date: string;
  forecast: number;
  runs: string[];
  fallback_intervals: number;
  actual: number;
};

export type Distribution = {
  n: number;
  p10: number | null;
  p50: number | null;
  p90: number | null;
  abs_p50: number | null;
  abs_p90: number | null;
  share_over: number | null;
};

export type Analysis = {
  metrics: Metrics;
  distribution: Distribution;
  expected: number;
  cutoff: string;
  rule: Rule;
  sensitivity: Metrics & { alternate_rule: Rule };
  days: Day[];
  hourly: (Metrics & { hour: string })[];
  by_level: (Metrics & {
    from_mw: number;
    to_mw: number | null;
    p90: number | null;
    share_over: number | null;
  })[];
  track_record_check: {
    days: number;
    bias_correlation: number | null;
    mae_correlation: number | null;
    n: number;
    mae: number | null;
    adjusted_mae: number | null;
  };
};

export type Sweep = {
  rule: Rule;
  expected: number;
  cutoffs: (Metrics & {
    cutoff: string;
    forecast_coverage: number;
    mean_age_hours: number | null;
  })[];
};

export type Meta = {
  forecast_rows: number;
  forecast_runs: number;
  actual_rows: number;
  actual_intervals: number;
  publish_days: { date: string; rows: number; runs: number }[];
  actual_days: { date: string; rows: number }[];
  manifest: {
    retrieved_at: string;
    sources: Record<string, { url: string; sha256: string; rows: number }>;
  };
};

// The server holds one immutable snapshot, so a successful response for a given URL never
// changes during a page session. Failures are never cached.
const cache = new Map<string, unknown>();

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(path, { signal });
  if (!r.ok) {
    const body = await r.json().catch(() => null);
    throw Error(
      typeof body?.detail === "string"
        ? body.detail
        : `Request failed (${r.status}). Please check the selected scenario.`,
    );
  }
  return r.json();
}

type State<T> = { path: string | null; data: T | null; error: string };

/**
 * Load one API resource. Results are tied to the exact path that produced them, so a
 * slower response for an older scenario can never be shown for a newer one.
 */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({
    path: null,
    data: null,
    error: "",
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path || cache.has(path)) return;
    const controller = new AbortController();
    setState({ path, data: null, error: "" });
    fetchJson<T>(path, controller.signal).then(
      (data) => {
        cache.set(path, data);
        setState({ path, data, error: "" });
      },
      (e) => {
        if (controller.signal.aborted) return;
        setState({
          path,
          data: null,
          error: e instanceof Error ? e.message : "Unable to load snapshot",
        });
      },
    );
    return () => controller.abort();
  }, [path, attempt]);

  const retry = () => setAttempt((n) => n + 1);
  if (path && cache.has(path))
    return { data: cache.get(path) as T, error: "", loading: false, retry };
  const current = state.path === path;
  return {
    data: current ? state.data : null,
    error: current ? state.error : "",
    loading: !!path && (!current || (!state.data && !state.error)),
    retry,
  };
}

export const query = (params: Record<string, string>) =>
  new URLSearchParams(params).toString();
