"""Fail-safe tests for the availability engine (Python reference implementation).

python v2/tools/test_availability.py   → exit 1 on any failure

Fixtures in v2/tests/fixtures are invented test data (example.invalid), never real bookings.
The same scenarios are run against the PHP engine on the server with
    php api/availability-sync.php --selftest
"""
import json
import sys as _sys
_sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import availability_engine as E  # noqa: E402

FIX = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
CONFIG = json.loads((Path(__file__).resolve().parents[2] / "config" / "site-config.json").read_text(encoding="utf-8"))
S = CONFIG["availability"]
SEASON = {"start": "2027-05-01", "end": "2027-10-31"}
NOW = datetime(2027, 5, 1, 9, 0, tzinfo=timezone.utc)
FEEDS = {"booking": "secret://booking", "airbnb": "secret://airbnb", "direct": "secret://direct"}

results = []


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))


def fetcher(mapping):
    def fetch(url, timeout):
        what = mapping[url]
        if isinstance(what, Exception):
            raise what
        if isinstance(what, tuple):
            return what
        return 200, (FIX / what).read_text(encoding="utf-8")
    return fetch


OK = {"secret://booking": "booking.ics", "secret://airbnb": "airbnb.ics", "secret://direct": "direct.ics"}

# 1. Parsing + normalisation ----------------------------------------------------
st = E.sync(None, FEEDS, S, NOW, fetcher(OK))
pub = E.public_view(st, S, NOW, SEASON)
closed = [(c["start"], c["end"]) for c in pub["closed"]]
check("all three feeds synced", all(st["feeds"][s]["error"] is None for s in E.SOURCES), str({s: st["feeds"][s]["error"] for s in E.SOURCES}))
check("status fresh right after sync", pub["status"] == "fresh", pub["status"])
expected = [("2027-06-10", "2027-06-14"), ("2027-07-01", "2027-07-12"), ("2027-07-20", "2027-07-25"), ("2027-08-01", "2027-08-03")]
check("union of Booking + Airbnb + Direct, overlaps/adjacent merged, cancelled skipped, UTC times → Istanbul dates",
      closed == expected, str(closed))
blob = json.dumps(pub) + json.dumps(st)
leaks = [w for w in ("Test Guest", "FIXTURE-RES-CODE", "example.invalid", "+00 000", "EUR 999", "secret://", "Phone", "Reservation", "HMFIXTURE", "Test Family") if w in blob]
check("no guest name / e-mail / phone / reservation code / price / feed URL in state or public JSON", not leaks, str(leaks))
check("public JSON has only the allowed keys", set(pub) == {"version", "status", "last_successful_sync", "season", "closed", "ranges"}, str(sorted(pub)))

# 2. One feed down → last good data kept, still not fail-open ---------------------
later = NOW + timedelta(minutes=30)
down = dict(OK, **{"secret://airbnb": E.FeedError("fetch_failed")})
st2 = E.sync(st, FEEDS, S, later, fetcher(down))
pub2 = E.public_view(st2, S, later, SEASON)
check("Airbnb fetch error keeps Airbnb's last good closures", [(c["start"], c["end"]) for c in pub2["closed"]] == expected)
check("error is recorded for the owner (health), not in public JSON", st2["feeds"]["airbnb"]["error"] == "fetch_failed" and "fetch_failed" not in json.dumps(pub2))

for label, bad in (("HTTP 500", (500, "")), ("HTML login page instead of iCal", (200, (FIX / "not_calendar.txt").read_text())), ("timeout", TimeoutError())):
    stx = E.sync(st, FEEDS, S, later, fetcher(dict(OK, **{"secret://booking": bad})))
    px = E.public_view(stx, S, later, SEASON)
    check(f"Booking {label} → closures kept, error flagged", [(c["start"], c["end"]) for c in px["closed"]] == expected and stx["feeds"]["booking"]["error"])

# 3. Staleness ladder -------------------------------------------------------------
t_stale = NOW + timedelta(minutes=S["stale_after_minutes"] + 5)
st3 = E.sync(st, FEEDS, S, t_stale, fetcher({k: E.FeedError("fetch_failed") for k in OK}))
check("all feeds failing for > stale_after → status 'stale' (closures still shown)", E.public_view(st3, S, t_stale, SEASON)["status"] == "stale")
t_exp = NOW + timedelta(minutes=S["expire_after_minutes"] + 5)
st4 = E.sync(st3, FEEDS, S, t_exp, fetcher({k: E.FeedError("fetch_failed") for k in OK}))
check("failing for > expire_after → status 'unavailable' (UI shows no free dates)", E.public_view(st4, S, t_exp, SEASON)["status"] == "unavailable")
partial = E.sync(st, FEEDS, S, t_exp, fetcher(dict(OK, **{"secret://direct": E.FeedError("fetch_failed")})))
check("one feed expired while the others are fresh → whole calendar 'unavailable' (oldest feed decides)",
      E.public_view(partial, S, t_exp, SEASON)["status"] == "unavailable")

# 4. Never synced / not configured ---------------------------------------------------
check("no feed configured → 'unavailable'", E.public_view(E.sync(None, {}, S, NOW, fetcher({})), S, NOW, SEASON)["status"] == "unavailable")
first_fail = E.sync(None, FEEDS, S, NOW, fetcher(dict(OK, **{"secret://booking": (403, "")})))
check("a configured feed that never succeeded → 'unavailable'", E.public_view(first_fail, S, NOW, SEASON)["status"] == "unavailable")
check("missing secret → error 'not_configured', other feeds unaffected",
      E.sync(None, {"booking": "secret://booking"}, S, NOW, fetcher(OK))["feeds"]["airbnb"]["error"] == "not_configured")

# 5. Sudden empty calendar --------------------------------------------------------------
e1 = E.sync(st, FEEDS, S, later, fetcher(dict(OK, **{"secret://booking": "empty.ics"})))
check("Booking suddenly empty (had future closures) → first time rejected as 'suspect_empty', closures kept",
      e1["feeds"]["booking"]["error"] == "suspect_empty" and ("2027-06-10", "2027-06-14") in [(c["start"], c["end"]) for c in E.public_view(e1, S, later, SEASON)["closed"]])
e2 = E.sync(e1, FEEDS, S, later + timedelta(minutes=20), fetcher(dict(OK, **{"secret://booking": "empty.ics"})))
check("same empty answer on the next sync → accepted (real cancellations still arrive)",
      e2["feeds"]["booking"]["error"] is None and e2["feeds"]["booking"]["closed"] == [])

# 6. Season + past --------------------------------------------------------------------
check("season comes from config; null season → null (UI shows nothing as free)", E.public_view(st, S, NOW, None)["season"] is None)
far = datetime(2027, 7, 15, 9, 0, tzinfo=timezone.utc)
check("past ranges are dropped from the public JSON",
      all(c["end"] > "2027-07-15" for c in E.public_view(E.sync(st, FEEDS, S, far, fetcher(OK)), S, far, SEASON)["closed"]))

# 7. Health view -----------------------------------------------------------------------
h = E.health_view(st2, S, later)
check("owner health shows per-feed OK / error / last sync / fresh", h["airbnb"]["ok"] is False and h["booking"]["ok"] and h["booking"]["fresh"]
      and "secret://" not in json.dumps(h))

print(f"\n{sum(results)}/{len(results)} availability tests passed")
sys.exit(0 if all(results) else 1)
