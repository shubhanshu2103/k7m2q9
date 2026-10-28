# Wind replay

**Live app: https://k7m2q9-six.vercel.app**

A January 2026 wind-forecast workbench for a UK day-ahead purchasing team. It answers two questions from the brief using only Elexon national wind data: *what wind forecast could the team actually see when it decided?* and *how wrong were those forecasts, quantitatively?* React + TypeScript, Python + FastAPI, Docker, and an immutable Elexon snapshot.

**Status (28 October 2026):**

- **Repository.** Public at https://github.com/shubhanshu2103/k7m2q9.
- **First version.** GitHub Actions passed for commit `5276489`: [run 40538346465](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40538346465). That run covered pytest, the production build, Playwright, and a Docker image build with a container health/replay smoke.
- **Second pass.** Pushed to branch `second-pass-decision-workbench`; GitHub Actions passed every step for commit `8f3746b`, including the Docker build and container smoke: [run 40546173350](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40546173350). `main` still points at the first version.
- **Third pass.** The decision-time track record and its backtest. Pushed; GitHub Actions passed every step for commit `58c2327`: [run 40549449242](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40549449242).
- **Fourth pass.** Error by forecast level, a key findings summary, and enforced lint, formatting and locked Python dependencies. Merged into `main` through [shubhanshu2103/k7m2q9#3](https://github.com/shubhanshu2103/k7m2q9/pull/3); CI passed on `main` ([run 40551629743](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40551629743)).
- **Fifth pass.** The cutoff timeline with playback, and the month heatmap. Merged into `main` through [shubhanshu2103/k7m2q9#4](https://github.com/shubhanshu2103/k7m2q9/pull/4), with CI passing on `main`.
- **Deployment.** Deployed on Vercel at https://k7m2q9-six.vercel.app. `pyproject.toml` sets `[tool.vercel] entrypoint = "backend.app:app"` and a `[project]` section that declares the runtime dependencies (FastAPI, Uvicorn) and Python ≥ 3.12 for Vercel. Keep those versions in step with `requirements.txt`. Check it with `python scripts/check_deploy.py https://k7m2q9-six.vercel.app` (see [Deployment](#deployment-and-submission)).
- **Still pending.** The demo video and the form submission.

## Product

The app has three screens, and every scenario is kept in the URL so a view can be shared, reloaded or stepped back to.

- **Decision replay: what was known.** Pick a January purchase day and an assumed cutoff on that day.
  - **Forecast used.** The 24 hourly forecasts for the next UK day, chosen per target from runs published at or before the cutoff.
  - **Provenance.** The run used, its age and lead times, and which targets have no eligible forecast. Missing targets are left blank.
  - **Earlier runs and revision.** Up to three earlier eligible runs are drawn beside the chosen one, with the mean and largest change since the previous run. A buyer can see whether the outlook was moving, with no hindsight.
  - **Watch the forecast arrive.** A timeline of the purchase day with a stop at every forecast run published that day. Step through it, or press *Play the day* to watch the chart reshape as each run lands. The selection can only change at a publication, so these are the cutoffs that matter. It shows publication *times* of later runs, never their values. Motion is skipped when the system asks for reduced motion.
  - **Track record known at decision time.** How forecasts at the same cutoff fared over the last seven complete delivery days: MAE, bias, bias by hour and each day. It counts only actuals whose own `publishTime` is at or before the cutoff, so it was genuinely knowable when deciding. It is labelled as context, not a prediction or a correction.
  - **Export.** The decision export contains no actuals.
- **Hindsight is a separate, labelled mode.** "Reveal actuals" switches to an amber *Hindsight view* with MAE, signed bias, the largest miss and a per-hour error chart.
  - Changing the day or the cutoff starts a new decision and returns to the forecast-only view, so hindsight cannot silently carry over.
  - The actual-comparison assumption is shown only where it has an effect.
- **Accuracy lab: how wrong, where, and what to inspect next.** All 31 purchase days at one consistent cutoff.
  - **Headline metrics.** MAE, bias and RMSE, with paired n.
  - **What the pilot found.** Four statements computed from the selected scenario, each linking to the panel that evidences it.
  - **Error by forecast level.** MAE, bias, share over-forecast and a 90th-percentile shortfall for hours forecast under 5, 5–10, 10–15 and 15+ GW. The band is known at decision time; the errors are January hindsight.
  - **Shortfall summary.** How often, and by how much, wind came in below the as-of forecast (percentiles of signed error).
  - **The month at a glance.** A heatmap of every delivery hour (31 days × 24 hours) coloured by over- or under-forecast, with missing pairs hatched rather than shown as zero. Selecting a day opens its replay.
  - **Bad days.** Daily error chart with the five worst days. Clicking a bar or a listed day opens that exact replay in hindsight mode with the same cutoff and rule.
  - **Cutoff sweep.** "Would deciding later have helped?" across 24 hourly cutoffs, flagging cutoffs whose coverage is incomplete.
  - **Track-record backtest.** "Was the recent track record a useful guide?" Compares each day's track record with how that day turned out, and backtests a naive "subtract the recent bias" adjustment. Nothing used is published after the cutoff.
  - **Also included:** comparison-rule sensitivity and hour-of-day bias.
- **Data & method.** Source URLs, response hashes, per-day record counts, method steps and the limitations behind the numbers.

This is wind uncertainty analysis, not a purchase recommendation. The brief limits data to Elexon wind, so there is no demand, price or portfolio data. The app therefore makes no procurement-volume, cost or savings claim, and no calibrated risk claim.

## Run with Docker

Requires Docker Engine and Compose.

```sh
docker compose up --build
# Open http://localhost:8000
```

Or:

```sh
docker build -t wind-replay .
docker run --rm -p 8000:8000 wind-replay
```

The two-stage build compiles React, then serves the frontend and the Python API from one origin. The runtime uses a non-root user; Compose mounts a read-only filesystem with a temporary /tmp. `PORT` is configurable. The snapshot is bundled, so normal use needs no Elexon access, credentials or database.

## Run without Docker

Requires Python 3.10+ and Node 22. CI uses Python 3.12. The second pass was checked locally with Python 3.13 and Node 22.

```sh
python -m venv .venv
# Linux/macOS
. .venv/bin/activate
# Windows PowerShell instead: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt -c constraints.txt
npm ci
npm run build
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
# Open http://localhost:8000
```

For frontend development, run the Python command in one terminal and `npm run dev` in another. Vite proxies `/api` to port 8000. Production has no proxy and serves built assets directly through FastAPI.

## Verify

```sh
ruff check backend tests scripts && ruff format --check backend tests scripts
npm run format:check
python -m pytest -q
npm run build
npx playwright install chromium     # or set PW_CHROMIUM_PATH to an existing Chromium
npm run test:e2e
python scripts/audit.py             # independent recomputation of the default month
```

Observed for the current working tree, locally: **46 Python tests and 16 browser tests pass**, Ruff and Prettier checks are clean, the strict TypeScript build passes and the independent audit reproduces the baseline numbers exactly. Browser tests start and stop their own backend on port 8000, so stop any local server first. No tests are skipped. Starlette's TestClient emits one deprecation warning; it does not fail the tests.

**Python tests cover:**
- inclusive publication boundaries and exclusion of future versions
- synthetic mixed-vintage fallback, missing forecasts and missing half-hours
- revised actual selection and duplicate conflicts
- offset timestamps and signed metrics
- percentile definitions
- earlier-run selection: always older than the chosen run, never after the cutoff
- the real early-cutoff coverage gap and the cutoff sweep
- the track record: complete days only, an actual published one minute after the cutoff is excluded, the inclusive boundary, and every real track-record actual published by the cutoff
- validation and 422 messages
- CSV privacy and filenames
- all 31 delivery days at seven cutoff scenarios
- the late real January run, snapshot hashes, and pinned baseline metrics
- forecast-level bands partitioning the paired hours, with the real January values pinned

**Browser tests cover:**
- the decision view and the delayed-run boundary
- hindsight resetting when the day or cutoff changes, but not when the rule changes
- Lab-to-replay drill-through with Back/Forward
- deep links, plus invalid URL values falling back visibly
- a slow older request never overwriting a newer scenario
- keyboard navigation and focus
- metadata fetched once
- key findings that follow the selected cutoff and link to their evidence
- the cutoff timeline: run stops (including the delayed 12:25 run), stepping, leaving hindsight on a new stop, play from 00:00 and pause
- the heatmap: all 744 cells, five highlighted worst days, drill-through, and 62 gaps at a 01:00 cutoff
- every panel rendering at a real height, which guards against CSS class collisions
- no page overflow at 320, 390 and 1440px
- network-error retry
- an empty-coverage view that never shows Infinity, NaN or fabricated accuracy

These checks are not a WCAG certification or a browser matrix. See [docs/verification.md](docs/verification.md).

## Data contract and assumptions

### Scope

"Purchase decisions in January 2026" is interpreted as decision days 1–31 January and delivery days 2 January–1 February, using the next UK calendar day. The whole target period is GMT, so Europe/London equals UTC here. The implementation deliberately rejects decision dates outside this period. It must be adapted, not blindly reused, for BST/DST days, which do not have 24 hours.

### Forecast selection

For every hourly target `t`, select:

```
argmax publishTime among rows with startTime = t and publishTime <= decision cutoff
```

- **Selection rules.** The boundary is inclusive. Selection is independent per target, so mixed vintages are supported. It does not assume a fixed publication schedule, interpolate values, or use a future run to fill a gap.
- **Missing values.** These remain missing and are excluded from paired metrics.
- **Fallback.** `fallback` means a target uses an older vintage than the newest selected vintage on that delivery day. Zero fallback in the real snapshot does not prove the general case, so synthetic fixtures exercise it.
- **Earlier runs (`prior_runs`).** Up to three runs that were also published at or before the cutoff and are older than the newest selected run. They show forecast drift; they never contribute values to the selection.

09:30 UTC is an editable scenario default, **not a confirmed market deadline or user choice**. The brief defines publishTime as forecast creation time. We use it as an availability proxy; actual dissemination or ingestion lag is unknown. So "as of" means as of recorded creation time, not guaranteed real-time receipt.

### Actuals, temporal meaning and fleet

FUELHH documents 30-minute average MW. WINDFOR has hourly target timestamps. The sources inspected call it hourly but do not establish its within-hour meaning. The app exposes two **provisional assumptions**:

1. `hour_mean`: arithmetic mean of the half-hours at H and H+30 minutes. This is the default, not a validated interpretation.
2. `first_half`: compare the forecast at H with the 30-minute average starting at H.

Neither rule is semantically established, and similar sensitivity results do not prove correctness. The product labels metrics provisional and does not calculate daily energy from hourly values.

The official Elexon wind page directly compares WINDFOR with Generation by Fuel Type outturn. That supports the intended comparison but does not establish a unit-level fleet reconciliation. Scope is visible/operationally metered GB transmission wind, **not all embedded wind or total UK wind**.

Actuals use the latest publishTime returned per startTime in the fixed snapshot. In hindsight views they are retrospective and not claimed to have been available at the purchase cutoff. The decision-time track record is the one exception, and it is gated: it uses only past delivery days whose actual rows carry a `publishTime` at or before the cutoff. FUELHH rows in this snapshot were published 30–145 minutes after each half-hour began. This response has one row per actual startTime and no revisions, which does not prove historical revisions never existed. Exact duplicate observations are deduplicated; conflicting generation at identical keys raises an error rather than silently picking one.

### Metrics

- **Sign convention.** Error is forecast minus actual, so positive bias means over-forecast.
- **What is reported.** MAE, bias, RMSE and the largest absolute error use paired hours only and always report n. Empty samples give null, never zero.
- **Shortfall percentiles.** These are empirical P10/P50/P90 of signed error and P50/P90 of absolute error, using linear interpolation between ranks (numpy's default), plus the share of over-forecast hours. They describe January at one cutoff; they are **not** a calibrated interval, and none of them appears in the decision view.
- **Track record.** For a decision at cutoff C on day D, the window is the up to seven most recent earlier purchase days whose delivery-day actuals were *all* published at or before C on D. Each day is scored against the forecast selected at C on its own purchase day. Incomplete days are skipped rather than averaged, because a part-reported day would over-represent the night. The snapshot holds one version per actual half-hour; if that version was published after C, the half-hour counts as missing even if an earlier version may have existed.
- **MAPE.** Omitted because it is unstable at low wind.

### Snapshot findings

- **Forecast publication.** Publish windows run from 29 December 2025 through 31 January 2026, with an upper query bound of 1 February.
- **Forecast volume.** 19,856 forecast rows in 272 runs over 34 publication days: 584 rows and 8 runs per day, and 73 hourly targets per run. Those 73 include past targets; they are not 73 exclusively future hours.
- **Actuals.** 1,488 unique WIND actual half-hours, 48 per delivery day.
- **Duplicates.** None: no duplicate forecast `(publishTime, startTime)` pairs or duplicate actual startTimes.
- **Coverage by cutoff.** Checked at every minute of the day across all 31 days:
  - From 02:30 to 23:59 UTC, every cutoff covers 24/24 targets.
  - From **00:00 to 02:29**, the newest eligible run (22:30 the previous evening) stops short, so the **22:00 and 23:00 delivery targets are genuinely missing** (22/24) and shown blank.
  - No cutoff produces mixed vintages.
- **Late run.** The 15 January usual 11:30 run has publishTime 12:25. For delivery 16 January, an 11:30 cutoff uses the 09:30 run; the exact 12:25 boundary includes the delayed run.

**Default month (09:30 cutoff, hourly-mean comparison).**
- **Headline metrics.** 744 pairs, MAE 2,013.01 MW, signed bias +1,729.93 MW, RMSE 2,505.94 MW. First-half-hour comparison gives MAE 1,995.57 MW and bias +1,727.98 MW.
- **Shortfall percentiles.** 84% of hours were over-forecast. The 90th percentile of signed error is 4,144 MW, the median absolute error 1,608 MW and the 10th percentile −489 MW.
- **Five worst days.** Delivery 28, 12, 11, 21 and 27 January. Every hour of those days was over-forecast (MAE equals bias).

**Track-record backtest (09:30, hourly mean, 29 purchase days with a track record, 696 hours).**
- **Not predictive day to day.** The correlation between the trailing seven-day bias and that day's bias is −0.40; for MAE it is −0.52. A poor week did not foreshadow a poor next day. The windows overlap and n is small, so this is weak evidence either way.
- **Bias was steady.** Subtracting the trailing bias from every forecast would have lowered MAE from 1,969 to 1,689 MW (−14%). This is in-sample for one month, and the bias's cause is unknown, so it is a question for the client, not a recommended correction. The app never shows an adjusted forecast.

**By forecast level (09:30, hourly mean).** The windier the forecast, the more it overstated wind:

| Forecast | Hours | MAE MW | Bias MW | Over-forecast | 90th pct shortfall MW |
|---|---|---|---|---|---|
| < 5 GW | 31 | 1,298 | +136 | 52% | 1,734 |
| 5–10 GW | 210 | 1,454 | +796 | 70% | 2,762 |
| 10–15 GW | 206 | 1,596 | +1,447 | 85% | 2,833 |
| ≥ 15 GW | 297 | 2,772 | +2,753 | 98% | 4,792 |

This pattern is consistent with curtailment at high output, or with a fleet-scope difference that grows with output, but the data cannot distinguish them. The five worst days (16% of the month) carried 36% of all absolute error.

**Cutoff sweep (hourly cutoffs, hourly mean).**
- **MAE falls slowly** from about 2,070 MW (03:00) to 2,013 MW (10:00), 1,901 MW (12:00) and 1,825 MW (23:00).
- **Bias stays near +1.6 to +1.8 GW** at every cutoff.

These are provisional comparison results for this period. They are not a calibrated risk distribution, not evidence that either temporal assumption is true, and not an explanation of the bias. The snapshot cannot distinguish forecast error from curtailment or a fleet-scope difference between WINDFOR and FUELHH.

### Refresh and provenance

`data/manifest.json` records retrieval time, exact query URLs, counts and SHA-256 hashes. Retain it with the raw responses for reproducibility. The refresh script performs explicit bounded GETs; there is no per-interaction refresh, background polling or hidden live dependency.

```sh
python scripts/snapshot.py
python -m pytest -q
```

Refresh intentionally replaces the snapshot. After review, commit the new response files and manifest together, and investigate any changed counts or hashes. Several tests pin the current snapshot's numbers and will fail after a refresh until reviewed. The script waits for both responses before writing but is not a transaction-safe production ingestion service.

## API

- `GET /api/health`
- `GET /api/meta`: counts, per-day provenance and the snapshot manifest.
- `GET /api/replay?decision=2026-01-15&cutoff=11:30&rule=hour_mean&reveal=false`
  - Returns 24 points with `forecast`, `publishTime`, `fallback` and `age_hours`, plus `coverage`, `prior_runs`, `day_runs` (publication times only, for the timeline) and `track_record` (built only from actuals published at or before the cutoff).
  - With `reveal=true` it also returns `actual`, `actual_publishTimes`, `error`, `metrics` and actual coverage. With `reveal=false` these are absent.
- `GET /api/analysis?cutoff=09:30&rule=hour_mean`: month metrics, `distribution`, rule sensitivity, per-day and per-hour metrics, `grid` (signed error per day and hour, null when unpaired), `by_level` and `track_record_check`.
- `GET /api/cutoff-sweep?rule=hour_mean`: month MAE, bias, RMSE, paired n, forecast coverage and mean forecast age for each hourly cutoff 00:00–23:00.
- `GET /api/export`: same parameters as replay. Returns CSV named by day, cutoff and view, e.g. `wind-replay-2026-01-15-0930-decision.csv`. Hidden actuals remain absent from the decision export.
- `GET /docs`: generated API reference.

**Error contract.** Invalid scenarios return 422 with a readable message; unexpected server errors remain 500 rather than being reported as user input errors.

**Caching.** Full-month results are cached in process because the snapshot is immutable. The React client cancels superseded requests and ties every result to the exact request that produced it. It reuses immutable responses within a page session and never caches failures.

**Not access control.** Decision/hindsight separation is a UX/API contract, not an access-control boundary. This non-sensitive historical pilot intentionally exposes retrospective endpoints; a private production deployment would need authentication.

## File map

```
backend/engine.py              Pure domain logic: validation, per-target selection, earlier runs,
                               actual revisions, metrics, percentiles and the publish-time-gated
                               track record; in-memory snapshot store
backend/app.py                 FastAPI routes, 422 mapping, CSV export, static asset serving
frontend/main.tsx              Entry point
frontend/App.tsx               Shell, navigation, URL-synchronised scenario, focus management
frontend/scenario.ts           Scenario type, URL parse/serialise with validation, hindsight-reset rule
frontend/api.ts                Typed API responses and the request hook (abort, cache, retry)
frontend/format.ts             Number/date formatting and the chart palette
frontend/ui.tsx                Shared stat, notice, loading/error and control components
frontend/screens/ReplayScreen.tsx    Decision/hindsight replay
frontend/screens/AnalysisScreen.tsx  Accuracy lab, drill-through and cutoff sweep
frontend/screens/MethodScreen.tsx    Data, method and provenance
frontend/screens/CutoffTimeline.tsx  Run-publication timeline with step and playback
frontend/screens/ErrorHeatmap.tsx    Day × hour error heatmap
frontend/style.css             Tokenised responsive styles
scripts/snapshot.py            Explicit bounded Elexon snapshot acquisition
scripts/audit.py               Independent numerical cross-check
scripts/smoke.sh               Local one-origin smoke check
scripts/measure.py             Microbenchmark (no external requests)
scripts/verify_visual.mjs      Reproducible desktop/mobile screenshot capture
scripts/check_deploy.py        Smoke-check any running deployment against the documented numbers
data/wind.json                 Raw WINDFOR stream response
data/actual.json               Raw FUELHH WIND stream response
data/manifest.json             Queries, retrieval time, counts and hashes
tests/test_engine.py           Selection, metrics, synthetic edge cases, real snapshot tests
tests/test_api.py              HTTP schema, validation and CSV checks
tests/browser/app.spec.js      Browser interactions, URL state, races, keyboard, responsiveness, retry
screenshots/                   Inspected desktop/mobile captures of the current UI
docs/architecture.md           Design choices, production path and tradeoffs
docs/demo-outline.md           Customer and technical walkthrough script; not a recording
docs/verification.md           Observed checks and remaining unverified areas
Dockerfile                     Multi-stage, non-root one-origin runtime
compose.yaml                   Local container service and healthcheck
.github/workflows/ci.yml       Lint, format, Python, audit, React build, browser and Docker CI checks
playwright.config.js           Browser test runner; optional PW_CHROMIUM_PATH and E2E_BASE_URL
package.json, package-lock.json      Frontend scripts and locked dependency graph
requirements*.txt              Direct Python dependencies (runtime, and dev tools)
constraints.txt                Full resolved Python dependency set, used by CI and Docker
pyproject.toml                 Ruff lint/format and pytest settings
```

## Design and operating limits

- **No database.** A 20k-row bounded snapshot does not justify one. Selection is indexed by target in memory, and request-time replay never calls Elexon.
- **One runtime origin.** This avoids CORS and separate frontend/backend hosting assumptions.
- **Layering.** Pure domain logic is isolated from HTTP and presentation.
- **No hidden models.** The UI makes no financial decisions and uses no hidden training or error bands.

This is a deliberately small pilot, not an "enterprise-ready" system. Production would need:
- agreed temporal semantics and timestamp-availability guarantees
- operational controls, plus authentication/authorization where applicable
- revision handling and atomic ingestion
- monitoring and load tests
- an accessibility review and deploy-specific security configuration

No distributed services, queues or infrastructure wrappers were added. See `docs/architecture.md`.

## Deployment and submission

The brief requires:
- a Vercel or Heroku deployment
- an anonymously named public GitHub repo, which this repository satisfies
- an unlisted YouTube video of at most 10 minutes: a customer overview and a technical walkthrough of at most five minutes each
- form submission

**Deployed application: https://k7m2q9-six.vercel.app** (Vercel). The video and form submission are still pending.

To check a deployment against the documented behaviour, run either of these from any machine with internet access:

```sh
python scripts/check_deploy.py https://k7m2q9-six.vercel.app            # 14 API and page checks, standard library only
E2E_BASE_URL=https://k7m2q9-six.vercel.app npx playwright test           # the full browser suite, no local server
```

**Verified live on 28 October 2026**, run by the author from their own machine: `check_deploy.py` passed 14/14 and the browser suite 16/16 against https://k7m2q9-six.vercel.app. The authoring environment cannot reach `vercel.app`, so it validated both only against a local server.

**Why Vercel.** Heroku no longer has a free tier, so Vercel's Hobby plan was the no-cost option. The points below come from search-result summaries of Vercel's FastAPI guide and Python runtime docs:
- **Entrypoint.** Vercel detects a FastAPI instance named `app` in a recognised entry file (such as `app.py`, `index.py` or `main.py` at the root or under `api/`, `app/` or `src/`), or in the module set by `tool.vercel.entrypoint` in `pyproject.toml`. Our app lives at `backend.app:app`.
- **Static assets.** These are served from `public/` by Vercel's CDN.
- **Python.** 3.12 is the default runtime.

The first two checks in `check_deploy.py` confirm that the React build is actually served by the deployment, and the snapshot checks confirm that `data/*.json` was bundled with the function.

Locally, importing the app and loading the snapshot takes about 0.44 s, which is the cold-start cost to expect. Analysis and the cutoff sweep compute on first request (about 0.45 s and 1.1 s), then cache per instance.

The Docker `PORT` contract prepares a container-hosted route; it does not prove provider eligibility, free capacity or compatibility. Verify the chosen provider's current runtime and plan rules before deploying, and do not assume Heroku is free. Open every submitted URL in a private/incognito window before submission.

## AI disclosure

AI assistance was used in this project, as the brief permits.

- **First version.** AI assistance was used for domain research, implementation, test generation, documentation and visual review. User-supplied Claude architecture proposals were reviewed during design and informed the architecture discussion.
- **Second pass.** The second-pass review and implementation was carried out in a Claude Code session (Anthropic's AI coding agent) at the author's direction. That pass covered:
  - the frontend split
  - URL state and hindsight reset
  - earlier runs, shortfall percentiles, the cutoff sweep and drill-through
  - in a later pass, the decision-time track record and its backtest
  - styling and accessibility fixes
  - new tests and these documentation updates
- **Review.** The author reviews and is responsible for all changes.

All selected behaviour and data assumptions are explicit, testable and explained above.

## Sources

- https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream
- https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream
- https://bmrs.elexon.co.uk/wind-generation
- https://bmrs.elexon.co.uk/api-documentation/endpoint/forecast/generation/wind
- Exact API query URLs are in `data/manifest.json` and the product's provenance view.

Source data is attributed to Elexon / NESO as described by those pages. No new data licensing claim is made here; confirm applicable reuse terms before public distribution.
