"""Smoke-check a running deployment against the documented behaviour.

Usage: python scripts/check_deploy.py https://your-app.example
Standard library only, so it runs anywhere Python 3.10+ does.
"""

import json
import math
import re
import sys
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
failures = []


def get(path):
    with urllib.request.urlopen(BASE + path, timeout=60) as r:
        return r.status, r.headers.get("content-type", ""), r.read().decode()


def check(name, ok, detail=""):
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
    if not ok:
        failures.append(name)


status, ctype, html = get("/")
check("frontend page is served", status == 200 and '<div id="root">' in html, ctype)
scripts = re.findall(r'src="(/assets/[^"]+\.js)"', html)
check("frontend bundle is referenced", bool(scripts))
for src in scripts:
    check(f"bundle {src} loads", get(src)[0] == 200)

check("health", json.loads(get("/api/health")[2]).get("status") == "ok")

meta = json.loads(get("/api/meta")[2])
check("snapshot rows", meta["forecast_rows"] == 19856 and meta["actual_intervals"] == 1488)

decision = json.loads(get("/api/replay?decision=2026-01-15&cutoff=09:30")[2])
check("decision view has 24 targets", len(decision["points"]) == 24)
check(
    "decision view has no hindsight fields",
    "metrics" not in decision
    and all(not {"actual", "error"} & p.keys() for p in decision["points"]),
)
check("track record covers 7 days", len(decision["track_record"]["days"]) == 7)

late = json.loads(get("/api/replay?decision=2026-01-15&cutoff=11:30")[2])
check("11:30 cutoff uses the 09:30 run", late["coverage"]["runs"] == ["2026-01-15T09:30:00Z"])
late = json.loads(get("/api/replay?decision=2026-01-15&cutoff=12:25")[2])
check("12:25 cutoff includes the delayed run", late["coverage"]["runs"] == ["2026-01-15T12:25:00Z"])

gap = json.loads(get("/api/replay?decision=2026-01-01&cutoff=01:00")[2])
check("01:00 cutoff leaves 22:00 and 23:00 blank", gap["coverage"]["forecast"] == 22)

analysis = json.loads(get("/api/analysis?cutoff=09:30&rule=hour_mean")[2])
m = analysis["metrics"]
check(
    "baseline month metrics",
    m["n"] == 744
    and math.isclose(m["mae"], 2013.008064516129, abs_tol=1e-6)
    and math.isclose(m["bias"], 1729.9314516129032, abs_tol=1e-6),
    json.dumps(m),
)

header = get("/api/export?decision=2026-01-15")[2].splitlines()[0]
check("decision export has no actuals", "actual" not in header and "error" not in header)

try:
    urllib.request.urlopen(BASE + "/api/replay?decision=2026-02-01", timeout=60)
    check("invalid date is rejected", False, "expected 422")
except urllib.error.HTTPError as e:
    check("invalid date is rejected", e.code == 422, str(e.code))

print(f"\n{len(failures)} failure(s) against {BASE}")
sys.exit(1 if failures else 0)
