"""Palmiye Home availability engine — Python reference implementation (stdlib only).

The production engine is PHP (v2/src/server/api/_lib/availability.php) because the
host is shared cPanel hosting. This module implements the SAME rules so they can be
tested locally (v2/tools/test_availability.py) and served by the dev server.
Keep both files in step; test_availability.py documents the expected behaviour.

Rules
  * Sources: Booking.com iCal and Airbnb iCal ONLY. Direct/WhatsApp bookings are blocked by
    the owner in Booking.com or Airbnb, so they arrive through those feeds (no third calendar).
    Every VEVENT is a closed period; only DTSTART/DTEND/STATUS are read.
    Names, e-mails, phone numbers, reservation codes, prices, UIDs and feed URLs are
    never read into the result.
  * Ranges are nights: start inclusive, end exclusive (= check-out day, iCal style).
  * Union of both sources: a night closed in Booking.com OR in Airbnb is closed on the website
    (covers the delay between the two OTAs' own iCal sync). Overlapping/adjacent ranges merged.
  * FAIL-SAFE: a feed that errors keeps its last good data; a feed that suddenly
    returns an empty calendar while it had future closures is accepted only after
    the same empty answer is seen twice in a row.
  * Status: fresh (every configured feed synced within stale_after) → stale (within
    expire_after) → unavailable (older, never synced, or no feed configured).
    'unavailable' means no date may be presented as free.
"""
import json
import re
from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=3))  # Europe/Istanbul, no DST since 2016
SOURCES = ("booking", "airbnb")


class FeedError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


# ── iCal ─────────────────────────────────────────────────────────────
def _unfold(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    return re.sub(r"\n[ \t]", "", text).split("\n")


def _to_date(value, params):
    v = value.strip()
    m = re.match(r"^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$", v)
    if not m:
        raise FeedError("parse_error")
    y, mo, d, hh, mi, ss, z = m.groups()
    if hh is None:
        return date(int(y), int(mo), int(d)), False
    dt = datetime(int(y), int(mo), int(d), int(hh), int(mi), int(ss))
    if z:  # UTC → Istanbul local date
        dt = dt.replace(tzinfo=timezone.utc).astimezone(IST)
    return dt.date(), True


def parse_ics(text):
    """Return (ranges, events_count). Raises FeedError on anything that is not a calendar."""
    if not isinstance(text, str) or "BEGIN:VCALENDAR" not in text[:2000] or "END:VCALENDAR" not in text[-2000:]:
        raise FeedError("not_a_calendar")
    ranges, events, cur = [], 0, None
    for line in _unfold(text):
        if line == "BEGIN:VEVENT":
            cur = {}
            continue
        if line == "END:VEVENT":
            if cur is None or "DTSTART" not in cur:
                raise FeedError("parse_error")
            events += 1
            if cur.get("STATUS", "").upper() == "CANCELLED":
                cur = None
                continue
            start, timed = cur["DTSTART"]
            if "DTEND" in cur:
                end, _ = cur["DTEND"]
            else:
                end = start + timedelta(days=1)
            if end <= start:
                end = start + timedelta(days=1)  # timed event inside one day still blocks that night
            ranges.append((start, end))
            cur = None
            continue
        if cur is None or ":" not in line:
            continue
        head, value = line.split(":", 1)
        name, *params = head.split(";")
        name = name.upper()
        if name in ("DTSTART", "DTEND"):
            cur[name] = _to_date(value, params)
        elif name == "STATUS":
            cur[name] = value.strip()
        # Everything else (SUMMARY, DESCRIPTION, UID, ATTENDEE, …) is deliberately ignored.
    return ranges, events


def merge(ranges):
    out = []
    for s, e in sorted(ranges):
        if out and s <= out[-1][1]:
            out[-1] = (out[-1][0], max(out[-1][1], e))
        else:
            out.append((s, e))
    return out


def _clip(ranges, today, horizon_days):
    lo, hi = today - timedelta(days=1), today + timedelta(days=horizon_days)
    return [(max(s, lo), min(e, hi)) for s, e in ranges if e > lo and s < hi]


# ── Sync ─────────────────────────────────────────────────────────────
def empty_state():
    return {"version": 1, "feeds": {}}


def sync(state, feeds, settings, now, fetch):
    """feeds: {source: url or None}. fetch(url, timeout) → (http_status, body_text) or raises.
    Returns the new state (the input is not modified)."""
    state = json.loads(json.dumps(state or empty_state()))
    today = now.astimezone(IST).date()
    ts = int(now.timestamp())
    for src in SOURCES:
        url = feeds.get(src)
        f = state["feeds"].setdefault(src, {"last_success": None, "closed": [], "error": None, "events": 0, "empty_seen": 0})
        f["configured"] = bool(url)
        if not url:
            f["error"] = "not_configured"
            continue
        f["last_attempt"] = ts
        try:
            try:
                status, body = fetch(url, settings["fetch_timeout_seconds"])
            except FeedError:
                raise
            except Exception:
                raise FeedError("fetch_failed")
            if status != 200:
                raise FeedError(f"http_{status}")
            ranges, events = parse_ics(body)
            clipped = merge(_clip(ranges, today, settings["horizon_days"]))
            had_future = any(date.fromisoformat(e) > today for _, e in f.get("closed", []))
            if events == 0 and had_future and f.get("empty_seen", 0) < 1:
                f["empty_seen"] = f.get("empty_seen", 0) + 1
                raise FeedError("suspect_empty")
            f["empty_seen"] = 0
            f["closed"] = [[s.isoformat(), e.isoformat()] for s, e in clipped]
            f["events"] = events
            f["last_success"] = ts
            f["error"] = None
        except FeedError as ex:
            f["error"] = ex.code  # last good 'closed' list is kept
    state["last_run"] = ts
    return state


def in_booking_window(day_iso, booking_window):
    """True if the NIGHT of day_iso lies inside the outer booking window (inclusive). Same rule as
    site.js inWindow(). The window is not availability: closed nights still come from the feeds,
    and the pool status plays no part at all."""
    return bool(booking_window and booking_window.get("start") and booking_window.get("end")
                and booking_window["start"] <= day_iso <= booking_window["end"])


def public_view(state, settings, now, booking_window):
    """The anonymous JSON served at /api/availability.json."""
    ts = int(now.timestamp())
    today = now.astimezone(IST).date()
    all_feeds = (state or {}).get("feeds", {})
    feeds = [f for f in all_feeds.values() if f.get("configured")]
    # Both OTAs are required: a missing or never-synced source makes the calendar 'unavailable'.
    if any(not all_feeds.get(s, {}).get("configured") for s in SOURCES) or any(not f.get("last_success") for f in feeds):
        status, oldest = "unavailable", None
    else:
        oldest = min(f["last_success"] for f in feeds)
        age_min = (ts - oldest) / 60
        status = ("fresh" if age_min <= settings["stale_after_minutes"]
                  else "stale" if age_min <= settings["expire_after_minutes"] else "unavailable")
    closed = merge((date.fromisoformat(s), date.fromisoformat(e))
                   for f in feeds for s, e in f.get("closed", []))
    closed = [(s, e) for s, e in closed if e > today]
    has_window = bool(booking_window and booking_window.get("start") and booking_window.get("end"))
    return {
        "version": 1,
        "status": status,
        "last_successful_sync": datetime.fromtimestamp(oldest, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if oldest else None,
        "booking_window": {"start": booking_window["start"], "end": booking_window["end"]} if has_window else None,
        "closed": [{"start": s.isoformat(), "end": e.isoformat()} for s, e in closed],
        "ranges": "start inclusive, end exclusive (check-out day)",
    }


def health_view(state, settings, now):
    """Owner-only diagnostics (never public)."""
    ts = int(now.timestamp())
    out = {}
    for src in SOURCES:
        f = (state or {}).get("feeds", {}).get(src, {})
        ls = f.get("last_success")
        age = None if not ls else round((ts - ls) / 60)
        out[src] = {
            "configured": bool(f.get("configured")),
            "ok": bool(f.get("configured")) and f.get("error") is None,
            "error": f.get("error"),
            "last_success_minutes_ago": age,
            "fresh": age is not None and age <= settings["stale_after_minutes"],
            "closed_ranges": len(f.get("closed", [])),
            "events_in_feed": f.get("events", 0),
        }
    return out
