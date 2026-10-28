# Verification record

## First version (commit 5276489)

- **CI.** GitHub Actions passed on the public repository: [run 40538346465](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40538346465), job 122309616182. Steps: Python 3.12 pytest (26 tests), npm production build, Playwright (6 tests), Docker image build, and a container health and replay smoke.
- **Local checks.** These also covered:
  - the independent metric audit and the one-origin smoke test
  - a production npm audit
  - the microbenchmark
  - inspected desktop and mobile screenshots

These results apply to that commit only. The second pass does not inherit them.

## Second pass in CI

Pushed to `second-pass-decision-workbench`. GitHub Actions [run 40546173350](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40546173350) on commit `8f3746b` passed every step on Python 3.12 and Ubuntu: pytest (37), the audit, the production build, Playwright (12), the Docker image build, and the container health and replay smoke. This resolves the local Docker gap noted below.

## Deployment (28 October 2026)

- **Deployed URL.** The app is deployed on Vercel at https://k7m2q9-six.vercel.app from `main` at `684d48c`, which adds `[tool.vercel] entrypoint = "backend.app:app"`.
- **Verified live.** On 28 October 2026 the author ran both checks from their own machine against https://k7m2q9-six.vercel.app, deployed from `main` at the time: `check_deploy.py` passed 14/14 (served page and bundle, snapshot bundled, no hindsight fields, late-run and early-gap behaviour, the exact baseline month metrics, an actual-free export, 422 on invalid input), and `E2E_BASE_URL=… npx playwright test` passed 16/16.
- **Not reachable from the authoring environment.** Its network policy blocks the host: the proxy refuses the connection, and name resolution fails. No result for the live site is claimed here.
- **Checks to run against the live site.** `scripts/check_deploy.py` makes 14 checks: the page and bundle are served, the snapshot is bundled, the decision view has no hindsight fields, the late-run and early-gap behaviour, the baseline month metrics, an actual-free decision export, and 422 on invalid input. `E2E_BASE_URL=<url> npx playwright test` runs the browser suite against any URL. Both were validated here against a local server: 14/14 checks and 16/16 browser tests pass.

## Fifth pass (local, 27 October 2026)

- **Checks.** 46 pytest and 16 Playwright pass; Ruff, Prettier and the strict build pass. New Python tests check that `day_runs` lists purchase-day publications only (no forecast values after the cutoff reach the decision response) and that the analysis `grid` matches the per-day points, including gaps at a 01:00 cutoff.
- **A bug the tests caught.** The first version of the timeline reused the class name `.track`, which the track-record panel also uses. That panel collapsed to 8 px and its content overlapped the sections below. The responsive browser test failed because the overlapped summary could not be clicked. I renamed the timeline classes, and the responsive test now also asserts that every panel renders taller than 40 px.
- **Visual inspection.** Timeline and heatmap were checked at 1440 and 320 px, and playback was checked to advance through the runs. Fixed after review: Play now always starts the day from 00:00. Screenshot capture now requests reduced motion, so charts are not caught mid-animation.

## Fourth pass in CI

Merged through [shubhanshu2103/k7m2q9#3](https://github.com/shubhanshu2103/k7m2q9/pull/3). CI passed on the branch ([run 40551431752](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40551431752)) and on `main` ([run 40551629743](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40551629743)), including Docker with `constraints.txt`.

## Fourth pass (local, 27 October 2026)

- **Python.** 44 pytest pass under Python 3.13 and, in a clean venv installed with `-c constraints.txt`, under Python 3.12. New tests cover forecast-level bands partitioning paired hours, and the real band values.
- **Lint and formatting.** `ruff check` (explicit rule set E4, E7, E9, F, I, UP, B) and `ruff format --check` pass after a formatting and import-sorting change. `npm run format:check` (Prettier) passes.
- **Browser.** 14 Playwright pass. New: the findings summary is computed from the selected scenario, its evidence link reaches the forecast-level panel, and it changes with the cutoff.
- **Visual inspection.** The new Lab panels were checked at 1440 and 320px. Fixed after review: the band chart's axis labels collided at 320px.
- **Docker.** Not verified locally. Docker Hub rate-limited the base images (HTTP 429). On the one attempt that pulled them, `pip install` failed inside the build, most likely because the build container cannot use this sandbox's network proxy: the same install succeeds in a clean Python 3.12 venv here. CI's Docker step is the check for the constraints change.

## Third pass in CI

[Run 40549449242](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40549449242) on commit `58c2327` passed every step, including Docker.

## Third pass (local, 27 October 2026)

- **Formatting.** A Prettier-only commit formats the frontend and browser tests; no behaviour change.
- **`python -m pytest -q`.** 42 passed. Five new tests:
  - synthetic complete-day track record
  - an actual published one minute after the cutoff is excluded, and the inclusive boundary at that minute
  - real-snapshot gating: every actual behind the 15 and 31 January track records was published by the cutoff
  - the pinned backtest values
  - the decision replay carrying a track record with no current-day actuals, and an unchanged export
- **`npm run test:e2e`.** 13 passed. New: the track-record panel in the decision view, the empty state on 2 January, and the link to the Lab backtest.
- **Other checks.** `npm run build`, `python scripts/audit.py` and Ruff (F rules) pass. Uncached full-month analysis now takes about 0.45 s locally because of the backtest, then it is cached per process; a decision-view track record takes about 13 ms.
- **Visual inspection.** The new panels were checked at 1440, 390 and 320px with no horizontal overflow. Fixed after review: an awkward "7 of up to 7" sentence, a missing caption on the mini chart, and an inherited red accent on the backtest panel.

## Second pass (local, 27 October 2026, before push)

Environment: Linux container, Python 3.13, Node 22, Playwright 1.64 with a preinstalled Chromium via `PW_CHROMIUM_PATH`.

**Before any changes.** The unchanged baseline was rerun here: 26 pytest passed, 6/6 Playwright passed, and the audit reproduced the baseline exactly.

**Observed passing after the changes.**

- **`python -m pytest -q`.** 37 passed: the 26 original tests, unchanged, plus 11 new ones. The new tests cover:
  - percentiles
  - earlier-run eligibility, synthetic and across the real snapshot at four cutoffs
  - the real 00:00–02:29 coverage gap
  - cutoff-sweep consistency with analysis
  - pinned default-month metrics
  - the sweep endpoint and analysis validation
  - malformed-date messages and export filenames
  - decision-export column count
- **`npm run build`.** The strict TypeScript check and the Vite production build pass.
- **`npm run test:e2e`.** 12 passed:
  - decision view and late-run boundary
  - hindsight reset (day, cutoff, tab) but not on a rule change
  - Lab drill-through preserving cutoff and rule, with Back/Forward
  - deep links and invalid URL values
  - a slow older response that cannot overwrite a newer scenario
  - keyboard navigation and focus
  - metadata fetched once
  - no overflow at 320, 390 and 1440px with tables expanded
  - network failure and retry
  - empty coverage that never shows Infinity or NaN

  One failure during development came from the test itself: a case-insensitive `getByText("NaN")` matched "provenance". The assertion was made a case-sensitive whole-word match and additionally checks the page text; it was not loosened.
- **`python scripts/audit.py`.** The independent recomputation now asserts the documented baseline: 744 pairs, MAE 2013.008064516129, bias 1729.9314516129032, RMSE 2505.943149370381.
- **`sh scripts/smoke.sh`.** The one-origin production smoke passes.
- **Coverage sweep.** An exhaustive scan of every minute 00:00–23:59 across all 31 decision days found incomplete coverage at exactly 00:00–02:29 (22/24, missing 22:00 and 23:00) and zero fallback intervals at any cutoff.
- **`python scripts/measure.py`.** Uncached full-month analysis takes a median of about 89 ms. The uncached 24-cutoff sweep takes a median of about 1.1 s; it is cached per process after the first request. This is a microbenchmark only.
- **Visual inspection.** Rendered screenshots were checked at 1440, 390 and 320px for:
  - all three screens
  - hindsight mode
  - the real missing-coverage scenario
  - the expanded tables

  Defects found and fixed during that review:
  - the legend swatch inherited block styles
  - the sidebar background stopped at viewport height
  - the cutoff-chart label overlapped the line
  - the error-chart colours had no legend

  `screenshots/` now holds captures of the current UI made by `scripts/verify_visual.mjs`. In this environment Google Fonts was blocked, so the captures may use the system fallback font.

## Not verified, or deferred

- **Docker for the second pass.** A Docker daemon was available, but `docker build` failed twice because Docker Hub returned `429 Too Many Requests` for `node:22-alpine`. The Dockerfile is unchanged since the passing CI run; the new frontend files sit inside the already-copied `frontend/` directory. It is still not verified until a build and run pass.
- **CI on the second pass.** Not run: nothing has been pushed.
- **Deployment.** Vercel/Heroku deployment and plan compatibility have not been attempted, and there is no deployed URL.
- **Submission tasks.** The YouTube demo, form submission and incognito checks of the submitted URLs are outstanding.
- **Semantics.** WINDFOR within-hour semantics, real dissemination latency, and the cause of the persistent positive bias are all unresolved.
- **Fleet.** Unit-level forecast/outturn fleet reconciliation is not established.
- **Wider review.** No cross-browser matrix (Chromium only), formal accessibility audit, screen-reader test, or production load/security review has been done.

## Non-failing warnings

- **Bundle size.** The production JavaScript bundle is about 199 KB gzipped (668 KB minified) and exceeds Vite's advisory 500 KB threshold, mostly because of the chart library.
- **TestClient.** Starlette's TestClient emits a deprecation warning.
