import React from "react";
import { ArrowUpRight } from "lucide-react";
import { useApi, type Meta } from "../api";
import { dateLabel, fmt, stamp } from "../format";
import { Loadable, Stat } from "../ui";

export function MethodScreen() {
  // Metadata is immutable for the life of the server, so this is fetched once per session.
  const state = useApi<Meta>("/api/meta");
  return (
    <Loadable state={state} label="Snapshot metadata">
      {(meta) => <Method meta={meta} />}
    </Loadable>
  );
}

function Method({ meta }: { meta: Meta }) {
  return (
    <>
      <div className="stats">
        <Stat label="Forecast records" value={fmt(meta.forecast_rows)} unit="rows" note="Published 29 Dec 2025–31 Jan 2026" />
        <Stat label="Forecast runs" value={fmt(meta.forecast_runs)} unit="publish times" note="34 publication days · 73 targets per run, including past hours" />
        <Stat label="Actuals" value={fmt(meta.actual_intervals)} unit="half-hours" note="2 Jan–1 Feb 2026 · 48 per day" />
        <Stat
          label="Snapshot acquired"
          value={dateLabel(meta.manifest.retrieved_at)}
          unit={meta.manifest.retrieved_at.slice(0, 4)}
          note="Hashed raw responses; no Elexon calls during use"
        />
      </div>
      <section className="panel method">
        <h2>Selection you can audit</h2>
        <ol>
          <li>
            <strong>Interpret the scope.</strong> A January purchase day means delivery on the next
            UK calendar day, 2 January–1 February. January is GMT, so UK midnight equals UTC
            midnight and every delivery day has 24 hourly targets. Other dates are rejected rather
            than silently handled with the wrong day length.
          </li>
          <li>
            <strong>Choose the decision time.</strong> 09:30 UTC is an editable scenario default,
            not a verified market gate closure or a confirmed team preference.
          </li>
          <li>
            <strong>Filter, then select per target.</strong> For each delivery hour, take the
            forecast with the latest publishTime at or before the cutoff. Never use a later
            version, interpolate between versions, or fill a gap with future data. If the newest
            eligible run misses a target, an older eligible version is used and flagged.
          </li>
          <li>
            <strong>Show what was moving.</strong> Up to three earlier eligible runs for the same
            delivery day are drawn beside the chosen one. They come from the same ≤ cutoff filter,
            so they add no hindsight.
          </li>
          <li>
            <strong>Reveal separately.</strong> Decision responses and exports omit actuals and
            accuracy. Changing the day or cutoff returns to the decision view. Hindsight responses
            use the latest actual publication in this snapshot, not actuals available at the cutoff.
          </li>
          <li>
            <strong>Summarise honestly.</strong> MAE, bias and RMSE use paired hours only and always
            report n. Percentiles of signed error describe January at one cutoff; they are not a
            calibrated interval. MAPE is omitted because it is unstable at low wind.
          </li>
        </ol>
      </section>
      <div className="below-chart">
        <section className="panel method">
          <h2>The comparison is provisional</h2>
          <p>
            FUELHH is a half-hour average in MW. Elexon describes WINDFOR as an hourly forecast,
            but the sources inspected do not establish whether each value is a point, a settlement
            period or an hour average.
          </p>
          <p>
            The pilot exposes both assumptions: the first half-hour at H, or the mean of the two
            half-hours in [H, H+1h). The latter is the default, not a confirmed interpretation. No
            daily MWh is inferred.
          </p>
          <p>
            Elexon's wind page compares this forecast with Generation by Fuel Type outturn. That
            supports the pairing but is not a unit-level fleet reconciliation.
          </p>
        </section>
        <section className="panel method">
          <h2>What this snapshot does and does not prove</h2>
          <p>
            No duplicate forecast (publishTime, startTime) pairs or actual startTimes exist in the
            acquired responses. Latest publishTime wins for revised actuals; conflicting duplicates
            fail ingestion.
          </p>
          <p>
            From 02:30 onwards every cutoff covers all 24 targets on all 31 days. Before 02:30 the
            newest run (22:30 the previous evening) stops short, so 22:00 and 23:00 delivery are
            genuinely missing and shown blank. Mixed-vintage fallback never occurs in this snapshot
            and is covered by synthetic tests.
          </p>
          <p>
            On 15 January the usual 11:30 run has publishTime 12:25. An 11:30 decision uses the
            09:30 run; a 12:25 decision includes the late run. Fixed schedules are never assumed.
          </p>
        </section>
      </div>
      <section className="panel method">
        <h2>Sources and provenance</h2>
        <p>
          Acquired {stamp(meta.manifest.retrieved_at)}. SHA-256 hashes identify the exact bundled
          responses.
        </p>
        <div className="source-list">
          {Object.entries(meta.manifest.sources).map(([key, s]) => (
            <div key={key}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {key === "wind" ? "WINDFOR stream · bounded publish range" : "FUELHH stream · WIND settlement range"}{" "}
                <ArrowUpRight size={15} aria-hidden />
              </a>
              <span>{fmt(s.rows)} records</span>
              <code>{s.sha256}</code>
            </div>
          ))}
        </div>
        <div className="doc-links">
          <a href="https://bmrs.elexon.co.uk/wind-generation" target="_blank" rel="noreferrer">
            Elexon wind methodology ↗
          </a>
          <a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream" target="_blank" rel="noreferrer">
            FUELHH API documentation ↗
          </a>
          <a href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream" target="_blank" rel="noreferrer">
            WINDFOR API documentation ↗
          </a>
          <a href="/docs" target="_blank" rel="noreferrer">
            This app's API reference ↗
          </a>
        </div>
      </section>
      <details className="panel details">
        <summary>Per-day snapshot row and run counts</summary>
        <div className="table-wrap split">
          <table>
            <thead>
              <tr>
                <th scope="col">Publication day UTC</th>
                <th scope="col">Forecast rows</th>
                <th scope="col">Runs</th>
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
                <th scope="col">Delivery day UTC</th>
                <th scope="col">Actual half-hours</th>
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
