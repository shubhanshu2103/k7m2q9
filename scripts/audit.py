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
result = {
    "n": len(errors),
    "mae": sum(abs(e) for e in errors) / len(errors),
    "bias": sum(errors) / len(errors),
    "rmse": math.sqrt(sum(e * e for e in errors) / len(errors)),
}
print(json.dumps(result, indent=2))
# Documented baseline (README). Fails loudly if the snapshot or the method drifts.
expected = {"n": 744, "mae": 2013.008064516129, "bias": 1729.9314516129032, "rmse": 2505.943149370381}
assert result["n"] == expected["n"]
assert all(math.isclose(result[k], expected[k], rel_tol=0, abs_tol=1e-9) for k in ["mae", "bias", "rmse"])
print("Audit matches the documented baseline.")
