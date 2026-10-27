import sys, time, statistics
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.engine import Store

s = Store()


def bench(label, fn, runs):
    times = []
    for _ in range(runs):
        start = time.perf_counter()
        fn()
        times.append((time.perf_counter() - start) * 1000)
    print(f"{label}, {runs} uncached local runs: median {statistics.median(times):.1f}ms, max {max(times):.1f}ms")


# The private methods bypass the per-process cache so the computation itself is timed.
bench("Full-month analysis", lambda: s._analysis("09:30", "hour_mean"), 10)
bench("24-cutoff sweep", lambda: s._cutoff_sweep("hour_mean"), 3)
print("Microbenchmark only, not a production load test.")
