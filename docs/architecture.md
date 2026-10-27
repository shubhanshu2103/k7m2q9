# Design record

## Goal

Make a historical purchasing decision auditable and useful:
- which forecast value was eligible
- which publication supplied it and how old it was
- whether it had been moving
- what the retrospective comparison says
- which assumptions qualify it

A smooth chart is useful only if those facts survive inspection.

## Components

```
Bounded Elexon GETs -> raw JSON + manifest -> in-memory Store (backend/engine.py)
                                                    |
                 FastAPI: replay / analysis / cutoff-sweep / export / meta (backend/app.py)
                                                    |
                               React + Recharts, one origin (frontend/)
```

### Backend

`engine.py` has no HTTP or React dependency.
- **`parse_scenario`.** The single validation boundary for date, cutoff and rule. It raises `ValueError` with a user-facing message, which `app.py` maps to 422. Other exceptions stay 500, so a bug is never reported as bad input.
- **Store loading.** The store normalises timestamps to aware UTC, rejects invalid numeric values, resolves actual revisions and indexes forecasts by target.
- **`select_forecasts`.** Inclusive and per target.
- **`_prior_runs`.** Reuses the same `publishTime <= cutoff` filter, then keeps up to three runs older than the newest selected run. It cannot add hindsight by construction.
- **`track_record`.** Replays earlier purchase days at the same cutoff and pairs them with actuals through `_actual_for(..., available_by=cutoff)`, which treats any half-hour published after the cutoff as missing. Only complete days enter the window. `_track_record_check` backtests that context across the month. The API adds `track_record` to replay responses but not to CSV exports.
- **`metrics` and `distribution`.** Pure functions over paired points.
- **Caching.** Full-month analysis and the 24-cutoff sweep are `lru_cache`d per process. The data is immutable, and an uncached sweep takes about 1.1 s locally.

### Frontend

The frontend is split by responsibility, not by framework convention:

- **`scenario.ts`.** Pure state rules. It parses and serialises the URL and validates each value, mirroring the backend. Invalid values fall back to defaults and are reported to the user. It also holds `change()`, which encodes the hindsight-reset rule: a new day or cutoff is a new decision, so `reveal` returns to false unless the caller explicitly requests hindsight (the Lab drill-through does).
- **`api.ts`.** Response types and `useApi`. A result is bound to the exact request path that produced it, so a slow response for an older scenario can never render under a newer one. Superseded requests are aborted. Successful responses are reused for the page session, so metadata is fetched once. Failures are never cached and can be retried.
- **`App.tsx`.** The shell. It handles navigation, URL history and focus. Screen changes and drill-through push a history entry; control tweaks replace it so Back is useful.
- **`screens/*`.** One file per screen.
- **`ui.tsx` and `format.ts`.** Shared presentation.

### Container

A multistage image builds TypeScript and React, then copies only the assets and Python runtime into a non-root container. The dataset stays read-only. Raw responses and hashes permit independent reproduction without API access during review.

## Product decisions in the second pass

- **Hindsight resets on a new decision.** In the first version, reveal persisted across days, cutoffs and tabs, so a user stepping through days in hindsight mode never saw a forecast-only view again. The replay's point is to see what was known first.
  - Changing the comparison rule does not reset it, because the rule only affects hindsight.
  - The cost is one extra click when browsing many days retrospectively. The Lab's day list and drill-through cover that workflow instead.
- **Earlier runs instead of an uncertainty band.** A decision-time band would need a calibration window that precedes January. Building it from January's own errors would leak the future into the decision view. Showing earlier eligible runs gives a legitimate decision-time signal of how unsettled the forecast was, using only the information then available.
- **Shortfall percentiles in the Lab only.** The brief asks the team to consider quantified error when deciding how much other generation might be needed. The shortfall percentiles give that error a buyer-relevant reading: how often, and by how much, wind came in below the forecast.
  - They are labelled January-only and retrospective.
  - They never appear in the decision view.
  - There is no demand, price or portfolio data, so they are not turned into a volume.
- **Cutoff sweep.** The cutoff is an assumption, so the useful question is how sensitive the answer is to it. The sweep shows that later cutoffs reduce MAE only modestly while the large positive bias persists. It also surfaced a real coverage gap for cutoffs before 02:30.
  - It does not claim when the market actually closes.
- **Track record at decision time (third pass).** FUELHH rows carry their own `publishTime`, 30–145 minutes after each half-hour in this snapshot. So the decision view can show how the same cutoff's forecasts fared over recent complete delivery days using only actuals published by the cutoff. This is the legitimate decision-time version of "consider the quantified error".
  - **Backtested in the Lab before anyone relies on it.** Day to day it was not predictive in January (correlations −0.40 for bias, −0.52 for MAE over 29 days). A naive bias subtraction would have cut MAE by 14%, but that is in-sample and the bias's cause is unknown.
  - **What the UI does with that.** It shows the record as context with that caveat, and never shows an adjusted forecast.
- **Drill-through over a new screen.** Poor days link to the exact replay with the same cutoff and rule, in an explicitly labelled hindsight mode. No new tab was added.

## Choices

- **No database.** The task is a fixed 34-day publication snapshot, not a live market-data service.
- **No pandas.** Plain Python is sufficient for 20k observations and makes selection and fallback easy to audit without implicit index filling.
- **No added frontend state or test libraries.** URL state, the request hook and the mobile table layout are small enough to own. Browser tests exercise them end to end.
- **One origin.** Fewer deployment moving parts, no cross-origin configuration and no duplicate API logic in the UI.
- **No MAPE.** Low wind values make percent errors unstable. MW errors are directly interpretable.
- **No MWh, cost savings or procurement volumes.** These are unsupported by the available temporal semantics and absent demand, price and portfolio data.
- **Two temporal comparisons rather than a silent default.** This exposes uncertainty and sensitivity without pretending the choice is settled.

## Boundaries

The client can intentionally call retrospective endpoints, so hiding actuals is not a security feature. The app holds only historical public data and no personal state. It does not authenticate users, submit trades, persist decisions or call remote APIs during interaction.

Input handling:
- Request values are bounded to the challenge month, and rules are enumerated.
- Exports contain numeric and public timestamp data, not untrusted spreadsheet formulas.
- URL parameters are validated client-side before they reach the API, and again server-side.

## Next production steps, in order

1. **Agree semantics with the client.** Settle the temporal target meaning and whether recorded creation time is an adequate availability proxy. Document the covered fleet and an actual-revision policy, and investigate the persistent positive bias (forecast error, curtailment or fleet scope) with the client's analysts.
2. **Harden ingestion.** Use immutable, versioned snapshots with atomic promote and rollback, plus ingestion validation, retries and alerting. Track real received timestamps if decisions depend on availability.
3. **Calibrate any interval before showing it.** A decision-time uncertainty band needs a calibration window that strictly precedes each decision, such as a rolling prior 30–90 days, and validation on held-out months.
4. **Secure the deployment.** Add deployment-specific authentication, least privilege, HTTPS, logging, readiness checks and dependency scanning.
5. **Test at production level.** Run load/SLO tests, a supported browser matrix and an accessibility audit.
6. **Handle DST explicitly.** Support UK DST and settlement-period day lengths explicitly.

## Known implementation compromises

- **Locking.** Python direct dependencies are pinned, but transitive Python dependencies are not lockfile-frozen. Node's dependency graph is locked.
- **Snapshot refresh.** Refresh writes are not an atomic production transaction.
- **Fonts.** Loaded from Google Fonts with system fallbacks.
- **Bundle size.** The production JavaScript bundle is about 200 KB gzipped, mostly the chart library, and still triggers Vite's advisory size warning.
- **Visual review.** Charts carry text alternatives that point to the tables, but they are not keyboard-explorable.
