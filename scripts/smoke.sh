#!/bin/sh
set -eu
python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 &
server=$!
trap 'kill "$server" 2>/dev/null || true; wait "$server" 2>/dev/null || true' EXIT
python - <<'PY'
import time, urllib.request, json
for _ in range(100):
    try:
        health=json.load(urllib.request.urlopen('http://127.0.0.1:8000/api/health'))
        break
    except OSError:time.sleep(.1)
else:raise RuntimeError('Server failed to start')
assert health['status']=='ok'
assert '<div id="root">' in urllib.request.urlopen('http://127.0.0.1:8000').read().decode()
r=json.load(urllib.request.urlopen('http://127.0.0.1:8000/api/replay'))
assert len(r['points'])==24 and 'actual' not in r['points'][0]
print('One-origin smoke passed')
PY
