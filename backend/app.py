import csv, io
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from .engine import Store, ROOT

app = FastAPI(title="Wind replay", version="1.0.0")
store = Store()


def evaluate(fn, *args):
    try:
        return fn(*args)
    except (ValueError, KeyError) as e:
        raise HTTPException(422, str(e)) from e


@app.get("/api/health")
def health():
    return {"status": "ok", "snapshot": "January 2026"}


@app.get("/api/meta")
def meta():
    return store.metadata()


@app.get("/api/replay")
def replay(
    decision: str = "2026-01-15",
    cutoff: str = "09:30",
    rule: str = "hour_mean",
    reveal: bool = False,
):
    return evaluate(store.replay, decision, cutoff, rule, reveal)


@app.get("/api/analysis")
def analysis(cutoff: str = "09:30", rule: str = "hour_mean"):
    return evaluate(store.analysis, cutoff, rule)


@app.get("/api/export")
def export(
    decision: str = "2026-01-15",
    cutoff: str = "09:30",
    rule: str = "hour_mean",
    reveal: bool = False,
):
    data = evaluate(store.replay, decision, cutoff, rule, reveal)
    output = io.StringIO()
    fields = [
        "decision_date",
        "delivery_date",
        "cutoff",
        "rule",
        "time",
        "hour",
        "forecast",
        "publishTime",
        "age_hours",
        "fallback",
    ]
    if reveal:
        fields += ["actual", "error", "actual_publishTimes"]
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    for p in data["points"]:
        writer.writerow(
            {
                **{k: data[k] for k in ["decision_date", "delivery_date", "cutoff", "rule"]},
                **p,
            }
        )
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="wind-replay.csv"'},
    )


if (ROOT / "dist").exists():
    app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="frontend")
