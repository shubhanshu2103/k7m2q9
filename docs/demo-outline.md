# Demo script (not a video)

Target: about 9 minutes in total, each part under five minutes. Recording, upload and submission are still to do. Do not describe this script as a completed demo.

## Part 1: client pilot overview (about 4.5 minutes)

1. **Frame the question (20 s).** "Your team buys day-ahead. Wind decides how much else you need, but you only ever have the forecast available at the time you decide. This pilot replays exactly that for every January 2026 decision, and then measures how wrong those forecasts were."
2. **Decision view (60 s).** Open on 15 January at 09:30. Point to the green *Decision view* banner, then cover:
   - **What was available.** 24/24 targets, the 09:30 run, created 0 h before the cutoff, with lead times of 14.5–37.5 h.
   - **Whether it was moving.** The three earlier runs are dashed. The latest run raised the evening by up to about 650 MW.
   - **Track record.** Below the chart: at this cutoff, the past seven days' forecasts missed by about 2,300 MW on average and ran about 1.6 GW high. Every actual behind that was already published by 09:30.
   - **Use.** "This is what you could have acted on. No later run is ever used, and the export contains no actuals."
3. **Point-in-time precision (40 s).** Set the cutoff to 11:30. The run used stays at 09:30, because the usual 11:30 run was only recorded at 12:25. Set 12:25 and it appears. Then open the shared link `?decision=2026-01-01&cutoff=01:00`: at 01:00 the 22:00–23:00 targets have no forecast yet, and the app leaves them blank rather than guessing.
4. **Hindsight (50 s).** Click *Reveal actuals*. The banner turns amber. Show MAE 859 MW, bias +397 MW and the largest miss of +2,577 MW at 21:00. The error chart shows the evening over-forecast. Change the day: the app returns to the forecast-only view, so hindsight can't leak into the next decision.
5. **Accuracy lab (90 s).** At 09:30 across all 31 days:
   - **Headline.** MAE about 2,000 MW and bias +1,730 MW.
   - **Shortfall reading.** 84% of hours over-forecast, and in one hour in ten wind fell short of the forecast by more than about 4,100 MW. "That is the scale of error to keep in mind when deciding how much other generation you might need."
   - **Drill-through.** Click the worst day (delivery 28 January) to open its replay in hindsight.
   - **Cutoff sweep.** Waiting until midday lowers MAE by about 110 MW, but the bias barely moves.
   - **Track-record check.** We tested the track record before asking you to trust it. A bad week did not predict a bad next day, but the over-forecast was steady enough that simply subtracting it would have cut January's error by 14%. That is the first thing to investigate together.
6. **Close (20 s).** Reproducible decision context, quantified and honest error, and every assumption visible. Next step with the client: agree the cutoff and the temporal meaning, and investigate the bias together.

Say plainly: this is GB transmission-metered wind. It does not use demand or price data, so it does not recommend a purchase volume.

## Part 2: technical lead walkthrough (about 4.5 minutes)

1. **Map (40 s).** README file map: bounded raw snapshot and manifest, then the pure Python engine, then FastAPI, then the typed React screens, all on one origin.
2. **Core logic (70 s).** `backend/engine.py`:
   - **`parse_scenario`.** The single validation boundary, mapped to 422.
   - **`select_forecasts`.** Filters `publishTime <= cutoff`, then takes the max per target. Missing stays missing; fallback is flagged.
   - **`_prior_runs`.** Uses the same filter, so it cannot leak future data.
   - **`track_record`.** Gated by each actual's own `publishTime`. The test where an actual published one minute late is excluded is the one to show.
   - **`metrics` / `distribution`.** Paired points only, n always reported, null rather than zero.
3. **Tests (60 s).** Show the test kinds:
   - **Synthetic tests:** inclusive boundary, future exclusion, mixed vintage, missing half-hour, conflicting duplicates and prior runs.
   - **Real-snapshot tests:** the 12:25 late run, the early-cutoff gap and the pinned baseline metrics.
   - **Live run:** run `pytest` and show the browser suite: hindsight reset, drill-through with Back, a slow-request race, keyboard focus and 320px layout.
4. **Frontend structure (50 s).**
   - **`scenario.ts`.** URL validation and the hindsight-reset rule.
   - **`api.ts`.** Request results are bound to their path, superseded requests are aborted, and immutable responses are reused (metadata is fetched once).
   - **Screens.** Split by responsibility.
5. **Delivery and limits (50 s).**
   - **Delivery.** Docker multistage with a non-root, read-only runtime, and the CI workflow. Say which CI run passed and on which commit.
   - **Limits.** Unknown dissemination lag and within-hour semantics, the January/GMT-only date contract, the unexplained bias, and no calibrated band, by design.
   - **Disclosure.** AI assistance as described in the README.
