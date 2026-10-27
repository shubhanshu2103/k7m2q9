"""Independent deliberately simple cross-check of the default month's metrics."""

import json, math
from pathlib import Path
from datetime import datetime, timedelta

root = Path(__file__).resolve().parents[1]
wind = json.loads((root / "data/wind.json").read_text())
actual = json.loads((root / "data/actual.json").read_text())
a = {r["startTime"]: r["generation"] for r in sorted(actual, key=lambda x: x["publishTime"])}
errors = []
for day in range(1, 32):
    cutoff = f"2026-01-{day:02}T09:30:00Z"
    delivery = datetime(2026, 1, day) + timedelta(days=1)
    for h in range(24):
        t = delivery + timedelta(hours=h)
        key = t.strftime("%Y-%m-%dT%H:%M:%SZ")
        rows = [r for r in wind if r["startTime"] == key and r["publishTime"] <= cutoff]
        f = max(rows, key=lambda r: r["publishTime"])["generation"]
        av = (a[key] + a[(t + timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ")]) / 2
        errors.append(f - av)
print(
    json.dumps(
        {
            "n": len(errors),
            "mae": sum(abs(e) for e in errors) / len(errors),
            "bias": sum(errors) / len(errors),
            "rmse": math.sqrt(sum(e * e for e in errors) / len(errors)),
        },
        indent=2,
    )
)
