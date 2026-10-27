import type { Rule } from "./api";

export type View = "replay" | "analysis" | "method";

export type Scenario = {
  view: View;
  decision: string;
  cutoff: string;
  rule: Rule;
  reveal: boolean;
  // Set only when a replay was opened from the Accuracy lab, to label why hindsight is on.
  from: "lab" | null;
};

export const DEFAULT: Scenario = {
  view: "replay",
  decision: "2026-01-15",
  cutoff: "09:30",
  rule: "hour_mean",
  reveal: false,
  from: null,
};

export const FIRST_DAY = "2026-01-01";
export const LAST_DAY = "2026-01-31";
const VIEWS: View[] = ["replay", "analysis", "method"];
const RULES: Rule[] = ["hour_mean", "first_half"];

const validDate = (s: string) => /^2026-01-(0[1-9]|[12]\d|3[01])$/.test(s);
const validCutoff = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/**
 * Read a scenario from a shareable URL. Invalid values fall back to defaults and are
 * reported, never silently passed to the API. Mirrors backend/engine.py parse_scenario.
 */
export function fromSearch(search: string): {
  scenario: Scenario;
  invalid: string[];
} {
  const q = new URLSearchParams(search);
  const invalid: string[] = [];
  const pick = <T>(key: string, ok: (v: string) => boolean, fallback: T): T => {
    const v = q.get(key);
    if (v === null) return fallback;
    if (ok(v)) return v as T;
    invalid.push(key);
    return fallback;
  };
  const view = pick<View>(
    "view",
    (v) => VIEWS.includes(v as View),
    DEFAULT.view,
  );
  const reveal =
    pick<string>("reveal", (v) => v === "1" || v === "0", "0") === "1";
  return {
    scenario: {
      view,
      decision: pick("decision", validDate, DEFAULT.decision),
      cutoff: pick("cutoff", validCutoff, DEFAULT.cutoff),
      rule: pick<Rule>("rule", (v) => RULES.includes(v as Rule), DEFAULT.rule),
      // Hindsight is meaningful only on the replay view.
      reveal: view === "replay" && reveal,
      from:
        view === "replay" && reveal && q.get("from") === "lab" ? "lab" : null,
    },
    invalid,
  };
}

export function toSearch(s: Scenario): string {
  const q = new URLSearchParams({
    view: s.view,
    cutoff: s.cutoff,
    rule: s.rule,
  });
  if (s.view === "replay") {
    q.set("decision", s.decision);
    q.set("reveal", s.reveal ? "1" : "0");
    if (s.from) q.set("from", s.from);
  }
  return "?" + q.toString();
}

/**
 * Apply a user change. Changing the purchase day or cutoff starts a new decision, so it
 * returns to the forecast-only view unless the caller explicitly asks for hindsight.
 * Changing only the comparison rule keeps the current view.
 */
export function change(current: Scenario, patch: Partial<Scenario>): Scenario {
  const next = { ...current, ...patch };
  const newDecision =
    next.decision !== current.decision || next.cutoff !== current.cutoff;
  if (newDecision && patch.reveal === undefined) next.reveal = false;
  if (next.view !== "replay") next.reveal = false;
  if (!next.reveal) next.from = null;
  return next;
}

export function shiftDay(day: string, delta: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
