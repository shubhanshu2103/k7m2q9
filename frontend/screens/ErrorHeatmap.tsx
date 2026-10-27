import React, { useState } from "react";
import type { Analysis } from "../api";
import { dateLabel, errorWord, signed, weekdayLabel } from "../format";

// Colour saturates at this many MW either way; the exact value is always in the tooltip.
const SCALE_MW = 4000;
const HOURS = Array.from(
  { length: 24 },
  (_, h) => `${String(h).padStart(2, "0")}:00`,
);

/** Diverging fill: red for over-forecast, blue for under, white at zero. */
export function errorFill(error: number | null) {
  if (error == null) return undefined;
  const t = Math.min(Math.abs(error) / SCALE_MW, 1);
  const [r, g, b] = error >= 0 ? [168, 71, 63] : [61, 111, 168];
  const mix = (c: number) => Math.round(255 + (c - 255) * t);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

type Cell = { day: string; hour: string; error: number | null };

/**
 * Every delivery hour of the month at once. Rows are delivery days, columns target hours.
 * Selecting a day opens its replay; the exact numbers are in the per-day table below.
 */
export function ErrorHeatmap({
  analysis,
  worst,
  openDay,
}: {
  analysis: Analysis;
  worst: Set<string>;
  openDay: (decision: string) => void;
}) {
  const [focus, setFocus] = useState<Cell | null>(null);
  return (
    <section className="panel" aria-labelledby="heatmap-title">
      <div className="panel-head">
        <div>
          <h2 id="heatmap-title">The month at a glance</h2>
          <p>
            Every delivery hour in January: forecast minus actual, MW. Red: the
            forecast was too high; blue: too low; hatched: no paired value.
            Select a day to replay it.
          </p>
        </div>
        <div className="heat-legend" aria-hidden>
          <span>Too low</span>
          <i />
          <span>Too high</span>
          <small>
            −{SCALE_MW / 1000} GW · 0 · +{SCALE_MW / 1000} GW
          </small>
        </div>
      </div>
      <div
        className="heatmap"
        role="group"
        aria-label="Error by delivery day and hour"
      >
        <div className="heat-row heat-hours" aria-hidden>
          <span />
          {HOURS.map((h, i) => (
            <span key={h}>{i % 6 === 0 ? h : ""}</span>
          ))}
        </div>
        {analysis.grid.map((row, i) => {
          const day = analysis.days[i];
          return (
            <div className="heat-row" key={day.decision_date}>
              <button
                type="button"
                className={
                  worst.has(day.decision_date) ? "heat-day worst" : "heat-day"
                }
                onClick={() => openDay(day.decision_date)}
                aria-label={`Replay delivery ${weekdayLabel(day.delivery_date)} with hindsight`}
              >
                {dateLabel(day.delivery_date)}
              </button>
              {row.map((error, h) => (
                <span
                  key={h}
                  className={error == null ? "heat-cell empty" : "heat-cell"}
                  style={{ background: errorFill(error) }}
                  title={`${weekdayLabel(day.delivery_date)} ${HOURS[h]} UTC: ${
                    error == null
                      ? "no paired value"
                      : `${signed(error)} MW (${errorWord(error)})`
                  }`}
                  onMouseEnter={() =>
                    setFocus({ day: day.delivery_date, hour: HOURS[h], error })
                  }
                  onMouseLeave={() => setFocus(null)}
                />
              ))}
            </div>
          );
        })}
      </div>
      <p className="chart-foot">
        <span>
          {focus
            ? `${weekdayLabel(focus.day)} ${focus.hour} UTC: ${
                focus.error == null
                  ? "no paired value"
                  : `${signed(focus.error)} MW (${errorWord(focus.error)})`
              }`
            : "Hover a cell for its value. Bold dates are the five largest misses."}
        </span>
      </p>
    </section>
  );
}
