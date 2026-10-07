"""Runs every test, prints PASS/FAIL per file. `--fast` skips the slow stress test."""
import subprocess, sys, time
from pathlib import Path
here = Path(__file__).resolve().parent
tests = ["test_containment.py", "test_roulette.py", "test_rig.py", "test_bear.py"] + ([] if "--fast" in sys.argv else ["test_stress.py"])
results = []
for t in tests:
    print(f"\n=== {t}", flush=True); t0 = time.time()
    rc = subprocess.run([sys.executable, str(here / t)], cwd=here).returncode
    results.append((t, rc == 0, time.time() - t0))
print("\n=== summary")
for t, ok, s in results: print(f"  {'PASS' if ok else 'FAIL'}  {t}  ({s:.0f} s)")
sys.exit(0 if all(ok for _, ok, _ in results) else 1)
