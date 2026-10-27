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
