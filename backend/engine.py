"""Point-in-time selection. No interpolation or forward-filling of forecasts."""

from collections import defaultdict, Counter
from datetime import datetime, timedelta, timezone, date
from pathlib import Path
import json, math, re

ROOT = Path(__file__).resolve().parents[1]


def timestamp(value):
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("Timezone is required")
    return dt.astimezone(timezone.utc)


def iso(dt):
    return dt.isoformat().replace("+00:00", "Z")


def normalize(payload):
    rows = payload if isinstance(payload, list) else payload["data"]
    out = {}
    for r in rows:
        p, s = timestamp(r["publishTime"]), timestamp(r["startTime"])
        g = r["generation"]
        if not isinstance(g, (int, float)) or not math.isfinite(g) or g < 0:
            raise ValueError("Invalid generation")
        key = (p, s, r.get("fuelType"))
        if key in out and out[key]["generation"] != g:
            raise ValueError(f"Conflicting duplicate {key}")
        out[key] = {**r, "publishTime": iso(p), "startTime": iso(s)}
    return list(out.values())


def select_forecasts(rows, targets, cutoff):
    """Latest eligible vintage independently for every target, inclusive boundary."""
    chosen = {}
    target_set = set(targets)
    for r in rows:
        p = timestamp(r["publishTime"])
        s = r["startTime"]
        if (
            s in target_set
            and p <= cutoff
            and (s not in chosen or p > timestamp(chosen[s]["publishTime"]))
        ):
            chosen[s] = r
    return chosen


def latest_actuals(rows):
    chosen = {}
    for r in rows:
        if r.get("fuelType") != "WIND":
            continue
        s = r["startTime"]
        if s not in chosen or timestamp(r["publishTime"]) > timestamp(chosen[s]["publishTime"]):
            chosen[s] = r
    return chosen


def metrics(points):
    errors = [p["error"] for p in points if p.get("error") is not None]
    if not errors:
        return {"n": 0, "mae": None, "bias": None, "rmse": None, "max_abs_error": None}
    return {
        "n": len(errors),
        "mae": sum(map(abs, errors)) / len(errors),
        "bias": sum(errors) / len(errors),
        "rmse": math.sqrt(sum(e * e for e in errors) / len(errors)),
        "max_abs_error": max(map(abs, errors)),
    }


class Store:
    def __init__(self, wind=None, actual=None):
        self.wind = normalize(
            wind if wind is not None else json.loads((ROOT / "data/wind.json").read_text())
        )
        self.raw_actual = normalize(
            actual if actual is not None else json.loads((ROOT / "data/actual.json").read_text())
        )
        self.actual = latest_actuals(self.raw_actual)
        self.by_target = defaultdict(list)
        for r in self.wind:
            self.by_target[r["startTime"]].append(r)

    def replay(self, decision, cutoff="09:30", rule="hour_mean", reveal=False):
        d = date.fromisoformat(decision)
        if not date(2026, 1, 1) <= d <= date(2026, 1, 31):
            raise ValueError("Decision date must be in January 2026")
        if not re.fullmatch(r"\d{2}:\d{2}", cutoff):
            raise ValueError("Cutoff must be HH:MM")
        h, m = map(int, cutoff.split(":"))
        if not (0 <= h <= 23 and 0 <= m <= 59) or len(cutoff) != 5:
            raise ValueError("Cutoff must be HH:MM")
        if rule not in ("hour_mean", "first_half"):
            raise ValueError("Unknown comparison rule")
        gate = datetime(d.year, d.month, d.day, h, m, tzinfo=timezone.utc)
        delivery = gate.replace(hour=0, minute=0) + timedelta(days=1)
        targets = [iso(delivery + timedelta(hours=i)) for i in range(24)]
        candidates = [r for t in targets for r in self.by_target[t]]
        selected = select_forecasts(candidates, targets, gate)
        newest = max((r["publishTime"] for r in selected.values()), default=None)
        points = []
        for t in targets:
            f = selected.get(t)
            row = {
                "time": t,
                "hour": t[11:16],
                "forecast": f["generation"] if f else None,
                "publishTime": f["publishTime"] if f else None,
                "fallback": bool(f and f["publishTime"] != newest),
                "age_hours": (gate - timestamp(f["publishTime"])).total_seconds() / 3600
                if f
                else None,
            }
            if reveal:
                a, b = (
                    self.actual.get(t),
                    self.actual.get(iso(timestamp(t) + timedelta(minutes=30))),
                )
                value = (
                    ((a["generation"] + b["generation"]) / 2 if a and b else None)
                    if rule == "hour_mean"
                    else (a["generation"] if a else None)
                )
                row.update(
                    actual=value,
                    actual_publishTimes=[
                        r["publishTime"] for r in ([a, b] if rule == "hour_mean" else [a]) if r
                    ],
                    error=f["generation"] - value if f and value is not None else None,
                )
            points.append(row)
        out = {
            "decision_date": decision,
            "delivery_date": delivery.date().isoformat(),
            "cutoff": iso(gate),
            "timezone": "Europe/London (GMT in January)",
            "rule": rule,
            "points": points,
            "coverage": {
                "forecast": len(selected),
                "expected": 24,
                "runs": sorted({r["publishTime"] for r in selected.values()}),
                "fallback_intervals": sum(p["fallback"] for p in points),
            },
        }
        if reveal:
            out["metrics"] = metrics(points)
            out["coverage"]["actual"] = sum(p["actual"] is not None for p in points)
        return out

    def analysis(self, cutoff="09:30", rule="hour_mean"):
        days = [self.replay(f"2026-01-{i:02}", cutoff, rule, True) for i in range(1, 32)]
        points = [p for d in days for p in d["points"]]
        other = "first_half" if rule == "hour_mean" else "hour_mean"
        alternate = [
            p
            for i in range(1, 32)
            for p in self.replay(f"2026-01-{i:02}", cutoff, other, True)["points"]
        ]
        hourly = [
            {
                "hour": f"{h:02}:00",
                **metrics([p for p in points if p["hour"] == f"{h:02}:00"]),
            }
            for h in range(24)
        ]
        return {
            "metrics": metrics(points),
            "expected": 744,
            "rule": rule,
            "sensitivity": {"alternate_rule": other, **metrics(alternate)},
            "days": [
                {
                    "decision_date": d["decision_date"],
                    "delivery_date": d["delivery_date"],
                    **d["metrics"],
                    **d["coverage"],
                }
                for d in days
            ],
            "hourly": hourly,
        }

    def metadata(self):
        per_day = defaultdict(list)
        for r in self.wind:
            per_day[r["publishTime"][:10]].append(r)
        actual_days = Counter(r["startTime"][:10] for r in self.raw_actual)
        return {
            "forecast_rows": len(self.wind),
            "forecast_runs": len({r["publishTime"] for r in self.wind}),
            "actual_rows": len(self.raw_actual),
            "actual_intervals": len(self.actual),
            "publish_days": [
                {
                    "date": d,
                    "rows": len(rs),
                    "runs": len({r["publishTime"] for r in rs}),
                }
                for d, rs in sorted(per_day.items())
            ],
            "actual_days": [{"date": d, "rows": n} for d, n in sorted(actual_days.items())],
            "manifest": json.loads((ROOT / "data/manifest.json").read_text()),
        }
