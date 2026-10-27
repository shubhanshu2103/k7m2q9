# Demo guide (not a video)

Target total: 8–9 minutes. Each part must remain under five minutes. Recording and upload are deferred. Do not describe this guide as a completed demo.

## Part 1: customer overview, about 4 minutes

1. Start on Decision replay: “The question is what the team could have seen when it made a January purchase decision, not which forecast looks best now.” Show assumed cutoff and next-day delivery date.
2. Show the forecast-only chart, coverage and publication provenance. Explain that purchase volumes cannot be inferred without demand and portfolio data.
3. Set decision day to 15 January and cutoff to 11:30. Show that delivery 16 January uses the 09:30 publication because the next recorded run arrived at 12:25. Move to 12:25 to show the inclusive boundary.
4. Reveal actuals, explain signed bias and MAE in MW. Explain transmission-wind scope and provisional temporal comparison in plain words.
5. Open Accuracy lab. Show full-month errors, variation by delivery day and hour, and the sensitivity comparison. State that similar metrics do not establish correct temporal meaning.
6. Export a view and show source hashes/data method. Close on the value: reproducible decision context, visible uncertainty, and no hidden future forecast versions.

## Part 2: technical review, about 4 minutes

1. Show file map and architecture: bounded raw snapshot -> normalised Python store -> one-origin API -> typed React.
2. Walk through select_forecasts: filter target and publishTime <= cutoff, then max publishTime independently for each target. Missing targets remain missing. Explain why multiple vintages must be allowed despite uniform real coverage.
3. Show synthetic fallback, inclusive boundary and future-leakage tests, actual revisions and missing half-hour behavior. Run pytest and show browser tests. Do not claim Docker was tested until its build and run pass.
4. Explain separation of decision and retrospective response shape, paired metrics and CSV provenance.
5. Show manifest, snapshot acquisition and hashes. Discuss January GMT restriction, unknown dissemination lag and temporal meaning, and production extension path.
6. Mention AI assistance and the deliberately lean design. Close with deployment/publication tasks still outstanding until authorized and completed.
