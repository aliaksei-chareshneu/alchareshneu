from pathlib import Path
import datetime, os, subprocess, sys, time

ROOT = Path.home() / "MoravianHost" / "MediaMachine" / "ShortFactory"
PY = Path.home() / "miniconda3" / "python.exe"
LOGS = ROOT / "logs"
LOGS.mkdir(parents=True, exist_ok=True)
LOG = LOGS / ("trends-" + datetime.date.today().isoformat() + ".log")

def log(msg):
    with LOG.open("a", encoding="utf-8") as f:
        f.write(msg.rstrip() + "\n")

def run(label, args, retries=1, retry_delay=10):
    last = None
    for attempt in range(1, retries + 1):
        log(f"{datetime.datetime.now().astimezone().isoformat()} {label} attempt={attempt}")
        try:
            p = subprocess.run(
                [str(PY)] + args,
                cwd=str(ROOT),
                capture_output=True,
                text=True,
                timeout=240
            )
            if p.stdout:
                log(p.stdout)
            if p.stderr:
                log("STDERR\n" + p.stderr)
            if p.returncode == 0:
                log(f"{label} OK")
                return
            last = f"exit={p.returncode}"
        except Exception as e:
            last = repr(e)
            log(f"{label} ERROR {last}")
        if attempt < retries:
            time.sleep(retry_delay)
    raise RuntimeError(f"{label} failed after {retries} attempts: {last}")

def main():
    log("=" * 72)
    log("START " + datetime.datetime.now().astimezone().isoformat())
    snapshot = ROOT / "trend_candidates.auto.csv"
    try:
        run("trend_discover", ["trend_discover.py", "--limit", "180"], retries=2, retry_delay=20)
    except Exception as e:
        if not snapshot.exists() or snapshot.stat().st_size < 100:
            raise
        age_hours = (datetime.datetime.now().timestamp() - snapshot.stat().st_mtime) / 3600.0
        log(f"trend_discover DEGRADED_FALLBACK reason={e!r} snapshot_age_hours={age_hours:.2f}")
    # YouTube metadata is optional. Failures never block the existing Wikipedia scorer.
    # Key must be set privately in the scheduler environment; never commit it.
    if os.environ.get("YOUTUBE_API_KEY"):
        try:
            run("youtube_metadata", ["youtube_trend_intake.py", "--merge", str(snapshot)],
                retries=1)
        except Exception as e:
            log(f"youtube_metadata DEGRADED ({type(e).__name__}); Wikipedia candidates preserved")
    else:
        log("youtube_metadata SKIPPED_NO_API_KEY")
    run("feedback", ["distribution_bridge.py", "feedback"], retries=1)
    run("trend_score", ["trend_score.py", "trend_candidates.auto.csv", "--top", "50"], retries=1)
    log("END " + datetime.datetime.now().astimezone().isoformat())

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log("FATAL " + repr(e))
        print(e, file=sys.stderr)
        sys.exit(1)