"""Point-in-time selection. No interpolation or forward-filling of forecasts."""

from __future__ import annotations

import json
import math
import re
import statistics
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

ROOT = Path(__file__).resolve().parents[1]

Rule = Literal["hour_mean", "first_half"]
RULES: tuple[Rule, ...] = ("hour_mean", "first_half")
FIRST_DECISION, LAST_DECISION = date(2026, 1, 1), date(2026, 1, 31)
# Hourly decision times for the cutoff sensitivity sweep. Runs are usually published at :30,
# so on-the-hour cutoffs show the step each new run makes rather than hugging a schedule.
SWEEP_CUTOFFS = tuple(f"{h:02}:00" for h in range(24))
# Earlier runs shown beside the selected one. Enough to see drift without a spaghetti chart.
PRIOR_RUNS = 3
# Forecast-level bands (MW) for the "does the miss depend on the forecast?" view. Round
# numbers a buyer can read at a glance; each band reports its own n.
LEVEL_BANDS = ((0, 5000), (5000, 10000), (10000, 15000), (15000, None))
# Recent delivery days summarised in the decision view's track record.
TRACK_DAYS = 7


def timestamp(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        raise ValueError("Timezone is required")
    return dt.astimezone(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


def normalize(payload: Any) -> list[dict]:
    rows = payload if isinstance(payload, list) else payload["data"]
    out: dict[tuple, dict] = {}
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


def select_forecasts(rows: Iterable[dict], targets: list[str], cutoff: datetime) -> dict[str, dict]:
    """Latest eligible vintage independently for every target, inclusive boundary."""
    chosen: dict[str, dict] = {}
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


def latest_actuals(rows: Iterable[dict]) -> dict[str, dict]:
    chosen: dict[str, dict] = {}
    for r in rows:
        if r.get("fuelType") != "WIND":
            continue
        s = r["startTime"]
        if s not in chosen or timestamp(r["publishTime"]) > timestamp(chosen[s]["publishTime"]):
            chosen[s] = r
    return chosen


def metrics(points: Iterable[dict]) -> dict:
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


def quantile(values: list[float], q: float) -> float | None:
    """Linear interpolation between closest ranks (same as numpy's default)."""
    if not values:
        return None
    xs = sorted(values)
    pos = (len(xs) - 1) * q
    lo, hi = math.floor(pos), math.ceil(pos)
    return xs[lo] + (xs[hi] - xs[lo]) * (pos - lo)


def distribution(points: Iterable[dict]) -> dict:
    """Empirical spread of paired errors (forecast minus actual) for a retrospective period.

    Describes what happened in the sample; it is not a calibrated forecast interval.
    """
    errors = [p["error"] for p in points if p.get("error") is not None]
    return {
        "n": len(errors),
        "p10": quantile(errors, 0.1),
        "p50": quantile(errors, 0.5),
        "p90": quantile(errors, 0.9),
        "abs_p50": quantile([abs(e) for e in errors], 0.5),
        "abs_p90": quantile([abs(e) for e in errors], 0.9),
        "share_over": sum(e > 0 for e in errors) / len(errors) if errors else None,
    }


def by_level(points: list[dict]) -> list[dict]:
    """Paired errors grouped by the forecast's own level, which is known at decision time."""
    out = []
    for lo, hi in LEVEL_BANDS:
        band = [
            p
            for p in points
            if p.get("error") is not None
            and lo <= p["forecast"]
            and (hi is None or p["forecast"] < hi)
        ]
        d = distribution(band)
        out.append(
            {
                "from_mw": lo,
                "to_mw": hi,
                **metrics(band),
                "p90": d["p90"],
                "share_over": d["share_over"],
            }
        )
    return out


@dataclass(frozen=True)
class Scenario:
    decision: date
    gate: datetime
    delivery: datetime
    rule: Rule

    @property
    def targets(self) -> list[str]:
        return [iso(self.delivery + timedelta(hours=i)) for i in range(24)]


def parse_scenario(decision: str, cutoff: str, rule: str) -> Scenario:
    """Validation boundary for every scenario. Raises ValueError with a user-facing message."""
    try:
        d = date.fromisoformat(decision)
    except (TypeError, ValueError):
        raise ValueError("Decision date must be YYYY-MM-DD") from None
    if not FIRST_DECISION <= d <= LAST_DECISION:
        raise ValueError("Decision date must be in January 2026")
    if not re.fullmatch(r"\d{2}:\d{2}", cutoff):
        raise ValueError("Cutoff must be HH:MM")
    h, m = map(int, cutoff.split(":"))
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError("Cutoff must be HH:MM")
    if rule not in RULES:
        raise ValueError("Unknown comparison rule")
    gate = datetime(d.year, d.month, d.day, h, m, tzinfo=timezone.utc)
    # January is GMT throughout, so the next UK calendar day starts at UTC midnight.
    delivery = gate.replace(hour=0, minute=0) + timedelta(days=1)
    return Scenario(d, gate, delivery, rule)  # type: ignore[arg-type]


class Store:
    def __init__(self, wind: Any = None, actual: Any = None):
        self.wind = normalize(
            wind if wind is not None else json.loads((ROOT / "data/wind.json").read_text())
        )
        self.raw_actual = normalize(
            actual if actual is not None else json.loads((ROOT / "data/actual.json").read_text())
        )
        self.actual = latest_actuals(self.raw_actual)
        self.by_target: dict[str, list[dict]] = defaultdict(list)
        for r in self.wind:
            self.by_target[r["startTime"]].append(r)
        # The snapshot is immutable for the life of the process, so full-month sweeps are cached.
        self.analysis = lru_cache(maxsize=64)(self._analysis)
        self.cutoff_sweep = lru_cache(maxsize=4)(self._cutoff_sweep)

    def _actual_for(
        self, t: str, rule: Rule, available_by: datetime | None = None
    ) -> tuple[float | None, list[str]]:
        """Actual for an hourly target. With available_by, a half-hour published later counts as
        missing. The snapshot holds one version per half-hour, so an earlier, since-revised
        version cannot be recovered; excluding it is the conservative choice."""

        def get(start: str) -> dict | None:
            r = self.actual.get(start)
            if r and available_by and timestamp(r["publishTime"]) > available_by:
                return None
            return r

        a = get(t)
        if rule == "first_half":
            return (a["generation"] if a else None), [a["publishTime"]] if a else []
        b = get(iso(timestamp(t) + timedelta(minutes=30)))
        value = (a["generation"] + b["generation"]) / 2 if a and b else None
        return value, [r["publishTime"] for r in (a, b) if r]

    def _prior_runs(self, sc: Scenario, candidates: list[dict], selected_runs: set[str]) -> list:
        """Earlier eligible runs for the same delivery targets: what a buyer could already see."""
        by_run: dict[str, dict[str, float]] = defaultdict(dict)
        for r in candidates:
            if timestamp(r["publishTime"]) <= sc.gate:
                by_run[r["publishTime"]][r["startTime"]] = r["generation"]
        earlier = sorted((p for p in by_run if p not in selected_runs), reverse=True)
        newest = max(selected_runs, default=None)
        earlier = [p for p in earlier if newest is None or p < newest][:PRIOR_RUNS]
        return [
            {
                "publishTime": p,
                "targets": len(by_run[p]),
                "points": [by_run[p].get(t) for t in sc.targets],
            }
            for p in earlier
        ]

    def replay(
        self, decision: str, cutoff: str = "09:30", rule: str = "hour_mean", reveal: bool = False
    ):
        sc = parse_scenario(decision, cutoff, rule)
        targets = sc.targets
        candidates = [r for t in targets for r in self.by_target[t]]
        selected = select_forecasts(candidates, targets, sc.gate)
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
                "age_hours": (sc.gate - timestamp(f["publishTime"])).total_seconds() / 3600
                if f
                else None,
            }
            if reveal:
                value, published = self._actual_for(t, sc.rule)
                row.update(
                    actual=value,
                    actual_publishTimes=published,
                    error=f["generation"] - value if f and value is not None else None,
                )
            points.append(row)
        runs = sorted({r["publishTime"] for r in selected.values()})
        out = {
            "decision_date": sc.decision.isoformat(),
            "delivery_date": sc.delivery.date().isoformat(),
            "cutoff": iso(sc.gate),
            "timezone": "Europe/London (GMT in January)",
            "rule": sc.rule,
            "points": points,
            "coverage": {
                "forecast": len(selected),
                "expected": 24,
                "runs": runs,
                "fallback_intervals": sum(p["fallback"] for p in points),
            },
            "prior_runs": self._prior_runs(sc, candidates, set(runs)),
            # Publication times only (no values) of runs on the purchase day that cover this
            # delivery day. They drive the cutoff timeline: the selection can only change at
            # these moments. Times after the cutoff are schedule metadata, not forecasts.
            "day_runs": sorted(
                {
                    r["publishTime"]
                    for r in candidates
                    if r["publishTime"][:10] == sc.decision.isoformat()
                }
            ),
        }
        if reveal:
            out["metrics"] = metrics(points)
            out["coverage"]["actual"] = sum(p["actual"] is not None for p in points)
        return out

    def track_record(self, decision: str, cutoff: str = "09:30", rule: str = "hour_mean") -> dict:
        """How this cutoff's forecasts fared on recent delivery days, using only actuals whose
        publishTime is at or before this decision's cutoff. No hindsight: everything here was
        published before the decision."""
        sc = parse_scenario(decision, cutoff, rule)
        days, points = [], []
        d = sc.decision - timedelta(days=1)
        while d >= FIRST_DECISION and len(days) < TRACK_DAYS:
            past = self.replay(d.isoformat(), cutoff, rule)
            paired = []
            for p in past["points"]:
                value, _ = self._actual_for(p["time"], sc.rule, available_by=sc.gate)
                error = (
                    p["forecast"] - value
                    if p["forecast"] is not None and value is not None
                    else None
                )
                paired.append({**p, "actual": value, "error": error})
            # Only complete days: a half-reported day would bias the summary towards the night.
            if all(p["error"] is not None for p in paired):
                days.append(
                    {
                        "decision_date": past["decision_date"],
                        "delivery_date": past["delivery_date"],
                        **metrics(paired),
                    }
                )
                points += paired
            d -= timedelta(days=1)
        return {
            "available_by": iso(sc.gate),
            "window_days": TRACK_DAYS,
            "days": days,
            "metrics": metrics(points),
            "hourly_bias": [
                metrics([p for p in points if p["hour"] == f"{h:02}:00"])["bias"] for h in range(24)
            ],
        }

    def _month(self, cutoff: str, rule: str) -> list[dict]:
        return [
            self.replay(d.isoformat(), cutoff, rule, True)
            for d in (FIRST_DECISION + timedelta(days=i) for i in range(31))
        ]

    def _analysis(self, cutoff: str = "09:30", rule: str = "hour_mean") -> dict:
        parse_scenario(FIRST_DECISION.isoformat(), cutoff, rule)
        days = self._month(cutoff, rule)
        points = [p for d in days for p in d["points"]]
        other = "first_half" if rule == "hour_mean" else "hour_mean"
        alternate = [p for d in self._month(cutoff, other) for p in d["points"]]
        hourly = [
            {
                "hour": f"{h:02}:00",
                **metrics([p for p in points if p["hour"] == f"{h:02}:00"]),
            }
            for h in range(24)
        ]
        return {
            "metrics": metrics(points),
            "distribution": distribution(points),
            "expected": 744,
            "cutoff": cutoff,
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
            "track_record_check": self._track_record_check(cutoff, rule, days),
            "by_level": by_level(points),
            # Signed error per delivery day (rows) and target hour (columns); None when unpaired.
            "grid": [[p["error"] for p in d["points"]] for d in days],
        }

    def _track_record_check(self, cutoff: str, rule: str, days: list[dict]) -> dict:
        """Retrospective test of whether the decision-time track record was a useful guide.

        For each purchase day with a track record, compare it with how that day turned out,
        and backtest the naive adjustment "subtract the recent bias". Everything used for the
        adjustment was published before that day's cutoff, so the backtest has no look-ahead.
        """
        pairs, raw, adjusted = [], [], []
        for d in days:
            record = self.track_record(d["decision_date"], cutoff, rule)["metrics"]
            if not record["n"] or d["metrics"]["n"] == 0:
                continue
            pairs.append((record, d["metrics"]))
            for p in d["points"]:
                if p["error"] is not None:
                    raw.append(abs(p["error"]))
                    adjusted.append(abs(p["error"] - record["bias"]))

        def corr(key: str) -> float | None:
            if len(pairs) < 3:
                return None
            try:
                return statistics.correlation(
                    [r[key] for r, _ in pairs], [d[key] for _, d in pairs]
                )
            except statistics.StatisticsError:
                return None

        return {
            "days": len(pairs),
            "bias_correlation": corr("bias"),
            "mae_correlation": corr("mae"),
            "n": len(raw),
            "mae": sum(raw) / len(raw) if raw else None,
            "adjusted_mae": sum(adjusted) / len(adjusted) if adjusted else None,
        }

    def _cutoff_sweep(self, rule: str = "hour_mean") -> dict:
        """Month metrics if every decision had been taken at each hourly cutoff instead."""
        parse_scenario(FIRST_DECISION.isoformat(), "00:00", rule)
        rows = []
        for cutoff in SWEEP_CUTOFFS:
            days = self._month(cutoff, rule)
            points = [p for d in days for p in d["points"]]
            ages = [p["age_hours"] for p in points if p["age_hours"] is not None]
            rows.append(
                {
                    "cutoff": cutoff,
                    **metrics(points),
                    "forecast_coverage": sum(d["coverage"]["forecast"] for d in days),
                    "mean_age_hours": sum(ages) / len(ages) if ages else None,
                }
            )
        return {"rule": rule, "expected": 744, "cutoffs": rows}

    def metadata(self) -> dict:
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
