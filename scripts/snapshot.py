"""Explicit refresh only. No third-party calls from the running application."""

import hashlib
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPECS = {
    "wind": (
        "https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream",
        {
            "publishDateTimeFrom": "2025-12-29T00:00:00Z",
            "publishDateTimeTo": "2026-02-01T00:00:00Z",
        },
    ),
    "actual": (
        "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream",
        {
            "settlementDateFrom": "2026-01-02",
            "settlementDateTo": "2026-02-01",
            "fuelType": "WIND",
        },
    ),
}


def main():
    manifest = {"retrieved_at": datetime.now(timezone.utc).isoformat(), "sources": {}}
    payloads = {}
    for name, (url, params) in SPECS.items():
        full = url + "?" + urllib.parse.urlencode({**params, "format": "json"})
        with urllib.request.urlopen(full, timeout=90) as response:
            raw = response.read()
        data = json.loads(raw)
        if not isinstance(data, list) or not data:
            raise ValueError("Unexpected response")
        payloads[name] = raw
        manifest["sources"][name] = {
            "url": full,
            "rows": len(data),
            "sha256": hashlib.sha256(raw).hexdigest(),
        }
    for name, raw in payloads.items():
        (ROOT / f"data/{name}.json").write_bytes(raw)
    (ROOT / "data/manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")


if __name__ == "__main__":
    main()
