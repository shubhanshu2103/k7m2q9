import React, { useEffect, useState, type ReactNode } from "react";
import { Info, RefreshCw, TriangleAlert } from "lucide-react";
import type { Rule } from "./api";
import { FIRST_DAY, LAST_DAY, shiftDay } from "./scenario";
import { weekdayLabel } from "./format";

export function Stat({
  label,
  value,
  unit,
  note,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  note: ReactNode;
  tone?: "warn";
}) {
  return (
    <article className={tone === "warn" ? "stat warn" : "stat"}>
      <h3>{label}</h3>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{note}</p>
    </article>
  );
}

export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warn";
}) {
  return (
    <div className={"notice " + tone}>
      {tone === "warn" ? (
        <TriangleAlert size={17} aria-hidden />
      ) : (
        <Info size={17} aria-hidden />
      )}
      <div>{children}</div>
    </div>
  );
}

/** Loading and error states. Content is rendered only when data for this exact request exists. */
export function Loadable<T>({
  state,
  label,
  children,
}: {
  state: { data: T | null; error: string; loading: boolean; retry: () => void };
  label: string;
  children: (data: T) => ReactNode;
}) {
  if (state.error)
    return (
      <section role="alert" className="error">
        <h2>{label} could not load</h2>
        <p>{state.error}</p>
        <button onClick={state.retry}>
          <RefreshCw size={15} aria-hidden /> Try again
        </button>
      </section>
    );
  if (!state.data)
    return (
      <div className="loading" role="status">
        <RefreshCw className="spin" size={20} aria-hidden /> Loading{" "}
        {label.toLowerCase()}…
      </div>
    );
  return <>{children(state.data)}</>;
}

export function DayPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (day: string) => void;
}) {
  return (
    <div className="control">
      <label htmlFor="decision">Purchase decision day</label>
      <div className="date-control">
        <button
          type="button"
          aria-label="Previous day"
          disabled={value === FIRST_DAY}
          onClick={() => onChange(shiftDay(value, -1))}
        >
          ‹
        </button>
        <input
          id="decision"
          type="date"
          min={FIRST_DAY}
          max={LAST_DAY}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v >= FIRST_DAY && v <= LAST_DAY) onChange(v);
          }}
        />
        <button
          type="button"
          aria-label="Next day"
          disabled={value === LAST_DAY}
          onClick={() => onChange(shiftDay(value, 1))}
        >
          ›
        </button>
      </div>
      <small>
        {weekdayLabel(value)} · delivery {weekdayLabel(shiftDay(value, 1))}
      </small>
    </div>
  );
}

export function CutoffPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (cutoff: string) => void;
}) {
  return (
    <div className="control">
      <label htmlFor="cutoff">
        Decision cutoff <span className="tag">Assumption</span>
      </label>
      <input
        id="cutoff"
        type="time"
        value={value}
        onChange={(e) => {
          if (/^\d{2}:\d{2}$/.test(e.target.value)) onChange(e.target.value);
        }}
      />
      <small>UTC on the purchase day. Not a confirmed market deadline.</small>
    </div>
  );
}

export function RulePicker({
  value,
  onChange,
}: {
  value: Rule;
  onChange: (rule: Rule) => void;
}) {
  return (
    <div className="control comparison">
      <label htmlFor="rule">
        Actuals comparison <span className="tag">Assumption</span>
      </label>
      <select
        id="rule"
        value={value}
        onChange={(e) => onChange(e.target.value as Rule)}
      >
        <option value="hour_mean">Mean of both half-hours</option>
        <option value="first_half">First half-hour only</option>
      </select>
      <small>
        How an hourly forecast is matched to half-hour actuals. Provisional.
      </small>
    </div>
  );
}

/** True when the user has asked the system to minimise motion. */
export function useReducedMotion() {
  const query = "(prefers-reduced-motion: reduce)";
  const [reduced, setReduced] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
