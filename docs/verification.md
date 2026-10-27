# Verification record

## First version (commit 5276489)

- **CI.** GitHub Actions passed on the public repository: [run 40538346465](https://github.com/shubhanshu2103/k7m2q9/actions/runs/40538346465), job 122309616182. Steps: Python 3.12 pytest (26 tests), npm production build, Playwright (6 tests), Docker image build, and a container health and replay smoke.
- **Local checks.** These also covered:
  - the independent metric audit and the one-origin smoke test
  - a production npm audit
  - the microbenchmark
  - inspected desktop and mobile screenshots

These results apply to that commit only. The second pass does not inherit them.

## Second pass (local, 27 October 2026, not yet pushed)

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
