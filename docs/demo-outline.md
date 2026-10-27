# Demo script (not a video)

A recordable script for the two-part video: each part at most 5 minutes, 10 minutes in total. Recording, upload and submission are still to do; do not describe this file as a completed demo.

Spoken lines are in quotes: about 530 words in Part 1 (about 3.8 minutes at a calm 140 words per minute) and about 390 in Part 2 (about 2.8 minutes, leaving time to show code and run the tests). Times are targets, not limits; cut the *optional* lines if a part runs long.

## Before recording

- **Server.** Run the app (`docker compose up --build`, or the non-Docker steps in the README), or use the deployed URL once it exists. Browser at 1440 px wide, zoom 100%, no extensions visible.
- **Tabs, opened in this order** (replace the host if deployed):
  1. `/?view=replay&decision=2026-01-15&cutoff=09:30&rule=hour_mean&reveal=0`
  2. `/?view=replay&decision=2026-01-01&cutoff=01:00&rule=hour_mean&reveal=0`
  3. `/?view=analysis&cutoff=09:30&rule=hour_mean`
  4. For Part 2: the GitHub repository page, the latest green Actions run, and an editor open at `backend/engine.py`.
- **Terminal** ready in the repo with the virtual environment active, for `python -m pytest -q`. It takes about 10 s.
- **Rehearse once with a timer.** If a part runs long, cut the optional lines first.

## Numbers cheat-sheet (09:30 cutoff, hourly-mean comparison)

| Where | Number |
|---|---|
| 15 Jan decision | 24/24 targets, 09:30 run, lead time 14.5–37.5 h, three earlier runs, largest change vs previous run +647 MW at 23:00 |
| 15 Jan track record | last 7 days: MAE 2,293 MW, bias +1,633 MW |
| 15 Jan late run | 11:30 cutoff still uses 09:30; the 11:30 run was published at 12:25 |
| 1 Jan at 01:00 | 22/24: 22:00 and 23:00 have no eligible forecast |
| 15 Jan hindsight | MAE 859 MW, bias +397 MW, largest miss +2,577 MW at 21:00 |
| January | MAE 2,013 MW, bias +1,730 MW, 84% of hours over-forecast, 1 hour in 10 short by more than 4,144 MW |
| By level | ≥15 GW: bias +2,753 MW, 98% over-forecast; <5 GW: +136 MW |
| Worst day | delivery 28 Jan: MAE = bias = 5,375 MW, every hour over-forecast by more than 4,100 MW |
| Worst 5 days | 36% of all absolute error |
| Cutoff sweep | MAE 2,013 → 1,901 MW by 12:00; bias stays about +1.7 GW |
| Backtest | r = −0.40 (bias), naive bias subtraction −14% MAE (1,969 → 1,689 MW) |

## Part 1: client pilot (target 4:45)

**0:00 – Problem (25 s).** Tab 1.

> "Your team buys power a day ahead. Wind is the biggest unknown: the more wind there is, the less you need from other plants. But when you buy, all you have is the forecast published by then. This pilot replays every January 2026 purchase decision exactly as it looked at the time, and then measures how wrong those forecasts turned out to be."

**0:25 – What was known (60 s).** Point at the green banner, then the stats, then the chart.

> "This is the 15th of January at 09:30. The green banner says we are in the decision view: only forecasts that existed at 09:30. For tomorrow's 24 hours we have every value, from the 09:30 run, between 14 and 37 hours ahead."

> "The dashed lines are the three earlier runs that morning. The latest one raised the late evening by up to about 650 megawatts, so the outlook was still moving."

Scroll to the track record panel.

> "And this is how forecasts at this same time of day fared over the last week: about 2,300 megawatts off on average, and consistently too high. Every actual behind that number was already published before 09:30. Nothing here is hindsight."

**1:25 – Point-in-time precision (40 s).** Change the cutoff to 11:30, then to 12:25.

> "Precision matters. Move the decision to 11:30: we still use the 09:30 run, because that day the usual 11:30 run was only published at 12:25. At 12:25 it appears."

Switch to Tab 2.

> "And if you decided at 1 a.m. on New Year's Day, the last two hours of tomorrow had no forecast yet. We leave them blank instead of guessing."

**2:05 – Reveal what happened (35 s).** Back to Tab 1 and set the cutoff to 09:30. Click *Reveal actuals*.

> "Now we look back. The banner turns amber: this is hindsight. Tomorrow's forecast was off by about 860 megawatts on average, and at 9 p.m. it was 2,600 too high: less wind arrived than promised."

Click the next-day arrow.

> "Change the day, and it returns to the decision view, so hindsight never leaks into the next decision."

**2:40 – The month (85 s).** Tab 3.

> "Across all 31 January decisions, here is what the pilot found."

Read the four findings, pointing at each.

> "One: the forecast ran high, by 1.7 gigawatts on average; 84% of hours were over-forecast. In one hour in ten, wind came in more than 4 gigawatts below the forecast. That is the size of gap other generation may have had to cover."

> "Two: the windier the forecast, the bigger the overstatement. Above 15 gigawatts it was too high 98% of the time. So when the forecast is very windy, that is when to be most careful."

Click *Worst days*, then the top *Replay* button.

> "Three: a few days dominate. The five worst carried over a third of all error. One click opens any of them: on the 28th, every single hour was over-forecast by more than 4 gigawatts."

Press Back. *Optional:* scroll to the cutoff chart: "Deciding later helps only a little: about 110 megawatts by midday."

> "Four: we tested whether a bad recent week predicts a bad next day. It didn't. But the over-forecast was steady enough that simply subtracting it would have cut January's error by 14%. That's one month, so it's a lead to investigate, not a fix to apply."

**4:05 – Boundaries and next step (35 s).**

> "To be clear about scope: this is GB transmission-metered wind from Elexon, one month, and it uses no demand or price data. It shows how much wind you could rely on, not how much to buy."

> "The next step together: agree your real decision time, and find out why the forecast runs high. Curtailment and differences between the two datasets' wind fleets are the likely suspects, and understanding that is the most valuable thing this pilot points to."

**4:40 – End of Part 1.**

## Part 2: technical lead review (target 4:45)

**0:00 – Shape (40 s).** README file map.

> "Architecture in one line: a bounded, hashed Elexon snapshot, a pure Python engine, a FastAPI layer, and a typed React app, served from one origin and packaged with Docker. No database: it is 20,000 rows, held in memory and indexed by target time. Requests never call Elexon."

**0:40 – The core rule (75 s).** `backend/engine.py`: `parse_scenario`, then `select_forecasts`, then `_actual_for` and `track_record`.

> "One validation boundary, `parse_scenario`, turns bad input into a 422 with a readable message; anything else stays a 500, so bugs never pose as user errors."

> "The rule that matters is `select_forecasts`: for each target hour, the latest forecast published at or before the cutoff. Per target, inclusive, never a later run, never interpolated. Missing stays missing, and an older run filling a gap is flagged."

> "The decision view adds two things, both built under the same rule. Earlier runs use the same publish-time filter. The track record pairs past days with actuals only if each actual's own publish time is before the cutoff."

**1:55 – Proof (70 s).** `tests/test_engine.py`, then the terminal.

> "The tests encode those rules. Synthetic data proves the inclusive boundary, future exclusion and mixed-vintage fallback, which the real data never exercises. This test publishes one actual a minute after the cutoff and checks it is excluded. Real-snapshot tests pin the late 12:25 run, the early-morning coverage gap and the baseline month numbers, and an independent script recomputes those numbers from the raw JSON."

Run `python -m pytest -q`.

> "Forty-four Python tests. Fourteen browser tests cover hindsight resetting, drill-through and Back, a slow request that must not overwrite a newer one, keyboard focus, and the 320-pixel layout."

**3:05 – Frontend (40 s).** `frontend/scenario.ts`, then `frontend/api.ts`.

> "The frontend is split by responsibility. `scenario.ts` holds the URL state and the rule that a new day or cutoff resets hindsight. `api.ts` binds every result to the exact request that produced it, aborts stale requests and reuses immutable responses. The screens are just presentation."

**3:45 – Practices and limits (55 s).** The green Actions run.

> "CI runs lint and formatting, a locked dependency set, the tests, the audit, the browser suite and a Docker build with a health check, on every push."

> "Known limits, stated in the app: publish time is a proxy for availability; the forecast's within-hour meaning is unconfirmed, so two comparison rules are exposed; dates are January only, because daylight-saving days don't have 24 hours; and there is no uncertainty band, because a fair one needs earlier months to calibrate."

> "AI assistance was used and is disclosed in the README. Everything you've seen is tested and documented in the repo."

**4:40 – End of Part 2.**
