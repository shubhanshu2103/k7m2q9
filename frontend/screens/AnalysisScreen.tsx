import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight } from "lucide-react";
import { query, useApi, type Analysis, type Day, type Sweep } from "../api";
import type { Scenario } from "../scenario";
import {
  COLORS,
  dateLabel,
  errorWord,
  fmt,
  pct,
  ruleLabel,
  signed,
  stamp,
  weekdayLabel,
} from "../format";
import { CutoffPicker, Loadable, Notice, RulePicker, Stat } from "../ui";

type Props = {
  scenario: Scenario;
  onChange: (patch: Partial<Scenario>) => void;
};

const WORST_DAYS = 5;

export function AnalysisScreen({ scenario, onChange }: Props) {
  const { cutoff, rule } = scenario;
  const state = useApi<Analysis>("/api/analysis?" + query({ cutoff, rule }));
  const openDay = (decision: string) =>
    onChange({ view: "replay", decision, reveal: true, from: "lab" });
  return (
    <>
      <section className="controls" aria-label="Scenario controls">
        <div className="control scope">
          <span className="label">Purchase days</span>
          <strong>All 31, 1–31 Jan 2026</strong>
          <small>
            Delivery 2 Jan–1 Feb. Each day uses only forecasts created by its
            own cutoff.
          </small>
        </div>
        <CutoffPicker
          value={cutoff}
          onChange={(c) => onChange({ cutoff: c })}
        />
        <RulePicker value={rule} onChange={(r) => onChange({ rule: r })} />
      </section>
      <Notice>
        <strong>Hindsight analysis.</strong> These numbers use actuals published
        after each decision. They describe January 2026 at this cutoff; they are
        provisional comparison metrics, not a calibrated forecast of future
        error or a procurement risk model.
      </Notice>
      <Loadable state={state} label="Analysis">
        {(a) => (
          <AnalysisBody analysis={a} scenario={scenario} openDay={openDay} />
        )}
      </Loadable>
    </>
  );
}

function AnalysisBody({
  analysis: a,
  scenario,
  openDay,
}: {
  analysis: Analysis;
  scenario: Scenario;
  openDay: (decision: string) => void;
}) {
  const worst = [...a.days]
    .filter((d) => d.mae != null)
    .sort((x, y) => y.mae! - x.mae!)
    .slice(0, WORST_DAYS);
  const worstSet = new Set(worst.map((d) => d.decision_date));
  const d = a.distribution;
  return (
    <>
      <div className="stats">
        <Stat
          label="Paired targets"
          value={`${a.metrics.n}/${a.expected}`}
          unit="hourly targets"
          tone={a.metrics.n < a.expected ? "warn" : undefined}
          note={
            a.metrics.n < a.expected
              ? `${a.expected - a.metrics.n} targets had no eligible forecast or actual and are excluded`
              : "31 delivery days × 24 targets"
          }
        />
        <Stat
          label="Mean absolute error"
          value={fmt(a.metrics.mae)}
          unit="MW"
          note="Typical size of a miss, either direction"
        />
        <Stat
          label="Signed bias"
          value={signed(a.metrics.bias)}
          unit="MW · forecast minus actual"
          note={
            a.metrics.bias == null
              ? "No pairs"
              : `On average an ${errorWord(a.metrics.bias)}`
          }
        />
        <Stat
          label="Root mean squared error"
          value={fmt(a.metrics.rmse)}
          unit="MW"
          note="Weights large misses more heavily"
        />
      </div>

      <section className="panel shortfall" aria-labelledby="shortfall-title">
        <div>
          <span className="eyebrow">Reading the error for buying</span>
          <h2 id="shortfall-title">
            How far below the forecast did wind come in?
          </h2>
          <p>
            A shortfall is wind the forecast promised but that did not arrive,
            so it would have had to come from other generation. These are
            January hourly frequencies at {scenario.cutoff} UTC, not a guarantee
            for other months or weather.
          </p>
        </div>
        <dl className="shortfall-values">
          <div>
            <dt>Forecast too high</dt>
            <dd>
              {pct(d.share_over)} <small>of {d.n} hours</small>
            </dd>
          </div>
          <div>
            <dt>1 hour in 10, shortfall above</dt>
            <dd>
              {d.p90 != null && d.p90 > 0 ? fmt(d.p90) : "0"}{" "}
              <small>MW (90th percentile)</small>
            </dd>
          </div>
          <div>
            <dt>Half of hours, miss within</dt>
            <dd>
              ±{fmt(d.abs_p50)} <small>MW (median absolute error)</small>
            </dd>
          </div>
          <div>
            <dt>1 hour in 10, surplus above</dt>
            <dd>
              {d.p10 != null && d.p10 < 0 ? fmt(-d.p10) : "0"}{" "}
              <small>MW (10th percentile)</small>
            </dd>
          </div>
        </dl>
        <p className="fine-print wide">
          Why so one-sided? The snapshot cannot tell whether persistent
          over-forecasting reflects the forecast itself, wind curtailment, or a
          difference between the fleets covered by WINDFOR and FUELHH. Treat the
          bias as a finding to discuss, not a correction factor. Percentiles use
          linear interpolation over paired hours.
        </p>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Which days went wrong?</h2>
            <p>
              Mean absolute error per delivery day, MW. Select a bar or a listed
              day to replay it with hindsight.
            </p>
          </div>
          <div className="legend" aria-label="Chart legend">
            <span>
              <i className="key swatch worst" aria-hidden /> {WORST_DAYS}{" "}
              largest misses
            </span>
            <span>
              <i className="key swatch" aria-hidden /> Other days
            </span>
          </div>
        </div>
        <div
          className="chart"
          role="img"
          aria-label="Daily mean absolute error. The five largest days are listed beside the chart and in the table below."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={a.days}
              margin={{ top: 12, right: 24, left: 4, bottom: 4 }}
            >
              <CartesianGrid vertical={false} stroke="#e6e7e5" />
              <XAxis
                dataKey="delivery_date"
                tickFormatter={dateLabel}
                interval="preserveStartEnd"
                minTickGap={28}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={(v) => fmt(v)}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<DayTip />} cursor={{ fill: "#eef2ef" }} />
              <Bar
                dataKey="mae"
                radius={[3, 3, 0, 0]}
                isAnimationActive={false}
                cursor="pointer"
                onClick={(entry) =>
                  openDay((entry as unknown as Day).decision_date)
                }
              >
                {a.days.map((day) => (
                  <Cell
                    key={day.decision_date}
                    fill={
                      worstSet.has(day.decision_date) ? COLORS.over : "#7fae9f"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="inspect">
          <h3>Inspect next</h3>
          <ol>
            {worst.map((day) => (
              <li key={day.decision_date}>
                <button
                  type="button"
                  onClick={() => openDay(day.decision_date)}
                >
                  <span>
                    <strong>Delivery {weekdayLabel(day.delivery_date)}</strong>
                    <small>decided {dateLabel(day.decision_date)}</small>
                  </span>
                  <span>
                    MAE {fmt(day.mae)} MW · bias {signed(day.bias)} MW
                  </span>
                  <span className="go">
                    Replay <ArrowUpRight size={15} aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CutoffSweep scenario={scenario} current={a} />

      <section className="panel sensitivity">
        <div>
          <span className="eyebrow">Temporal sensitivity</span>
          <h2>Does the comparison rule matter?</h2>
          <p>
            Same forecasts, same cutoff. Only the way hourly forecasts are
            matched to half-hour actuals changes. Similar numbers do not prove
            either rule is correct.
          </p>
        </div>
        <div className="sensitivity-values">
          <div>
            <span>{ruleLabel(a.rule)} · selected</span>
            <strong>
              {fmt(a.metrics.mae)} <small>MW MAE</small>
            </strong>
            <p>
              Bias {signed(a.metrics.bias)} MW · n={a.metrics.n}
            </p>
          </div>
          <div>
            <span>{ruleLabel(a.sensitivity.alternate_rule)} · alternative</span>
            <strong>
              {fmt(a.sensitivity.mae)} <small>MW MAE</small>
            </strong>
            <p>
              Bias {signed(a.sensitivity.bias)} MW · n={a.sensitivity.n}
            </p>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <div>
            <h2>Bias across the delivery day</h2>
            <p>
              Mean forecast minus actual by target hour (UTC), MW. Above zero
              means the forecast was too high.
            </p>
          </div>
        </div>
        <div
          className="chart short"
          role="img"
          aria-label="Mean signed error by target hour across January."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={a.hourly}
              margin={{ top: 12, right: 24, left: 4, bottom: 4 }}
            >
              <CartesianGrid vertical={false} stroke="#e6e7e5" />
              <XAxis
                dataKey="hour"
                minTickGap={24}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                width={58}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => fmt(v)}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(v, _n, item) => [
                  `${signed(Number(v))} MW (${errorWord(Number(v))}) · n=${(item.payload as { n: number }).n}`,
                  "Mean bias",
                ]}
                labelFormatter={(l) => `${l} UTC`}
              />
              <ReferenceLine y={0} stroke="#4a4547" />
              <Bar dataKey="bias" isAnimationActive={false}>
                {a.hourly.map((h) => (
                  <Cell
                    key={h.hour}
                    fill={(h.bias ?? 0) >= 0 ? COLORS.over : COLORS.under}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <details className="panel details">
        <summary>Every purchase day: coverage, error and runs used</summary>
        <div className="table-wrap">
          <table className="cards">
            <thead>
              <tr>
                <th scope="col">Delivery</th>
                <th scope="col">Paired</th>
                <th scope="col">MAE MW</th>
                <th scope="col">Bias MW</th>
                <th scope="col">Run(s) used</th>
                <th scope="col">
                  <span className="sr-only">Replay</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {a.days.map((day) => (
                <tr key={day.decision_date}>
                  <th scope="row" data-label="Delivery">
                    {weekdayLabel(day.delivery_date)}
                    <small> · decided {dateLabel(day.decision_date)}</small>
                  </th>
                  <td data-label="Paired">{day.n}/24</td>
                  <td data-label="MAE MW">{fmt(day.mae)}</td>
                  <td data-label="Bias MW">{signed(day.bias)}</td>
                  <td data-label="Run(s) used">
                    {day.runs.map(stamp).join("; ") || "None"}
                  </td>
                  <td data-label="">
                    <button
                      type="button"
                      className="link"
                      onClick={() => openDay(day.decision_date)}
                    >
                      Replay {dateLabel(day.decision_date)}
                    </button>
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

function CutoffSweep({
  scenario,
  current,
}: {
  scenario: Scenario;
  current: Analysis;
}) {
  const state = useApi<Sweep>(
    "/api/cutoff-sweep?" + query({ rule: scenario.rule }),
  );
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Would deciding later have helped?</h2>
          <p>
            January MAE and bias if every purchase decision had been taken at
            each hourly cutoff instead. Later runs see more recent weather but
            may be too late for the market.
          </p>
        </div>
        <div className="legend" aria-label="Chart legend">
          <span>
            <i className="key forecast" aria-hidden /> MAE
          </span>
          <span>
            <i className="key bias" aria-hidden /> Signed bias
          </span>
        </div>
      </div>
      <Loadable state={state} label="Cutoff comparison">
        {(sweep) => {
          const best = sweep.cutoffs.reduce(
            (b, c) =>
              c.n === sweep.expected && (b === null || c.mae! < b.mae!) ? c : b,
            null as Sweep["cutoffs"][number] | null,
          );
          const partial = sweep.cutoffs.filter((c) => c.n < sweep.expected);
          return (
            <>
              <div
                className="chart short"
                role="img"
                aria-label="Mean absolute error and bias by decision cutoff hour."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sweep.cutoffs}
                    margin={{ top: 12, right: 24, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid vertical={false} stroke="#e6e7e5" />
                    <XAxis
                      dataKey="cutoff"
                      minTickGap={24}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      width={58}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => fmt(v)}
                      tick={{ fontSize: 12 }}
                      domain={[0, "auto"]}
                    />
                    <Tooltip
                      formatter={(v, name) => [
                        `${name === "bias" ? signed(Number(v)) : fmt(Number(v))} MW`,
                        name === "bias" ? "Bias" : "MAE",
                      ]}
                      labelFormatter={(l, items) => {
                        const n = (items?.[0]?.payload as { n?: number })?.n;
                        return `Cutoff ${l} UTC · ${n}/${sweep.expected} paired`;
                      }}
                    />
                    <ReferenceLine
                      x={scenario.cutoff.slice(0, 2) + ":00"}
                      stroke="#4a4547"
                      strokeDasharray="3 3"
                      label={{
                        value: "your cutoff hour",
                        position: "insideBottomLeft",
                        fontSize: 12,
                        fill: "#4a4547",
                      }}
                    />
                    <Line
                      dataKey="mae"
                      stroke={COLORS.forecast}
                      strokeWidth={2.5}
                      dot={{ r: 2.5 }}
                      type="stepAfter"
                      isAnimationActive={false}
                    />
                    <Line
                      dataKey="bias"
                      stroke={COLORS.over}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      type="stepAfter"
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="chart-foot">
                <span>
                  Your cutoff {scenario.cutoff}: MAE {fmt(current.metrics.mae)}{" "}
                  MW.
                  {best &&
                    ` Lowest full-coverage MAE is ${fmt(best.mae)} MW at ${best.cutoff}.`}
                  {partial.length > 0 &&
                    ` Cutoffs ${partial[0].cutoff}–${partial[partial.length - 1].cutoff} lack forecasts for some late-evening targets (${partial[0].n}/${sweep.expected} paired), so their error is not like-for-like.`}
                </span>
              </p>
            </>
          );
        }}
      </Loadable>
    </section>
  );
}

function DayTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Day }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="tip">
      <strong>Delivery {weekdayLabel(d.delivery_date)}</strong>
      <div className="tip-muted">decided {dateLabel(d.decision_date)}</div>
      <div>MAE {fmt(d.mae)} MW</div>
      <div>Bias {signed(d.bias)} MW</div>
      <div className="tip-muted">{d.n}/24 paired · click to replay</div>
    </div>
  );
}
