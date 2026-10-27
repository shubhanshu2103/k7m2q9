import sys, time, statistics
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.engine import Store

s = Store()
times = []
for _ in range(10):
    start = time.perf_counter()
    s.analysis()
    times.append((time.perf_counter() - start) * 1000)
print(
    f"Full-month analysis, 10 local runs: median {statistics.median(times):.1f}ms, max {max(times):.1f}ms. Microbenchmark only, not a production load test."
)
