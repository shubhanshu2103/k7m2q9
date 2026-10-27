from fastapi.testclient import TestClient
from backend.app import app

client = TestClient(app)


def test_health():
    assert client.get("/api/health").json()["status"] == "ok"


def test_replay_schema():
    r = client.get("/api/replay")
    assert r.status_code == 200
    assert len(r.json()["points"]) == 24
    assert "actual" not in r.json()["points"][0]


def test_reveal_and_analysis():
    assert client.get("/api/replay?reveal=true").json()["metrics"]["n"] == 24
    assert client.get("/api/analysis").json()["metrics"]["n"] == 744


def test_validation():
    for query in ["decision=2026-02-01", "cutoff=99:99", "rule=foo"]:
        assert client.get("/api/replay?" + query).status_code == 422


def test_export_privacy_and_provenance():
    r = client.get("/api/export")
    assert r.status_code == 200
    header = r.text.splitlines()[0]
    assert "publishTime" in header and "cutoff" in header
    assert "actual" not in header and "error" not in header
    assert "actual" in client.get("/api/export?reveal=true").text.splitlines()[0]


def test_cutoff_rejects_noncanonical_or_non_numeric():
    for value in ["ab:cd", "+1:02", "1:002", "9:30"]:
        assert client.get("/api/replay", params={"cutoff": value}).status_code == 422


def test_cutoff_sweep_endpoint():
    r = client.get("/api/cutoff-sweep")
    assert r.status_code == 200 and len(r.json()["cutoffs"]) == 24
    assert client.get("/api/cutoff-sweep?rule=bogus").status_code == 422


def test_analysis_validates_inputs():
    assert client.get("/api/analysis?cutoff=25:00").status_code == 422
    assert client.get("/api/analysis?rule=bogus").status_code == 422


def test_malformed_decision_is_422_with_message():
    r = client.get("/api/replay?decision=not-a-date")
    assert r.status_code == 422 and "YYYY-MM-DD" in r.json()["detail"]


def test_export_filename_names_scenario_and_view():
    disposition = client.get("/api/export?cutoff=11:30").headers["content-disposition"]
    assert "wind-replay-2026-01-15-1130-decision.csv" in disposition
    disposition = client.get("/api/export?reveal=true").headers["content-disposition"]
    assert "retrospective" in disposition


def test_decision_export_never_contains_retrospective_values():
    body = client.get("/api/export?decision=2026-01-27").text
    assert len(body.splitlines()) == 25
    assert all(len(line.split(",")) == 10 for line in body.splitlines())


def test_decision_replay_carries_track_record_but_no_current_actuals():
    body = client.get("/api/replay?decision=2026-01-15").json()
    assert len(body["track_record"]["days"]) == 7
    assert "metrics" not in body
    assert all("actual" not in p and "error" not in p for p in body["points"])
    header = client.get("/api/export?decision=2026-01-15").text.splitlines()[0]
    assert "track" not in header and "actual" not in header
