from backend.engine import (
    Store,
    normalize,
    timestamp,
    select_forecasts,
    latest_actuals,
    metrics,
)
import pytest


def row(t="2026-01-02T00:00:00Z", p="2026-01-01T09:30:00Z", g=100, fuel=None):
    out = {"startTime": t, "publishTime": p, "generation": g}
    if fuel:
        out["fuelType"] = fuel
    return out


def test_inclusive_boundary_and_future_exclusion():
    t = "2026-01-02T00:00:00Z"
    rs = [row(g=10), row(p="2026-01-01T09:30:01Z", g=999)]
    assert select_forecasts(rs, [t], timestamp("2026-01-01T09:30:00Z"))[t]["generation"] == 10


def test_mixed_vintage_fallback_and_gap():
    rs = [row(), row(t="2026-01-02T01:00:00Z", p="2026-01-01T07:30:00Z", g=50)]
    s = Store(rs, []).replay("2026-01-01")
    assert s["coverage"] == {
        "forecast": 2,
        "expected": 24,
        "runs": ["2026-01-01T07:30:00Z", "2026-01-01T09:30:00Z"],
        "fallback_intervals": 1,
    }
    assert s["points"][2]["forecast"] is None
    assert s["points"][1]["fallback"] is True


def test_no_eligible_forecast():
    s = Store([row()], []).replay("2026-01-01", "00:00", reveal=True)
    assert s["coverage"]["forecast"] == 0
    assert s["metrics"]["n"] == 0 and s["metrics"]["mae"] is None


def test_actual_revision_and_fuel_filter():
    rs = [
        row(p="2026-01-03T00:00:00Z", g=20, fuel="WIND"),
        row(p="2026-01-04T00:00:00Z", g=40, fuel="WIND"),
        row(p="2026-01-05T00:00:00Z", g=999, fuel="GAS"),
    ]
    assert latest_actuals(rs)["2026-01-02T00:00:00Z"]["generation"] == 40


def test_mapping_and_missing_half_hour():
    a = [row(g=20, fuel="WIND"), row(t="2026-01-02T00:30:00Z", g=40, fuel="WIND")]
    s = Store([row(g=100)], a)
    x = s.replay("2026-01-01", rule="hour_mean", reveal=True)["points"][0]
    assert x["actual"] == 30 and x["error"] == 70
    assert s.replay("2026-01-01", rule="first_half", reveal=True)["points"][0]["actual"] == 20
    assert Store([row()], a[:1]).replay("2026-01-01", reveal=True)["points"][0]["actual"] is None


def test_decision_response_has_no_hindsight():
    out = Store([row()], [row(fuel="WIND")]).replay("2026-01-01")
    assert "metrics" not in out
    assert all(not ({"actual", "actual_publishTimes", "error"} & p.keys()) for p in out["points"])


def test_normalization():
    assert len(normalize({"data": [row(), row()]})) == 1
    with pytest.raises(ValueError):
        normalize([row(), row(g=999)])
    with pytest.raises(ValueError):
        normalize([row(g=float("nan"))])
    with pytest.raises(ValueError):
        timestamp("2026-01-01T00:00:00")
    assert timestamp("2026-01-01T10:30:00+01:00") == timestamp("2026-01-01T09:30:00Z")


def test_metrics_are_paired_and_signed():
    m = metrics([{"error": -3}, {"error": 4}, {"error": None}])
    assert m["n"] == 2 and m["mae"] == 3.5 and m["bias"] == 0.5
    assert m["rmse"] == pytest.approx((25 / 2) ** 0.5)


@pytest.mark.parametrize(
    "decision,cutoff,rule",
    [
        ("2026-02-01", "09:30", "hour_mean"),
        ("2026-01-01", "24:00", "hour_mean"),
        ("2026-01-01", "09:30", "bogus"),
    ],
)
def test_invalid_scenarios(decision, cutoff, rule):
    with pytest.raises(ValueError):
        Store([], []).replay(decision, cutoff, rule)


@pytest.mark.parametrize("cutoff", ["07:30", "09:20", "09:30", "11:30", "15:30", "22:30", "23:59"])
def test_snapshot_coverage_all_delivery_days(cutoff):
    s = Store()
    for i in range(1, 32):
        out = s.replay(f"2026-01-{i:02}", cutoff, reveal=True)
        assert out["coverage"]["forecast"] == 24
        assert out["coverage"]["actual"] == 24
        assert out["coverage"]["fallback_intervals"] == 0
        assert all(timestamp(p["publishTime"]) <= timestamp(out["cutoff"]) for p in out["points"])


def test_late_real_run():
    s = Store()
    assert s.replay("2026-01-15", "11:30")["coverage"]["runs"] == ["2026-01-15T09:30:00Z"]
    assert s.replay("2026-01-15", "12:25")["coverage"]["runs"] == ["2026-01-15T12:25:00Z"]


def test_snapshot_counts_and_integrity():
    import hashlib
    from pathlib import Path

    s = Store()
    m = s.metadata()
    assert m["forecast_rows"] == 19856 and m["forecast_runs"] == 272
    assert m["actual_intervals"] == 1488
    assert all(d["rows"] == 584 and d["runs"] == 8 for d in m["publish_days"])
    assert all(d["rows"] == 48 for d in m["actual_days"])
    for name, src in m["manifest"]["sources"].items():
        assert hashlib.sha256(Path(f"data/{name}.json").read_bytes()).hexdigest() == src["sha256"]
