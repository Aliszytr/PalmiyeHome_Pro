"""Fail-safe tests for the availability engine (Python reference implementation).

python v2/tools/test_availability.py   → exit 1 on any failure

Sources are Booking.com and Airbnb ONLY. Fixtures in v2/tests/fixtures are invented test data
(example.invalid), never real bookings:
  booking.ics  06-10..14 (also in Airbnb), 07-01..08 (personal fields), 08-05..09 (Booking only)
  airbnb.ics   06-10..14 (exact duplicate), 07-03..05 (inside Booking's range), 07-08..12 (adjacent),
               07-20..25 (Airbnb only)
The same scenarios run against the PHP engine on the server with
    php api/availability-sync.php --selftest
"""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import availability_engine as E  # noqa: E402

FIX = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
CONFIG = json.loads((Path(__file__).resolve().parents[2] / "config" / "site-config.json").read_text(encoding="utf-8"))
S = CONFIG["availability"]
WINDOW = CONFIG["availability"]["booking_window"]
NOW = datetime(2027, 5, 1, 9, 0, tzinfo=timezone.utc)
FEEDS = {"booking": "secret://booking", "airbnb": "secret://airbnb"}
OK = {"secret://booking": "booking.ics", "secret://airbnb": "airbnb.ics"}
EXPECTED = [("2027-06-10", "2027-06-14"), ("2027-07-01", "2027-07-12"), ("2027-07-20", "2027-07-25"), ("2027-08-05", "2027-08-09")]

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


def ranges(pub):
    return [(c["start"], c["end"]) for c in pub["closed"]]


def closed_on(pub, day):
    return any(c["start"] <= day < c["end"] for c in pub["closed"])


# 0. Only two sources ----------------------------------------------------------------
check("engine sources are exactly Booking.com + Airbnb (no Direct/Google Calendar)", E.SOURCES == ("booking", "airbnb"))

# 1. Normal: Booking OK + Airbnb OK -------------------------------------------------
st = E.sync(None, FEEDS, S, NOW, fetcher(OK))
pub = E.public_view(st, S, NOW, WINDOW)
check("normal: both feeds synced, status fresh", all(st["feeds"][s]["error"] is None for s in E.SOURCES) and pub["status"] == "fresh")
check("normal: union of closed nights is correct", ranges(pub) == EXPECTED, str(ranges(pub)))
check("Booking-only closure (08-05..08) is CLOSED on the web", all(closed_on(pub, d) for d in ("2027-08-05", "2027-08-08")) and not closed_on(pub, "2027-08-09"))
check("Airbnb-only closure (07-20..24) is CLOSED on the web", all(closed_on(pub, d) for d in ("2027-07-20", "2027-07-24")) and not closed_on(pub, "2027-07-25"))
check("overlap: same nights in both OTAs normalised to one range (no duplicates)",
      ranges(pub).count(("2027-06-10", "2027-06-14")) == 1 and len(set(ranges(pub))) == len(ranges(pub)))
check("overlap: Airbnb range inside / adjacent to Booking range merged (07-01..12)", ("2027-07-01", "2027-07-12") in ranges(pub))
check("check-out day stays bookable (end exclusive)", not closed_on(pub, "2027-06-14"))

# 2. Parser edge cases --------------------------------------------------------------
edge, n = E.parse_ics((FIX / "parser_edge.ics").read_text(encoding="utf-8"))
check("parser: UTC times → Istanbul dates, cancelled skipped, missing DTEND = one night",
      [(s.isoformat(), e.isoformat()) for s, e in E.merge(edge)] == [("2027-09-01", "2027-09-03"), ("2027-09-20", "2027-09-21")] and n == 3)

# 3. Secret / personal data protection -----------------------------------------------
blob = json.dumps(pub) + json.dumps(st) + json.dumps(E.health_view(st, S, NOW))
leaks = [w for w in ("Test Guest", "FIXTURE-RES-CODE", "example.invalid", "+00 000", "EUR 999", "secret://", "Phone",
                     "Reservation", "HMFIXTURE", "Test Family") if w in blob]
check("no iCal URL / guest name / e-mail / phone / reservation code / price in public JSON, cache or health", not leaks, str(leaks))
check("public JSON has only the allowed keys", set(pub) == {"version", "status", "last_successful_sync", "booking_window", "closed", "ranges"}, str(sorted(pub)))

# 4. One feed failing → its last good cache is kept ------------------------------------
later = NOW + timedelta(minutes=30)
for src, label in (("booking", "Booking"), ("airbnb", "Airbnb")):
    for what, bad in (("fetch error", E.FeedError("fetch_failed")), ("HTTP 500", (500, "")), ("timeout", TimeoutError()),
                      ("HTML login page", (200, (FIX / "not_calendar.txt").read_text()))):
        s2 = E.sync(st, FEEDS, S, later, fetcher(dict(OK, **{f"secret://{src}": bad})))
        p2 = E.public_view(s2, S, later, WINDOW)
        check(f"{label} {what} → last good {label} cache kept, error recorded (owner only)",
              ranges(p2) == EXPECTED and s2["feeds"][src]["error"] and s2["feeds"][src]["error"] not in json.dumps(p2))

# 5. Both feeds failing: never fail-open -----------------------------------------------
all_fail = {k: E.FeedError("fetch_failed") for k in OK}
t_stale = NOW + timedelta(minutes=S["stale_after_minutes"] + 5)
s3 = E.sync(st, FEEDS, S, t_stale, fetcher(all_fail))
p3 = E.public_view(s3, S, t_stale, WINDOW)
check("both feeds failing > stale_after → 'stale', closures still shown", p3["status"] == "stale" and ranges(p3) == EXPECTED)
t_exp = NOW + timedelta(minutes=S["expire_after_minutes"] + 5)
p4 = E.public_view(E.sync(s3, FEEDS, S, t_exp, fetcher(all_fail)), S, t_exp, WINDOW)
check("both feeds failing > expire_after → 'unavailable' (calendar shows no free date)", p4["status"] == "unavailable")
p5 = E.public_view(E.sync(st, FEEDS, S, t_exp, fetcher(dict(OK, **{"secret://airbnb": E.FeedError("fetch_failed")}))), S, t_exp, WINDOW)
check("one feed expired while the other is fresh → 'unavailable' (the oldest feed decides)", p5["status"] == "unavailable")
never = E.public_view(E.sync(None, FEEDS, S, NOW, fetcher(all_fail)), S, NOW, WINDOW)
check("both feeds unavailable from the first sync → 'unavailable'", never["status"] == "unavailable")
only_b = E.public_view(E.sync(None, FEEDS, S, NOW, fetcher(dict(OK, **{"secret://airbnb": (403, "")}))), S, NOW, WINDOW)
check("Airbnb never synced (Booking fine) → 'unavailable', not Booking-only availability", only_b["status"] == "unavailable")
check("no feed configured → 'unavailable'", E.public_view(E.sync(None, {}, S, NOW, fetcher({})), S, NOW, WINDOW)["status"] == "unavailable")
miss = E.sync(None, {"booking": "secret://booking"}, S, NOW, fetcher(OK))
check("missing Airbnb secret → Airbnb 'not_configured' and calendar 'unavailable' (no Booking-only fail-open)",
      miss["feeds"]["airbnb"]["error"] == "not_configured" and E.public_view(miss, S, NOW, WINDOW)["status"] == "unavailable")

# 6. Sudden empty calendar ---------------------------------------------------------------
e1 = E.sync(st, FEEDS, S, later, fetcher(dict(OK, **{"secret://booking": "empty.ics"})))
check("Booking suddenly empty (had future closures) → rejected once ('suspect_empty'), closures kept",
      e1["feeds"]["booking"]["error"] == "suspect_empty" and closed_on(E.public_view(e1, S, later, WINDOW), "2027-08-06"))
e2 = E.sync(e1, FEEDS, S, later + timedelta(minutes=20), fetcher(dict(OK, **{"secret://booking": "empty.ics"})))
check("same empty answer on the next sync → accepted (real cancellations still arrive)",
      e2["feeds"]["booking"]["error"] is None and e2["feeds"]["booking"]["closed"] == []
      and closed_on(E.public_view(e2, S, later, WINDOW), "2027-07-21"))

# 7. Booking window + past ------------------------------------------------------------------------
check("null booking window stays null (UI shows nothing as free)", E.public_view(st, S, NOW, None)["booking_window"] is None)
far = datetime(2027, 7, 15, 9, 0, tzinfo=timezone.utc)
check("past ranges are dropped from the public JSON",
      all(c["end"] > "2027-07-15" for c in E.public_view(E.sync(st, FEEDS, S, far, fetcher(OK)), S, far, WINDOW)["closed"]))

# 7b. Booking window boundaries (decision 2026-10-06: the whole of 2027) ---------------
check("config booking_window is 2027-01-01 → 2027-12-31", WINDOW == {"start": "2027-01-01", "end": "2027-12-31"}, str(WINDOW))
for day in ("2027-01-01", "2027-03-01", "2027-05-01", "2027-06-01", "2027-12-31"):
    check(f"{day} is inside the booking window", E.in_booking_window(day, WINDOW))
for day in ("2026-12-31", "2028-01-01"):
    check(f"{day} is outside the booking window", not E.in_booking_window(day, WINDOW))
check("public JSON publishes the booking window unchanged", E.public_view(st, S, NOW, WINDOW)["booking_window"] == WINDOW)

# 7c. POOL STATUS != APARTMENT AVAILABILITY ---------------------------------------------
import inspect  # noqa: E402
check("engine has no pool input: closures depend only on the two feeds",
      "pool" not in inspect.signature(E.sync).parameters and "pool" not in inspect.signature(E.public_view).parameters
      and "pool" not in json.dumps({k: v for k, v in S.items() if not k.startswith("_")}).lower())
off_season = [d for d in ("2027-01-15", "2027-03-10", "2027-04-20", "2027-11-20", "2027-12-24")
              if E.in_booking_window(d, WINDOW) and not closed_on(pub, d)]
check("off-season nights (pool closed) stay bookable when no OTA has closed them", len(off_season) == 5, str(off_season))

# 8. Owner health ---------------------------------------------------------------------------
h = E.health_view(E.sync(st, FEEDS, S, later, fetcher(dict(OK, **{"secret://airbnb": E.FeedError("fetch_failed")}))), S, later)
check("owner health has exactly Booking + Airbnb rows with ok / error / last sync / fresh",
      set(h) == {"booking", "airbnb"} and h["airbnb"]["ok"] is False and h["airbnb"]["error"] == "fetch_failed"
      and h["booking"]["ok"] and h["booking"]["fresh"] and h["booking"]["last_success_minutes_ago"] == 0)

print(f"\n{sum(results)}/{len(results)} availability tests passed")
sys.exit(0 if all(results) else 1)
