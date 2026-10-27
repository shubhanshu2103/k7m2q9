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


def test_quantile_and_distribution():
    from backend.engine import quantile, distribution

    assert quantile([], 0.5) is None
    assert quantile([3, 1, 2], 0.5) == 2
    assert quantile([0, 10], 0.9) == pytest.approx(9)
    d = distribution([{"error": e} for e in [-10, 0, 10, 20]] + [{"error": None}])
    assert d["n"] == 4 and d["share_over"] == 0.5 and d["abs_p90"] == pytest.approx(17)
    assert distribution([])["p90"] is None and distribution([])["share_over"] is None


def test_prior_runs_are_eligible_older_and_exclude_selected():
    rs = [
        row(p="2026-01-01T07:30:00Z", g=80),
        row(p="2026-01-01T04:30:00Z", g=60),
        row(p="2026-01-01T09:30:00Z", g=100),
        row(p="2026-01-01T09:31:00Z", g=999),  # after cutoff: must never appear
    ]
    out = Store(rs, []).replay("2026-01-01", "09:30")
    assert [r["publishTime"] for r in out["prior_runs"]] == [
        "2026-01-01T07:30:00Z",
        "2026-01-01T04:30:00Z",
    ]
    assert out["prior_runs"][0]["points"][0] == 80 and out["prior_runs"][0]["points"][1] is None
    assert out["points"][0]["forecast"] == 100


def test_snapshot_prior_runs_never_after_cutoff():
    s = Store()
    for cutoff in ["02:30", "09:30", "12:25", "23:59"]:
        for i in range(1, 32):
            out = s.replay(f"2026-01-{i:02}", cutoff)
            newest = max(out["coverage"]["runs"])
            assert all(r["publishTime"] < newest for r in out["prior_runs"])
            assert len(out["prior_runs"]) <= 3


def test_real_early_cutoff_leaves_late_targets_missing():
    out = Store().replay("2026-01-01", "02:29", reveal=True)
    missing = [p["hour"] for p in out["points"] if p["forecast"] is None]
    assert missing == ["22:00", "23:00"]
    assert out["coverage"]["forecast"] == 22 and out["metrics"]["n"] == 22
    assert out["points"][-1]["error"] is None and out["points"][-1]["actual"] is not None
    assert Store().replay("2026-01-01", "02:30")["coverage"]["forecast"] == 24


def test_cutoff_sweep_matches_analysis_and_reports_coverage():
    s = Store()
    sweep = {c["cutoff"]: c for c in s.cutoff_sweep("hour_mean")["cutoffs"]}
    assert len(sweep) == 24
    assert sweep["00:00"]["n"] == 682 and sweep["00:00"]["forecast_coverage"] == 682
    ten = s.analysis("10:00", "hour_mean")["metrics"]
    assert sweep["10:00"]["mae"] == ten["mae"] and sweep["10:00"]["n"] == 744


def test_default_month_baseline_is_unchanged():
    a = Store().analysis("09:30", "hour_mean")
    assert a["metrics"]["n"] == 744
    assert a["metrics"]["mae"] == pytest.approx(2013.008064516129, abs=1e-9)
    assert a["metrics"]["bias"] == pytest.approx(1729.9314516129032, abs=1e-9)
    assert a["metrics"]["rmse"] == pytest.approx(2505.943149370381, abs=1e-9)
    assert a["sensitivity"]["mae"] == pytest.approx(1995.57, abs=0.01)
    assert a["distribution"]["n"] == 744
    assert a["distribution"]["p10"] <= a["distribution"]["p50"] <= a["distribution"]["p90"]


def _day_fixture(late_start=None, late_publish="2026-01-03T09:31:00Z"):
    """Forecasts for delivery 2 Jan (published 1 Jan 09:00) and its 48 actual half-hours,
    each published 30 minutes after it starts, except optionally one published late."""
    from datetime import datetime, timedelta, timezone

    start = datetime(2026, 1, 2, tzinfo=timezone.utc)
    wind = [
        row(t=(start + timedelta(hours=h)).isoformat(), p="2026-01-01T09:00:00Z", g=100)
        for h in range(24)
    ]
    actual = []
    for i in range(48):
        t = start + timedelta(minutes=30 * i)
        published = (t + timedelta(minutes=30)).isoformat()
        if t.isoformat() == late_start:
            published = late_publish
        actual.append(row(t=t.isoformat(), p=published, g=40, fuel="WIND"))
    return Store(wind, actual)


def test_track_record_uses_only_complete_days_published_before_cutoff():
    record = _day_fixture().track_record("2026-01-03", "09:30")
    assert [d["delivery_date"] for d in record["days"]] == ["2026-01-02"]
    assert record["metrics"]["n"] == 24 and record["metrics"]["bias"] == 60
    assert record["hourly_bias"][0] == 60
    # Delivery 3 Jan is still under way at the cutoff, so it never enters the record.
    assert all(d["delivery_date"] < "2026-01-03" for d in record["days"])


def test_track_record_excludes_actual_published_after_cutoff():
    store = _day_fixture(late_start="2026-01-02T12:30:00+00:00")
    assert store.track_record("2026-01-03", "09:30")["days"] == []
    assert store.track_record("2026-01-03", "09:30")["metrics"]["mae"] is None
    # Inclusive boundary: published exactly at the cutoff counts.
    assert len(store.track_record("2026-01-03", "09:31")["days"]) == 1


def test_snapshot_track_record_is_point_in_time():
    s = Store()
    assert s.track_record("2026-01-02", "09:30")["days"] == []
    assert [d["delivery_date"] for d in s.track_record("2026-01-03", "09:30")["days"]] == [
        "2026-01-02"
    ]
    for decision in ["2026-01-15", "2026-01-31"]:
        record = s.track_record(decision, "09:30")
        gate = timestamp(record["available_by"])
        assert len(record["days"]) == 7
        for d in record["days"]:
            out = s.replay(d["decision_date"], "09:30", reveal=True)
            published = [timestamp(t) for p in out["points"] for t in p["actual_publishTimes"]]
            assert max(published) <= gate


def test_track_record_check_is_reported_with_sample_size():
    check = Store().analysis("09:30", "hour_mean")["track_record_check"]
    assert check["days"] == 29 and check["n"] == 696
    assert check["bias_correlation"] == pytest.approx(-0.3985, abs=1e-4)
    assert check["mae"] == pytest.approx(1969.13, abs=0.01)
    assert check["adjusted_mae"] == pytest.approx(1689.16, abs=0.01)
