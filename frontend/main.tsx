import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Area,
  Line,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  ReferenceLine,
} from "recharts";
import {
  Wind,
  ArrowUpRight,
  Download,
  ChevronRight,
  Eye,
  LockKeyhole,
  RefreshCw,
  Info,
} from "lucide-react";
import "./style.css";

type Point = {
  time: string;
  hour: string;
  forecast: number | null;
  publishTime: string | null;
  fallback: boolean;
  age_hours: number | null;
  actual?: number | null;
  error?: number | null;
};
type Metrics = {
  n: number;
  mae: number | null;
  bias: number | null;
  rmse: number | null;
  max_abs_error: number | null;
};
type Replay = {
  decision_date: string;
  delivery_date: string;
  cutoff: string;
  rule: string;
  points: Point[];
  coverage: {
    forecast: number;
    expected: number;
    runs: string[];
    fallback_intervals: number;
    actual?: number;
  };
  metrics?: Metrics;
};
type Day = Metrics & {
  decision_date: string;
  delivery_date: string;
  forecast: number;
  runs: string[];
  fallback_intervals: number;
};
type Analysis = {
  metrics: Metrics;
  expected: number;
  rule: string;
  sensitivity: Metrics & { alternate_rule: string };
  days: Day[];
  hourly: (Metrics & { hour: string })[];
};
type Meta = {
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
const fmt = (v: number | null | undefined, d = 0) =>
  v == null
    ? "N/A"
    : v.toLocaleString("en-GB", {
        maximumFractionDigits: d,
        minimumFractionDigits: d,
      });
const dateLabel = (s: string) =>
  new Date(s + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const ruleLabel = (s: string) =>
  s === "hour_mean" ? "Hourly mean" : "First half-hour";
const stamp = (s: string) => s.slice(0, 10) + " " + s.slice(11, 16) + " UTC";
function App() {
  const [tab, setTab] = useState("replay"),
    [decision, setDecision] = useState("2026-01-15"),
    [cutoff, setCutoff] = useState("09:30"),
    [rule, setRule] = useState("hour_mean"),
    [reveal, setReveal] = useState(false);
  const [replay, setReplay] = useState<Replay | null>(null),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [meta, setMeta] = useState<Meta | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setReplay(null);
    setAnalysis(null);
    const query = new URLSearchParams({
      decision,
      cutoff,
      rule,
      reveal: String(reveal),
    });
    async function load() {
      try {
        const paths =
          tab === "analysis"
            ? ["/api/analysis?" + query, "/api/meta"]
            : ["/api/replay?" + query, "/api/meta"];
        const values = await Promise.all(
          paths.map(async (p) => {
            const r = await fetch(p, { signal: controller.signal });
            if (!r.ok) {
              const body = await r.json();
              throw Error(
                typeof body.detail === "string"
                  ? body.detail
                  : "Please check the selected date and cutoff.",
              );
            }
            return r.json();
          }),
        );
        if (tab === "analysis") setAnalysis(values[0]);
        else setReplay(values[0]);
        setMeta(values[1]);
        setLoading(false);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : "Unable to load snapshot");
          setLoading(false);
        }
      }
    }
    load();
    return () => controller.abort();
  }, [decision, cutoff, rule, reveal, tab, retry]);
  function moveDay(delta: number) {
    const d = new Date(decision + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    setDecision(d.toISOString().slice(0, 10));
  }
  const metric = tab === "analysis" ? analysis?.metrics : replay?.metrics;
  const forecasts =
    replay?.points.flatMap((p) => (p.forecast === null ? [] : [p.forecast])) ??
    [];
  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#">
          <span className="brand-icon">
            <Wind size={23} />
          </span>
          Wind replay<span className="pilot">PILOT</span>
        </a>
        <p className="side-label">JANUARY 2026 SNAPSHOT</p>
        <nav aria-label="Main navigation">
          {[
            ["replay", "Decision replay", "01"],
            ["analysis", "Accuracy lab", "02"],
            ["sources", "Data & method", "03"],
          ].map(([key, label, num]) => (
            <button
              key={key}
              className={tab === key ? "nav active" : "nav"}
              onClick={() => setTab(key)}
            >
              <span>{num}</span>
              {label}
              <ChevronRight size={14} />
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="live-dot" /> Bounded, not live
          <p>
            GB transmission wind
            <br />
            Elexon · WINDFOR + FUELHH
          </p>
          <span className="side-note">
            A decision-support pilot.
            <br />
            Not a procurement recommendation.
          </span>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Wind intelligence <ChevronRight size={14} />{" "}
            {tab === "analysis"
              ? "Accuracy lab"
              : tab === "sources"
                ? "Data & method"
                : "Decision replay"}
          </div>
          <div className="snapshot-tag">
            JAN 2026 <span>•</span> UTC / GMT
          </div>
        </header>
        <section className="page-head">
          <div>
            <p className="eyebrow">
              {tab === "analysis"
                ? "MEASURE THE UNCERTAINTY"
                : tab === "sources"
                  ? "TRACE EVERY NUMBER"
                  : "KNOW WHAT WAS KNOWN"}
            </p>
            <h1>
              {tab === "analysis"
                ? "How much did the forecast miss?"
                : tab === "sources"
                  ? "Small snapshot. Visible assumptions."
                  : "Tomorrow, as seen yesterday."}
            </h1>
            <p className="subtitle">
              {tab === "analysis"
                ? "31 purchase days. One consistent cutoff. No future forecast versions."
                : tab === "sources"
                  ? "An auditable pilot, with its limits kept in view."
                  : "Replay a January purchase decision before revealing what actually happened."}
            </p>
          </div>
          <span className="scope-badge">
            GB wind
            <br />
            <strong>National aggregate*</strong>
          </span>
        </section>
        {tab !== "sources" && (
          <section className="controls" aria-label="Scenario controls">
            <div className="control">
              <label htmlFor="decision">PURCHASE DECISION DAY</label>
              <div className="date-control">
                <button
                  aria-label="Previous day"
                  disabled={tab === "analysis" || decision === "2026-01-01"}
                  onClick={() => moveDay(-1)}
                >
                  ‹
                </button>
                <input
                  id="decision"
                  type="date"
                  min="2026-01-01"
                  max="2026-01-31"
                  value={decision}
                  onChange={(e) => {
                    if (e.target.value) setDecision(e.target.value);
                  }}
                  disabled={tab === "analysis"}
                />
                <button
                  aria-label="Next day"
                  disabled={tab === "analysis" || decision === "2026-01-31"}
                  onClick={() => moveDay(1)}
                >
                  ›
                </button>
              </div>
            </div>
            <div className="control">
              <label htmlFor="cutoff">
                DECISION CUTOFF <span>ASSUMPTION</span>
              </label>
              <input
                id="cutoff"
                type="time"
                value={cutoff}
                onChange={(e) => {
                  if (e.target.value) setCutoff(e.target.value);
                }}
              />
              <small>On the purchase day, UTC</small>
            </div>
            <div className="control comparison">
              <label htmlFor="rule">
                ACTUALS COMPARISON <span>ASSUMPTION</span>
              </label>
              <select
                id="rule"
                value={rule}
                onChange={(e) => setRule(e.target.value)}
              >
                <option value="hour_mean">Mean of both half-hours</option>
                <option value="first_half">First half-hour only</option>
              </select>
              <small>Temporal meaning remains provisional</small>
            </div>
            {tab === "replay" && (
              <div className="reveal-box">
                <button
                  className={reveal ? "reveal selected" : "reveal"}
                  onClick={() => setReveal(!reveal)}
                >
                  {reveal ? <Eye size={17} /> : <LockKeyhole size={17} />}{" "}
                  {reveal ? "Actuals revealed" : "Reveal actuals"}
                </button>
                <small>
                  {reveal
                    ? "Retrospective view"
                    : "Decision view · no hindsight"}
                </small>
              </div>
            )}
          </section>
        )}
        {error && (
          <section role="alert" className="error">
            <h2>Snapshot could not load</h2>
            <p>{error}</p>
            <button onClick={() => setRetry(retry + 1)}>
              <RefreshCw size={15} /> Try again
            </button>
          </section>
        )}
        {loading && !error && (
          <div className="loading" role="status">
            <RefreshCw className="spin" size={20} /> Loading snapshot…
          </div>
        )}
        {!loading && !error && tab === "replay" && replay && (
          <>
            <section className="context-line">
              <span>
                <span className="teal-dot" /> Delivery{" "}
                {dateLabel(replay.delivery_date)} 2026
              </span>
              <span>Forecasts created ≤ {stamp(replay.cutoff)}</span>
            </section>
            <div className="stats">
              <Stat
                label="FORECAST COVERAGE"
                value={`${replay.coverage.forecast}/24`}
                unit="hourly targets"
                note={
                  replay.coverage.forecast === 24
                    ? "Every target has an eligible forecast"
                    : "Missing targets are left blank"
                }
              />
              {reveal ? (
                <>
                  <Stat
                    label="MEAN ABSOLUTE ERROR"
                    value={fmt(metric?.mae)}
                    unit="MW"
                    note="Average size of the miss"
                  />
                  <Stat
                    label="SIGNED BIAS"
                    value={
                      (metric?.bias && metric.bias > 0 ? "+" : "") +
                      fmt(metric?.bias)
                    }
                    unit="MW"
                    note="Forecast minus actual"
                  />
                  <Stat
                    label="ROOT MEAN SQUARED ERROR"
                    value={fmt(metric?.rmse)}
                    unit="MW"
                    note={`${metric?.n ?? 0} paired targets · provisional`}
                  />
                </>
              ) : (
                <>
                  <Stat
                    label="PUBLISH TIMES USED"
                    value={String(replay.coverage.runs.length)}
                    unit={
                      replay.coverage.runs.length === 1
                        ? "forecast vintage"
                        : "forecast vintages"
                    }
                    note={`${replay.coverage.fallback_intervals} older-vintage target(s)`}
                  />
                  <Stat
                    label="FORECAST RANGE"
                    value={
                      forecasts.length
                        ? `${fmt(Math.min(...forecasts))}–${fmt(Math.max(...forecasts))}`
                        : "N/A"
                    }
                    unit="MW"
                    note="Minimum to maximum target value"
                  />
                  <Stat
                    label="HINDSIGHT"
                    value="Hidden"
                    unit="by design"
                    note="Actuals are excluded from this API response"
                  />
                </>
              )}
            </div>
            <section className="panel chart-panel">
              <div className="panel-head">
                <div>
                  <h2>Delivery-day wind profile</h2>
                  <p>
                    {dateLabel(replay.delivery_date)} 2026 · target start time
                    (UTC) · MW
                  </p>
                </div>
                <div className="legend">
                  <span>
                    <i className="key forecast" />
                    As-of forecast
                  </span>
                  {reveal && (
                    <span>
                      <i className="key actual" />
                      {ruleLabel(rule)} actual
                    </span>
                  )}
                </div>
              </div>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={replay.points}
                    margin={{ top: 18, right: 14, left: 4, bottom: 8 }}
                  >
                    <defs>
                      <linearGradient id="windArea" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#73a89a"
                          stopOpacity={0.23}
                        />
                        <stop
                          offset="100%"
                          stopColor="#73a89a"
                          stopOpacity={0.01}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#eae9ea" />
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      minTickGap={32}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={56}
                      tickFormatter={(v) => fmt(v)}
                      tick={{ fontSize: 12 }}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      formatter={(v: any, n: any) => [
                        fmt(Number(v)) + " MW",
                        n === "forecast"
                          ? "As-of forecast"
                          : ruleLabel(rule) + " actual",
                      ]}
                      contentStyle={{
                        border: "1px solid #eae9ea",
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    />
                    <Area
                      dataKey="forecast"
                      type="linear"
                      stroke="#437f70"
                      strokeWidth={2.5}
                      fill="url(#windArea)"
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    {reveal && (
                      <Line
                        dataKey="actual"
                        type="linear"
                        stroke="#d17d41"
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
                    ? "Provisional comparison · " + ruleLabel(rule)
                    : "Decision view shows only the forecast available at your assumed cutoff."}
                </span>
                <a
                  href={
                    "/api/export?" +
                    new URLSearchParams({
                      decision,
                      cutoff,
                      rule,
                      reveal: String(reveal),
                    })
                  }
                >
                  <Download size={14} /> Export this view
                </a>
              </div>
            </section>
            <section className="below-chart">
              <div className="panel vintage">
                <div className="panel-head">
                  <h2>Forecast provenance</h2>
                  <span className="small-tag">INCLUSIVE ≤ CUTOFF</span>
                </div>
                <p className="secondary">
                  publishTime(s) used for this delivery day
                </p>
                <div className="run-list">
                  {replay.coverage.runs.map((r) => (
                    <div key={r}>
                      <span className="teal-dot" />
                      <strong>{stamp(r)}</strong>
                      <span>
                        {
                          replay.points.filter((p) => p.publishTime === r)
                            .length
                        }{" "}
                        targets
                      </span>
                    </div>
                  ))}
                </div>
                <p className="fine-print">
                  Creation time is a proxy for availability. Publication or
                  ingestion delays are not modelled.
                </p>
              </div>
              <div className="panel lesson">
                <span className="eyebrow">THE PILOT BOUNDARY</span>
                <h2>Wind uncertainty, not a buy order.</h2>
                <p>
                  These are GB transmission-wind estimates, not all embedded
                  wind. Demand, prices and portfolio exposure are outside scope,
                  so this app does not calculate procurement volumes or savings.
                </p>
                <button
                  className="text-button"
                  onClick={() => setTab("sources")}
                >
                  Inspect data and assumptions <ArrowUpRight size={16} />
                </button>
              </div>
            </section>
            {reveal && (
              <div className="notice">
                <Info size={17} />
                <p>
                  Actuals are 30-minute average MW. The forecast is hourly, but
                  its within-hour meaning is not established. Both join rules
                  are assumptions. Compare their metrics in{" "}
                  <button onClick={() => setTab("analysis")}>
                    Accuracy lab
                  </button>
                  ; similar results would not prove either rule correct.
                </p>
              </div>
            )}
            <details className="panel details">
              <summary>
                Inspect all 24 target values and publication times
              </summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Target UTC</th>
                      <th>Forecast MW</th>
                      {reveal && (
                        <>
                          <th>Actual MW</th>
                          <th>Error MW</th>
                        </>
                      )}
                      <th>Forecast publishTime UTC</th>
                      <th>Fallback</th>
                    </tr>
                  </thead>
                  <tbody>
                    {replay.points.map((p) => (
                      <tr key={p.time}>
                        <td>{p.hour}</td>
                        <td>{fmt(p.forecast)}</td>
                        {reveal && (
                          <>
                            <td>{fmt(p.actual, 1)}</td>
                            <td>{fmt(p.error, 1)}</td>
                          </>
                        )}
                        <td>
                          {p.publishTime ? stamp(p.publishTime) : "Missing"}
                        </td>
                        <td>{p.fallback ? "Older vintage" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
        {!loading && !error && tab === "analysis" && analysis && (
          <>
            <div className="notice">
              <Info size={17} />
              <p>
                Retrospective evaluation of decisions on 1–31 January, for
                delivery on 2 January–1 February. Each forecast is selected as
                of the same assumed cutoff on its purchase day. These are{" "}
                <strong>provisional comparison metrics</strong>, not calibrated
                procurement risk.
              </p>
            </div>
            <div className="stats">
              <Stat
                label="PAIRED TARGETS"
                value={`${analysis.metrics.n}/744`}
                unit="hourly targets"
                note="31 delivery days × 24 targets"
              />
              <Stat
                label="MEAN ABSOLUTE ERROR"
                value={fmt(analysis.metrics.mae)}
                unit="MW"
                note={ruleLabel(rule) + " comparison"}
              />
              <Stat
                label="SIGNED BIAS"
                value={
                  (analysis.metrics.bias && analysis.metrics.bias > 0
                    ? "+"
                    : "") + fmt(analysis.metrics.bias)
                }
                unit="MW"
                note="Positive means over-forecast"
              />
              <Stat
                label="ROOT MEAN SQUARED ERROR"
                value={fmt(analysis.metrics.rmse)}
                unit="MW"
                note="Larger errors receive more weight"
              />
            </div>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Error varies by delivery day</h2>
                  <p>Mean absolute error, MW · each bar is one delivery day</p>
                </div>
              </div>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.days}>
                    <CartesianGrid vertical={false} stroke="#eae9ea" />
                    <XAxis
                      dataKey="delivery_date"
                      tickFormatter={dateLabel}
                      interval={4}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={55}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      labelFormatter={(v) => "Delivery " + dateLabel(String(v))}
                      formatter={(v: any) => [fmt(Number(v)) + " MW", "MAE"]}
                    />
                    <Bar
                      dataKey="mae"
                      fill="#73a89a"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="panel sensitivity">
              <div>
                <span className="eyebrow">TEMPORAL SENSITIVITY</span>
                <h2>Does the comparison rule matter?</h2>
                <p>
                  Same forecast, same cutoff. Only the actuals mapping changes.
                  Neither choice is established by similar numbers.
                </p>
              </div>
              <div className="sensitivity-values">
                <div>
                  <span>{ruleLabel(rule)} · selected</span>
                  <strong>
                    {fmt(analysis.metrics.mae)} <small>MW MAE</small>
                  </strong>
                  <p>Bias {fmt(analysis.metrics.bias)} MW</p>
                </div>
                <div>
                  <span>
                    {ruleLabel(analysis.sensitivity.alternate_rule)} ·
                    alternative
                  </span>
                  <strong>
                    {fmt(analysis.sensitivity.mae)} <small>MW MAE</small>
                  </strong>
                  <p>Bias {fmt(analysis.sensitivity.bias)} MW</p>
                </div>
              </div>
            </section>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Bias across the delivery day</h2>
                  <p>
                    Mean forecast minus actual, MW · grouped by target hour
                    (UTC)
                  </p>
                </div>
              </div>
              <div className="chart short">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analysis.hourly}>
                    <CartesianGrid vertical={false} stroke="#eae9ea" />
                    <XAxis
                      dataKey="hour"
                      interval={3}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      width={55}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(v: any) => [fmt(Number(v)) + " MW", "Bias"]}
                    />
                    <ReferenceLine y={0} stroke="#585254" />
                    <Bar
                      dataKey="bias"
                      fill="#73a89a"
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <details className="panel details">
              <summary>
                Daily coverage, error and forecast publishTime(s)
              </summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Decision</th>
                      <th>Delivery</th>
                      <th>Paired</th>
                      <th>MAE MW</th>
                      <th>Bias MW</th>
                      <th>Publish time(s) UTC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.days.map((d) => (
                      <tr key={d.decision_date}>
                        <td>{dateLabel(d.decision_date)}</td>
                        <td>{dateLabel(d.delivery_date)}</td>
                        <td>{d.n}/24</td>
                        <td>{fmt(d.mae)}</td>
                        <td>{fmt(d.bias)}</td>
                        <td>{d.runs.map(stamp).join("; ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
        {!loading && !error && tab === "sources" && meta && (
          <Method meta={meta} />
        )}
        <footer>
          <span>Wind replay · January 2026 pilot</span>
          <span>
            *GB transmission / operationally metered wind. Not total UK wind.
          </span>
        </footer>
      </main>
    </div>
  );
}
function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
}) {
  return (
    <article className="stat">
      <h3>{label}</h3>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <p>{note}</p>
    </article>
  );
}
function Method({ meta }: { meta: Meta }) {
  return (
    <>
      <div className="stats">
        <Stat
          label="FORECAST RECORDS"
          value={fmt(meta.forecast_rows)}
          unit="rows"
          note="29 Dec 2025–31 Jan 2026 publication windows"
        />
        <Stat
          label="FORECAST VINTAGES"
          value={fmt(meta.forecast_runs)}
          unit="runs"
          note="34 publication days · 73 targets per run"
        />
        <Stat
          label="ACTUALS"
          value={fmt(meta.actual_intervals)}
          unit="half-hours"
          note="2 Jan–1 Feb 2026 · 48 per day"
        />
        <Stat
          label="SNAPSHOT ACQUIRED"
          value={dateLabel(meta.manifest.retrieved_at.slice(0, 10))}
          unit="2026"
          note="Reproducible, hashed source responses"
        />
      </div>
      <section className="panel method">
        <h2>Selection you can audit</h2>
        <ol>
          <li>
            <strong>Interpret the scope.</strong> January purchase days mean
            delivery on the next UK calendar day, 2 January–1 February. January
            is GMT, so UK midnight equals UTC midnight.
          </li>
          <li>
            <strong>Choose the decision time.</strong> 09:30 UTC is an editable
            scenario default, not a verified market gate closure.
          </li>
          <li>
            <strong>Filter before selecting.</strong> For each delivery target,
            choose the maximum forecast publishTime ≤ cutoff. Never choose a
            later version, interpolate across versions, or fill a gap using
            future data.
          </li>
          <li>
            <strong>Keep every vintage.</strong> Store publishTime per target
            and summarise per day. If the newest eligible run misses a target,
            an older eligible version can be used and is flagged. Missing
            targets remain missing.
          </li>
          <li>
            <strong>Reveal separately.</strong> Decision API responses omit
            actuals and accuracy. Retrospective responses use the latest actual
            publication in this fixed snapshot, not actuals claimed available at
            the cutoff.
          </li>
        </ol>
      </section>
      <div className="below-chart">
        <section className="panel method">
          <h2>The comparison is provisional</h2>
          <p>
            FUELHH is explicitly a half-hour average in MW. Elexon describes
            WINDFOR as an hourly forecast, but the sources inspected do not
            establish whether each value represents a point, a settlement period
            or an hour average.
          </p>
          <p>
            The pilot exposes both assumptions: first half-hour at H, or the
            arithmetic mean of the two half-hours in [H, H+1h). The latter is
            the UI default, not a confirmed interpretation. No daily MWh is
            inferred.
          </p>
          <p>
            Elexon's own wind page compares the forecast with Generation by Fuel
            Type outturn. This supports the intended comparison, but is not a
            unit-level fleet reconciliation.
          </p>
        </section>
        <section className="panel method">
          <h2>What this snapshot does and does not prove</h2>
          <p>
            There are no duplicate forecast (publishTime, startTime) pairs or
            actual startTimes in the acquired response. Latest publishTime wins
            for revised actuals; conflicting same-time duplicates fail
            ingestion.
          </p>
          <p>
            Tested cutoffs 07:30, 09:20, 09:30, 11:30, 15:30, 22:30 and 23:59
            cover all 24 targets on all 31 delivery days. Fallback is therefore
            covered by synthetic tests, not observed real examples.
          </p>
          <p>
            On 15 January the usual 11:30 run has publishTime 12:25. An 11:30
            decision uses the earlier 09:30 vintage. Fixed schedules are never
            used for selection.
          </p>
        </section>
      </div>
      <section className="panel method">
        <h2>Sources and provenance</h2>
        <p>
          Acquired {stamp(meta.manifest.retrieved_at)}. SHA-256 hashes identify
          the exact bundled responses. The app reads locally, with no Elexon
          calls during interaction.
        </p>
        <div className="source-list">
          {Object.entries(meta.manifest.sources).map(([key, s]) => (
            <div key={key}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {key === "wind"
                  ? "WINDFOR stream · bounded publish range"
                  : "FUELHH stream · WIND settlement range"}{" "}
                <ArrowUpRight size={15} />
              </a>
              <span>{fmt(s.rows)} records</span>
              <code>{s.sha256}</code>
            </div>
          ))}
        </div>
        <div className="doc-links">
          <a
            href="https://bmrs.elexon.co.uk/wind-generation"
            target="_blank"
            rel="noreferrer"
          >
            Elexon wind methodology ↗
          </a>
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
            target="_blank"
            rel="noreferrer"
          >
            FUELHH API documentation ↗
          </a>
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
            target="_blank"
            rel="noreferrer"
          >
            WINDFOR API documentation ↗
          </a>
        </div>
      </section>
      <details className="panel details">
        <summary>Per-day snapshot row and run counts</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Publication day UTC</th>
                <th>Forecast rows</th>
                <th>Distinct runs</th>
              </tr>
            </thead>
            <tbody>
              {meta.publish_days.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.rows}</td>
                  <td>{d.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table>
            <thead>
              <tr>
                <th>Delivery day UTC</th>
                <th>Actual half-hours</th>
              </tr>
            </thead>
            <tbody>
              {meta.actual_days.map((d) => (
                <tr key={d.date}>
                  <td>{d.date}</td>
                  <td>{d.rows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
