# Design record

## Goal

Make a historical purchasing decision auditable: what forecast value was eligible, which publication supplied it, what the retrospective comparison says, and which assumptions qualify it. A smooth chart is useful only if those facts survive inspection.

## Components

```
Bounded Elexon GETs -> raw JSON + manifest -> in-memory Store
                                                    |
                              FastAPI replay / analysis / export
                                                    |
                                      React + Recharts, one origin
```

Domain logic has no HTTP or React dependency. The store normalises timestamps to aware UTC, rejects invalid numeric values, resolves actual revisions, and indexes forecasts by target. Selection is inclusive and performed per target. API handlers translate invalid scenarios into 422. The decision response omits retrospective fields. Frontend requests use AbortController so a slow older scenario cannot overwrite a newer one.

A multistage image builds TypeScript and React, then copies only the assets and Python runtime into a non-root container. The dataset stays read-only. Raw responses and hashes permit independent reproduction without API access during review.

## Choices

- No database: the task is a fixed 34-day publication snapshot, not a live market-data service.
- No pandas: plain Python is sufficient for 20k observations and makes selection/fallback easy to audit without implicit index filling. React and Python are mandatory; pandas is not.
- One origin: fewer deployment moving parts, no cross-origin configuration and no duplicate API logic in the UI.
- No error band: a credible prior-known band needs a longer justified calibration window and semantics agreement. A band inferred from future January errors would leak information into the decision view.
- No MAPE: low wind values make percent errors unstable. MW errors are directly interpretable in this dataset.
- No MWh, cost savings or procurement volumes: unsupported by the available temporal semantics and absent demand, price and portfolio data.
- Two temporal comparisons rather than a silent default: expose uncertainty and sensitivity without pretending the choice is settled.

## Boundaries

The client intentionally can call retrospective endpoints, so hiding actuals is not a security feature. The app holds only historical public data and no personal state. It does not authenticate users, submit trades, persist decisions or call remote APIs during interaction. Request values are bounded to the challenge month, rules are enumerated, numeric inputs are checked, and generated exports contain numeric/public timestamp data rather than untrusted spreadsheet formulas.

## Next production steps, in order

1. Agree temporal target meaning and whether the recorded forecast creation time is an adequate availability proxy. Document the covered fleet and confirm an actual-revision policy.
2. Use immutable, versioned snapshots with atomic promote/rollback and ingestion validation, retries with server backoff and operational alerting. Track real received timestamps if decisions depend on availability.
3. Add deployment-specific authentication, least privilege, origin/host policy, HTTPS, logging, health/readiness checks and dependency scanning. Avoid storing personal or trading data without a defined need.
4. Add realistic load/SLO and end-to-end integration tests, a supported browser matrix and accessibility audit. Only add storage/caching/distribution when measured demand requires it.
5. Extend date handling explicitly for UK DST and settlement-period day lengths. The current fixed-month contract avoids pretending 24 target hours apply universally.

## Known implementation compromises

The UI is kept in one typed entry module for this pilot, with presentational components for metrics and methodology. Split screens/hooks into separate modules if it grows; do not split the small domain engine merely to increase file count. Python direct dependencies are pinned, but transitive Python dependencies are not lockfile-frozen. Node's dependency graph is locked. Refresh writes are not a production atomic transaction. A font is loaded from Google Fonts with local sans-serif fallbacks; numbers and controls remain usable offline, but the web font itself is not required to load. No browser analytics or telemetry is added.
