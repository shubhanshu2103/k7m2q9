# Wind replay

A January 2026 wind-forecast replay for a UK day-ahead purchasing team. React + TypeScript, Python + FastAPI, and an immutable Elexon snapshot.

**Status:** working local pilot, not a submitted challenge. Public repository, Vercel/Heroku deployment, demo recording/upload and submission are deferred. No deployed application link exists yet. Docker configuration is supplied but a container build/run has not been verified in the authoring environment because a Docker engine is unavailable. It must pass before claiming Docker delivery complete.

## Product

- **Decision replay:** pick a January purchase date and an assumed cutoff on that day. View the forecast for the following UK calendar day, with the actual forecast publication times used. Actuals are omitted from this API response.
- **Reveal actuals:** switch explicitly to a retrospective comparison. Inspect paired targets, MAE, signed bias and RMSE, and export CSV with provenance.
- **Accuracy lab:** evaluate all 31 purchase days at a consistent cutoff, compare daily error and hour-of-day bias, and compare two temporal assumptions.
- **Data & method:** inspect source URLs, response hashes, per-day record counts and the limitations behind the numbers.

This is wind uncertainty analysis, not a purchase recommendation. It has no demand, price or portfolio data, and makes no procurement-volume or savings claims.

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

The two-stage build compiles React, then serves the frontend and Python API from one origin. The runtime uses a non-root user; Compose mounts a read-only filesystem with a temporary /tmp. `PORT` is configurable. The snapshot is bundled, so normal use needs no Elexon access, credentials or database.

## Run without Docker

Requires Python 3.10+ and Node 22. Tested here with Python 3.10 and Node 22. CI targets Python 3.12.

```sh
python -m venv .venv
# Linux/macOS
. .venv/bin/activate
# Windows PowerShell instead: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
npm ci
npm run build
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
# Open http://localhost:8000
```

For frontend development, run the Python command in one terminal and `npm run dev` in another. Vite proxies `/api` to port 8000. Production has no proxy and serves built assets directly through FastAPI.

## Verify

```sh
python -m pytest -q
npm run build
npx playwright install chromium
npm run test:e2e
```

Observed result: **26 Python tests and 6 browser tests pass**. Browser tests start and stop their own backend on port 8000, so stop any existing local server first. The first test run exposed locator mistakes; those tests were corrected and the full suite rerun successfully. No tests are skipped. A dependency deprecation warning from Starlette's current TestClient/httpx combination remains; it does not fail the tests.

Python coverage includes inclusive publication boundaries, exclusion of future versions, synthetic mixed-vintage fallback, missing forecasts, missing half-hours, revised actual selection, duplicate conflicts, offset timestamps, signed metrics, validation, CSV privacy, all 31 delivery days at seven cutoff scenarios, the late real January run, and snapshot hashes. Browser tests cover replay/reveal, delayed-run provenance, comparison switching, methodology, network-error recovery and no page overflow at 320, 390 and 1440 pixels, plus an empty-forecast view that never shows Infinity or fabricated accuracy. Actual desktop/mobile screenshots were inspected for readability, chart legends, responsive controls and visible caveats. These checks do not claim full WCAG certification or a browser matrix.

CI runs those checks and additionally builds and smoke-tests Docker. CI has been authored, not run on GitHub, since repository publication is on hold.

## Data contract and assumptions

### Scope

Interpret “purchase decisions in January 2026” as 1–31 January decision days and 2 January–1 February delivery days. Use the next UK calendar day. The whole target period is GMT, so Europe/London equals UTC here. This implementation deliberately rejects decision dates outside this period; it must be adapted, not blindly reused, for BST/DST days.

### Forecast selection

For every hourly target `t`, select:

```
argmax publishTime among rows with startTime = t and publishTime <= decision cutoff
```

The boundary is inclusive. Selection is independent per target, so the design supports mixed vintages. It does not assume a fixed publication schedule, interpolate values, or use a future run to fill a gap. Missing values remain missing and are excluded from paired metrics. `fallback` means a target uses an older vintage than the newest selected vintage on that delivery day. Zero fallback in this real snapshot does not prove the general case: synthetic fixtures explicitly exercise it.

09:30 UTC is an editable scenario default, **not a confirmed market deadline or user choice**. The brief defines publishTime as forecast creation time. We use it as an availability proxy; actual dissemination or ingestion lag is unknown. Therefore “as of” means as of recorded creation time, not guaranteed real-time receipt.

### Actuals, temporal meaning and fleet

FUELHH documents 30-minute average MW. WINDFOR has hourly target timestamps. Sources inspected call it hourly but do not establish its within-hour meaning. The app exposes two **provisional assumptions**:

1. `hour_mean`: arithmetic mean of the half-hours at H and H+30 minutes. This is the UI default, not a validated interpretation.
2. `first_half`: compare the forecast at H with the 30-minute average starting H.

Neither rule is semantically established. Similar sensitivity results do not prove correctness. The product labels metrics provisional and does not calculate daily energy from hourly values. The official Elexon wind page directly compares WINDFOR with Generation by Fuel Type outturn, supporting the intended comparison but not establishing a unit-level fleet reconciliation. Scope is visible/operationally metered GB transmission wind, **not all embedded wind or total UK wind**.

Actuals use the latest publishTime returned per startTime in the fixed snapshot. They are retrospective, not claimed to have been available at the purchase cutoff. This response has one row per actual startTime and no revisions; that does not prove historical revisions never existed. Exact duplicate observations are deduplicated; conflicting generation at identical keys raises an error rather than silently picking one.

### Snapshot findings

- Forecast publish windows: 29 December 2025 through 31 January 2026; upper query bound 1 February.
- 19,856 forecast rows; 272 runs; 34 publication days; 584 rows and 8 runs per day; 73 hourly targets per run, including past targets. Not 73 exclusively future hours.
- 1,488 unique WIND actual half-hours, 48 per delivery day.
- No duplicate forecast `(publishTime, startTime)` pairs or duplicate actual startTimes in these acquired responses.
- Tested cutoff scenarios 07:30, 09:20, 09:30, 11:30, 15:30, 22:30 and 23:59 UTC: 24/24 forecast targets and 24/24 actual comparisons on every delivery day, zero mixed vintages.
- The 15 January usual 11:30 run has publishTime 12:25. For delivery 16 January, an 11:30 cutoff uses the 09:30 run. The exact 12:25 boundary includes the delayed run.

At the illustrative 09:30 cutoff, hourly-mean comparison yields 744 pairs, MAE 2,013.01 MW, signed bias +1,729.93 MW and RMSE 2,505.94 MW. First-half-hour comparison yields MAE 1,995.57 MW and bias +1,727.98 MW. These are provisional comparison results for this period, not a calibrated risk distribution or evidence that either temporal assumption is true. Bias is forecast minus actual; positive means over-forecast. Metrics use paired points only and all report sample size. MAPE is omitted to avoid division instability near zero.

### Refresh and provenance

`data/manifest.json` records retrieval time, exact query URLs, counts and SHA-256 hashes. Retain it with the raw responses for reproducibility. The refresh script performs explicit bounded GETs; there is no per-interaction refresh, background polling or hidden live dependency.

```sh
python scripts/snapshot.py
python -m pytest -q
```

Refresh intentionally replaces the snapshot. Commit the new response files and manifest together after review, and investigate changed counts or hashes. The script waits for both responses before writing but is not a transaction-safe production ingestion service. A production version would use versioned atomic snapshots and a monitored ingestion pipeline.

## API

- `GET /api/health`
- `GET /api/meta`: counts, per-day provenance and snapshot manifest.
- `GET /api/replay?decision=2026-01-15&cutoff=11:30&rule=hour_mean&reveal=false`
- `GET /api/analysis?cutoff=09:30&rule=hour_mean`
- `GET /api/export`: same parameters as replay, returns CSV. Hidden actuals remain absent from the export.
- `GET /docs`: generated API reference.

Input errors return 422. Empty paired samples return null metrics, not zero. Error and empty states are distinct. The React client cancels stale requests when a scenario changes and removes stale results before showing a loading or error state. Decision/reveal separation is a UX/API contract, not an access-control boundary: this non-sensitive historical pilot intentionally exposes retrospective endpoints. Authentication would be required for a private production deployment.

## File map

```
backend/engine.py          Pure selection, actual revision and metric logic; snapshot store
backend/app.py             FastAPI routes, validation boundary, CSV export, static serving
frontend/main.tsx          Typed React replay, analysis and methodology UI
frontend/style.css         Responsive layout and chart treatment
scripts/snapshot.py        Explicit bounded Elexon snapshot acquisition
scripts/verify_visual.py   Reproducible desktop/mobile screenshot capture
scripts/audit.py           Independent numerical cross-check
scripts/smoke.sh           Local one-origin smoke check
scripts/measure.py         Microbenchmark (no external requests)
data/wind.json             Raw WINDFOR stream response
data/actual.json           Raw FUELHH WIND stream response
data/manifest.json         Queries, retrieval time, counts and hashes
tests/test_engine.py       Selection, metrics, synthetic edge cases, real snapshot tests
tests/test_api.py          HTTP schema, validation and CSV checks
tests/browser/             Browser interactions, responsiveness and retry tests
screenshots/               Inspected example desktop/mobile output
docs/architecture.md       Design choices, production path and tradeoffs
docs/demo-outline.md       Customer and technical walkthrough guide; not a recording
docs/verification.md       Observed checks and remaining unverified areas
docs/effort.md             Timing provenance and 16-hour cap notes
Dockerfile                 Multi-stage, non-root one-origin runtime
compose.yaml               Local container service and healthcheck
.github/workflows/ci.yml   Python, React, browser, Docker CI checks
package-lock.json          Locked frontend dependency graph
requirements*.txt          Pinned direct Python dependencies
```

## Design and operating limits

There is no database because a 20k-row bounded snapshot does not justify one. Selection is indexed by target in memory; request-time replay never calls Elexon. A single runtime origin avoids CORS and separate frontend/backend hosting assumptions. Pure domain logic is isolated from HTTP and presentation. UI does not make financial decisions or use hidden training/error bands.

This is a deliberately small pilot, not an “enterprise-ready” system. Production would need agreed temporal semantics, timestamp-availability guarantees, operational controls, authentication/authorization where applicable, revision handling, atomic ingestion, monitoring, load tests, accessibility review and deploy-specific security configuration. No distributed services, queues, infrastructure wrappers or false scale claims were added to decorate the architecture. See `docs/architecture.md`.

## Deployment and submission hold

The brief requires Vercel or Heroku deployment, an anonymously named public GitHub repo, an unlisted YouTube video of no more than 10 minutes (customer overview and technical walkthrough no more than five minutes each), and submission. Those effects are deferred at the user's request. No hosting purchase, repo creation, video upload or form submission has occurred. There is no placeholder deployment URL.

The Docker `PORT` contract prepares a container-hosted route; it does not prove provider eligibility, free capacity or compatibility. Verify the chosen provider's current runtime and free-tier rules before deployment. Do not assume Heroku is free. Public links and incognito access remain to be tested after publication is authorized. The local pilot may be reviewed now without publishing it.

## AI disclosure

AI assistance was used for domain research, implementation, test generation, documentation and visual review. User-supplied Claude architecture proposals were reviewed during design and informed the architecture discussion. No direct Claude coding session or direct Claude API call was used for this implementation. All selected behavior and data assumptions are explicit, testable and explained above. This disclosure is required by the brief; the project makes no claim about evading AI detection.

## Sources

- https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream
- https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream
- https://bmrs.elexon.co.uk/wind-generation
- https://bmrs.elexon.co.uk/api-documentation/endpoint/forecast/generation/wind
- Exact API query URLs are in `data/manifest.json` and the product's provenance view.

Source data is attributed to Elexon / NESO as described by those pages. No new data licensing claim is made here; confirm applicable reuse terms before public distribution.
