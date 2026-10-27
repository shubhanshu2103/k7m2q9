import React, { useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, Download, Eye, EyeOff, LockKeyhole } from "lucide-react";
import {
  query,
  useApi,
  type Point,
  type Replay,
  type TrackRecord,
} from "../api";
import type { Scenario } from "../scenario";
import {
  COLORS,
  dateLabel,
  errorWord,
  fmt,
  hours,
  leadHours,
  ruleLabel,
  runLabel,
  signed,
  stamp,
  weekdayLabel,
} from "../format";
import {
  CutoffPicker,
  DayPicker,
  Loadable,
  Notice,
  RulePicker,
  Stat,
} from "../ui";

type Props = {
  scenario: Scenario;
  onChange: (patch: Partial<Scenario>) => void;
};

const PRIOR_DASH = ["6 4", "2 4", "10 4 2 4"];

export function ReplayScreen({ scenario, onChange }: Props) {
  const { decision, cutoff, rule, reveal } = scenario;
  const params = query({ decision, cutoff, rule, reveal: String(reveal) });
  const state = useApi<Replay>("/api/replay?" + params);
  return (
    <>
      <ModeBanner scenario={scenario} onChange={onChange} />
      <section className="controls" aria-label="Scenario controls">
        <DayPicker
          value={decision}
          onChange={(d) => onChange({ decision: d })}
        />
        <CutoffPicker
          value={cutoff}
          onChange={(c) => onChange({ cutoff: c })}
        />
        {reveal && (
          <RulePicker value={rule} onChange={(r) => onChange({ rule: r })} />
        )}
      </section>
      <Loadable state={state} label="Replay">
        {(replay) => (
          <ReplayBody
            replay={replay}
            reveal={reveal}
            exportHref={"/api/export?" + params}
            onChange={onChange}
          />
        )}
      </Loadable>
    </>
  );
}

function ModeBanner({ scenario, onChange }: Props) {
  const { reveal, decision, cutoff } = scenario;
  return (
    <section
      className={reveal ? "mode-banner hindsight" : "mode-banner decision"}
      aria-label="View mode"
    >
      <div className="mode-icon">
        {reveal ? (
          <Eye size={20} aria-hidden />
        ) : (
          <LockKeyhole size={20} aria-hidden />
        )}
      </div>
      <div>
        <strong>
          {reveal ? "Hindsight view" : "Decision view"}
          <span className="mode-tag">
            {reveal ? "Retrospective" : "No hindsight"}
          </span>
        </strong>
        <p>
          {reveal
            ? `Actuals and errors below were not available at ${cutoff} UTC on ${weekdayLabel(decision)}.` +
              (scenario.from === "lab"
                ? " Opened from the Accuracy lab to inspect this day."
                : "")
            : `Only forecasts created at or before ${cutoff} UTC on ${weekdayLabel(decision)}. Actuals are not part of this view or its export.`}
        </p>
      </div>
      <button
        type="button"
        className={reveal ? "reveal selected" : "reveal"}
        aria-pressed={reveal}
        onClick={() => onChange({ reveal: !reveal })}
      >
        {reveal ? (
          <EyeOff size={17} aria-hidden />
        ) : (
          <Eye size={17} aria-hidden />
        )}
        {reveal ? "Hide actuals" : "Reveal actuals"}
      </button>
    </section>
  );
}

function ReplayBody({
  replay,
  reveal,
  exportHref,
  onChange,
}: {
  replay: Replay;
  reveal: boolean;
  exportHref: string;
  onChange: Props["onChange"];
}) {
  const [showPrior, setShowPrior] = useState(true);
  const { points, coverage, prior_runs: prior } = replay;
  const newest = coverage.runs[coverage.runs.length - 1];
  const withForecast = points.filter((p) => p.forecast !== null);
  const missing = points.filter((p) => p.forecast === null).map((p) => p.hour);
  const leads = withForecast.map((p) => leadHours(p.time, p.publishTime!));
  const low = minBy(withForecast, (p) => p.forecast!);
  const high = minBy(withForecast, (p) => -p.forecast!);
  const revision = revisionSummary(points, prior[0]?.points);
  const worst = reveal
    ? minBy(
        points.filter((p) => p.error != null),
        (p) => -Math.abs(p.error!),
      )
    : null;
  const m = replay.metrics;
  const rows = points.map((p, i) => ({
    ...p,
    ...Object.fromEntries(prior.map((r, j) => [`prior${j}`, r.points[i]])),
  }));

  return (
    <>
      <p className="context-line">
        <span>
          <span className="dot" aria-hidden /> Delivery{" "}
          {weekdayLabel(replay.delivery_date)} 2026 · 24 hourly targets
        </span>
        <span>Eligible forecasts: publishTime ≤ {stamp(replay.cutoff)}</span>
      </p>
      <div className="stats">
        <Stat
          label="Forecast coverage"
          value={`${coverage.forecast}/24`}
          unit="hourly targets"
          tone={coverage.forecast < 24 ? "warn" : undefined}
          note={
            missing.length
              ? `No eligible forecast for ${missing.join(", ")}. Left blank, never filled.`
              : "Every target has an eligible forecast"
          }
        />
        {reveal && m ? (
          <>
            <Stat
              label="Mean absolute error"
              value={fmt(m.mae)}
              unit="MW"
              note={`${m.n} paired targets · ${ruleLabel(replay.rule).toLowerCase()}`}
            />
            <Stat
              label="Signed bias"
              value={signed(m.bias)}
              unit="MW · forecast minus actual"
              note={
                m.bias == null
                  ? "No paired targets"
                  : `On average an ${errorWord(m.bias)} this day`
              }
            />
            <Stat
              label="Largest miss"
              value={worst ? signed(worst.error) : "N/A"}
              unit={worst ? `MW at ${worst.hour} UTC` : "MW"}
              note={
                worst
                  ? `${errorWord(worst.error!)} · RMSE ${fmt(m.rmse)} MW`
                  : "No paired targets"
              }
            />
          </>
        ) : (
          <>
            <Stat
              label="Latest run used"
              value={newest ? runLabel(newest) : "None"}
              unit={
                newest
                  ? `created ${hours(withForecast.find((p) => p.publishTime === newest)?.age_hours)} before cutoff`
                  : "no eligible run"
              }
              note={
                coverage.fallback_intervals
                  ? `${coverage.fallback_intervals} target(s) come from an older run`
                  : coverage.runs.length
                    ? "One run supplies every covered target"
                    : "Nothing was published before this cutoff"
              }
            />
            <Stat
              label="Lead time"
              value={
                leads.length
                  ? `${fmt(Math.min(...leads), 1)}–${fmt(Math.max(...leads), 1)}`
                  : "N/A"
              }
              unit="hours from creation to target"
              note="From each forecast's creation to its delivery hour"
            />
            <Stat
              label="Change vs previous run"
              value={revision ? signed(revision.mean) : "N/A"}
              unit="MW mean across shared targets"
              note={
                revision && prior[0]
                  ? `Largest hourly move ${signed(revision.max.delta)} MW at ${revision.max.hour} vs ${runLabel(prior[0].publishTime)}`
                  : "No earlier eligible run covers these targets"
              }
            />
          </>
        )}
      </div>

      <section className="panel chart-panel">
        <div className="panel-head">
          <div>
            <h2>Delivery-day wind profile</h2>
            <p>
              MW by target start time (UTC)
              {low &&
                high &&
                ` · lowest ${fmt(low.forecast)} MW at ${low.hour}, highest ${fmt(high.forecast)} MW at ${high.hour}`}
            </p>
          </div>
          <div className="legend" aria-label="Chart legend">
            <span>
              <i className="key forecast" aria-hidden /> Forecast used
              {newest ? ` (${runLabel(newest)})` : ""}
            </span>
            {showPrior &&
              prior.map((r, j) => (
                <span key={r.publishTime}>
                  <svg width="22" height="4" aria-hidden>
                    <line
                      x1="0"
                      y1="2"
                      x2="22"
                      y2="2"
                      stroke={COLORS.prior}
                      strokeWidth="2"
                      strokeDasharray={PRIOR_DASH[j]}
                    />
                  </svg>
                  Earlier run {runLabel(r.publishTime)}
                </span>
              ))}
            {reveal && (
              <span>
                <i className="key actual" aria-hidden /> Actual ·{" "}
                {ruleLabel(replay.rule).toLowerCase()}
              </span>
            )}
          </div>
        </div>
        {prior.length > 0 && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={showPrior}
              onChange={(e) => setShowPrior(e.target.checked)}
            />
            Show {prior.length} earlier eligible run
            {prior.length > 1 ? "s" : ""} (all published before the cutoff)
          </label>
        )}
        <div
          className="chart"
          role="img"
          aria-label={`Forecast wind generation by hour for ${dateLabel(replay.delivery_date)}. Values are listed in the table below.`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              margin={{ top: 16, right: 24, left: 4, bottom: 4 }}
            >
              <defs>
                <linearGradient id="windArea" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={COLORS.forecast}
                    stopOpacity={0.18}
                  />
                  <stop
                    offset="100%"
                    stopColor={COLORS.forecast}
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e6e7e5" />
              <XAxis
                dataKey="hour"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={(v) => fmt(v)}
                tick={{ fontSize: 12 }}
                domain={[0, "auto"]}
              />
              <Tooltip
                content={
                  <ProfileTip
                    prior={replay.prior_runs}
                    reveal={reveal}
                    showPrior={showPrior}
                  />
                }
              />
              <Area
                dataKey="forecast"
                type="linear"
                stroke={COLORS.forecast}
                strokeWidth={2.5}
                fill="url(#windArea)"
                connectNulls={false}
                isAnimationActive={false}
              />
              {showPrior &&
                prior.map((r, j) => (
                  <Line
                    key={r.publishTime}
                    dataKey={`prior${j}`}
                    type="linear"
                    stroke={COLORS.prior}
                    strokeWidth={1.5}
                    strokeDasharray={PRIOR_DASH[j]}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              {reveal && (
                <Line
                  dataKey="actual"
                  type="linear"
                  stroke={COLORS.actual}
                  strokeWidth={2.5}
                  dot={false}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-foot">
          <span>
            {reveal
              ? "Hindsight comparison. The comparison rule is a provisional assumption."
              : "Earlier runs show how the outlook moved before the decision. No later run is ever used."}
          </span>
          <a href={exportHref} download>
            <Download size={14} aria-hidden /> Export{" "}
            {reveal ? "hindsight" : "decision"} CSV
          </a>
        </div>
      </section>

      {reveal && <ErrorByHour points={points} />}

      <TrackRecordPanel record={replay.track_record} onChange={onChange} />

      <section className="below-chart">
        <div className="panel vintage">
          <div className="panel-head">
            <h2>Forecast provenance</h2>
            <span className="small-tag">Inclusive ≤ cutoff</span>
          </div>
          <ul className="run-list" aria-label="Forecast runs">
            {coverage.runs.map((r) => (
              <li key={r}>
                <span className="dot" aria-hidden />
                <strong>{stamp(r)}</strong>
                <span>
                  used for {points.filter((p) => p.publishTime === r).length}{" "}
                  targets
                </span>
              </li>
            ))}
            {prior.map((r) => (
              <li key={r.publishTime} className="earlier">
                <span className="dot muted" aria-hidden />
                <span>{stamp(r.publishTime)}</span>
                <span>earlier, superseded · {r.targets} targets</span>
              </li>
            ))}
            {missing.length > 0 && (
              <li className="missing">
                <span className="dot warn" aria-hidden />
                <span>No eligible forecast</span>
                <span>{missing.join(", ")}</span>
              </li>
            )}
          </ul>
          <p className="fine-print">
            publishTime is when Elexon recorded the forecast as created. It is
            used as a proxy for availability; publication or ingestion delays
            are not modelled.
          </p>
        </div>
        <div className="panel lesson">
          <span className="eyebrow">The pilot boundary</span>
          <h2>Wind uncertainty, not a buy order.</h2>
          <p>
            These are GB transmission-metered wind figures, not all embedded
            wind. Demand, prices and portfolio exposure are outside the brief's
            data, so the app does not calculate a purchase volume, cost or
            saving.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => onChange({ view: "analysis" })}
          >
            See how wrong forecasts were across January{" "}
            <ArrowUpRight size={16} aria-hidden />
          </button>
        </div>
      </section>

      {reveal && (
        <Notice>
          Actuals are 30-minute average MW; the forecast is hourly and its
          within-hour meaning is not established. Both comparison rules are
          assumptions. Similar results under both would not prove either
          correct.
        </Notice>
      )}

      <details className="panel details">
        <summary>All 24 target values, runs and lead times</summary>
        <div className="table-wrap">
          <table className="cards">
            <thead>
              <tr>
                <th scope="col">Target UTC</th>
                <th scope="col">Forecast MW</th>
                {reveal && (
                  <>
                    <th scope="col">Actual MW</th>
                    <th scope="col">Error MW</th>
                  </>
                )}
                <th scope="col">Run used</th>
                <th scope="col">Lead time</th>
                <th scope="col">Older run?</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.time}>
                  <th scope="row" data-label="Target UTC">
                    {p.hour}
                  </th>
                  <td data-label="Forecast MW">
                    {p.forecast == null ? "Missing" : fmt(p.forecast)}
                  </td>
                  {reveal && (
                    <>
                      <td data-label="Actual MW">{fmt(p.actual, 1)}</td>
                      <td data-label="Error MW">
                        {p.error == null
                          ? "N/A"
                          : `${signed(p.error, 1)} (${errorWord(p.error)})`}
                      </td>
                    </>
                  )}
                  <td data-label="Run used">
                    {p.publishTime ? stamp(p.publishTime) : "None eligible"}
                  </td>
                  <td data-label="Lead time">
                    {p.publishTime
                      ? hours(leadHours(p.time, p.publishTime))
                      : "N/A"}
                  </td>
                  <td data-label="Older run?">
                    {p.fallback ? "Yes, older vintage" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function TrackRecordPanel({
  record,
  onChange,
}: {
  record: TrackRecord;
  onChange: Props["onChange"];
}) {
  const m = record.metrics;
  const hourly = record.hourly_bias.map((bias, h) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    bias,
  }));
  return (
    <section className="panel track" aria-labelledby="track-title">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Known at decision time</span>
          <h2 id="track-title">How this cutoff's forecasts fared recently</h2>
          <p>
            {record.days.length === record.window_days
              ? `The last ${record.window_days} delivery days`
              : `Only ${record.days.length} complete delivery day${record.days.length === 1 ? "" : "s"} (of up to ${record.window_days})`}{" "}
            whose actuals were all published by {stamp(record.available_by)},
            each scored against the forecast selected at the same cutoff on its
            own purchase day.
          </p>
        </div>
      </div>
      {record.days.length === 0 ? (
        <p className="track-empty">
          No complete delivery day had been published by this cutoff. The
          snapshot's actuals start on 2 January, so the first purchase days have
          no track record.
        </p>
      ) : (
        <div className="track-body">
          <dl className="track-values">
            <div>
              <dt>Recent MAE</dt>
              <dd>
                {fmt(m.mae)} <small>MW · n={m.n}</small>
              </dd>
            </div>
            <div>
              <dt>Recent bias</dt>
              <dd>
                {signed(m.bias)}{" "}
                <small>MW · {m.bias == null ? "" : errorWord(m.bias)}</small>
              </dd>
            </div>
          </dl>
          <figure className="mini-figure">
            <figcaption>
              Recent bias by delivery hour, MW (above zero: forecast too high)
            </figcaption>
            <div
              className="chart mini"
              role="img"
              aria-label="Recent mean bias by delivery hour."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={hourly}
                  margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#e6e7e5" />
                  <XAxis
                    dataKey="hour"
                    minTickGap={28}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    width={52}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmt(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <ReferenceLine y={0} stroke="#4a4547" />
                  <Tooltip
                    formatter={(v) => [
                      `${signed(Number(v))} MW (${errorWord(Number(v))})`,
                      "Recent bias",
                    ]}
                    labelFormatter={(l) => `${l} UTC`}
                  />
                  <Bar dataKey="bias" isAnimationActive={false}>
                    {hourly.map((h) => (
                      <Cell
                        key={h.hour}
                        fill={(h.bias ?? 0) >= 0 ? COLORS.over : COLORS.under}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </figure>
          <ul className="track-days" aria-label="Days in the track record">
            {record.days.map((d) => (
              <li key={d.delivery_date}>
                <strong>{weekdayLabel(d.delivery_date)}</strong>
                <span>
                  MAE {fmt(d.mae)} · bias {signed(d.bias)} MW
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="chart-foot">
        <span>
          Context, not a prediction or a correction. In January a poor recent
          week did not foreshadow a poor next day.{" "}
          <button
            type="button"
            className="link"
            onClick={() => onChange({ view: "analysis" })}
          >
            See the check in the Accuracy lab
          </button>
        </span>
      </p>
    </section>
  );
}

function ErrorByHour({ points }: { points: Point[] }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Where the miss happened</h2>
          <p>
            Forecast minus actual, MW, by target hour. Above zero: forecast too
            high (less wind arrived than expected).
          </p>
        </div>
        <div className="legend" aria-label="Chart legend">
          <span>
            <i className="key swatch over" aria-hidden /> Forecast too high
          </span>
          <span>
            <i className="key swatch under" aria-hidden /> Forecast too low
          </span>
        </div>
      </div>
      <div
        className="chart short"
        role="img"
        aria-label="Signed forecast error by hour. Values are listed in the table below."
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={points}
            margin={{ top: 12, right: 24, left: 4, bottom: 4 }}
          >
            <CartesianGrid vertical={false} stroke="#e6e7e5" />
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tick={{ fontSize: 12 }}
            />
            <YAxis
              width={58}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => fmt(v)}
              tick={{ fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="#4a4547" />
            <Tooltip
              formatter={(v) => [
                `${signed(Number(v))} MW (${errorWord(Number(v))})`,
                "Error",
              ]}
              labelFormatter={(l) => `${l} UTC`}
            />
            <Bar dataKey="error" isAnimationActive={false}>
              {points.map((p) => (
                <Cell
                  key={p.time}
                  fill={(p.error ?? 0) >= 0 ? COLORS.over : COLORS.under}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ProfileTip({
  active,
  payload,
  label,
  prior,
  reveal,
  showPrior,
}: {
  active?: boolean;
  payload?: { payload: Point & Record<string, number | null> }[];
  label?: string;
  prior: Replay["prior_runs"];
  reveal: boolean;
  showPrior: boolean;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="tip">
      <strong>{label} UTC</strong>
      <div>
        Forecast used:{" "}
        {p.forecast == null ? "missing" : `${fmt(p.forecast)} MW`}
      </div>
      {p.publishTime && (
        <div className="tip-muted">
          run {runLabel(p.publishTime)} ·{" "}
          {hours(leadHours(p.time, p.publishTime))} ahead
          {p.fallback ? " · older run" : ""}
        </div>
      )}
      {showPrior &&
        prior.map((r, j) => (
          <div key={r.publishTime} className="tip-muted">
            {runLabel(r.publishTime)}: {fmt(p[`prior${j}`])} MW
          </div>
        ))}
      {reveal && (
        <>
          <div>Actual: {fmt(p.actual)} MW</div>
          <div>
            Error:{" "}
            {p.error == null
              ? "N/A"
              : `${signed(p.error)} MW (${errorWord(p.error)})`}
          </div>
        </>
      )}
    </div>
  );
}

function minBy<T>(xs: T[], key: (x: T) => number): T | null {
  return xs.reduce<T | null>(
    (best, x) => (best === null || key(x) < key(best) ? x : best),
    null,
  );
}

function revisionSummary(points: Point[], previous?: (number | null)[]) {
  if (!previous) return null;
  const deltas = points.flatMap((p, i) =>
    p.forecast != null && previous[i] != null
      ? [{ hour: p.hour, delta: p.forecast - previous[i]! }]
      : [],
  );
  if (!deltas.length) return null;
  return {
    mean: deltas.reduce((s, d) => s + d.delta, 0) / deltas.length,
    max: minBy(deltas, (d) => -Math.abs(d.delta))!,
  };
}
