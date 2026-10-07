"""Browser regression tests for site.js (stdlib + a local headless Chrome/Edge, no Node).

python v2/tools/test_site_js.py [--browser PATH]   → exit 1 on any failure

Serves v2/public on a random localhost port and runs the REAL built pages in headless
Chrome/Edge (--dump-dom). For each scenario the server injects a small test harness into the
page <head> (only in this test server, never into v2/public):
  - a fixed "today" (Date override) and an optional browser time zone (resolvedOptions),
  - a driver that waits for the calendar, reads the DOM / OTA links, picks dates and guests.
/api/availability.json answers a fixed 'fresh' fixture built from config (booking window +
one invented closed range). Nothing is fetched from the internet.

Covers (RC4): initial calendar month before / at / inside / after the booking window, OTA links
without dates when nothing is selected, exact dates after a selection, guests 1–4, and the
Booking review access note for TR / intl / neutral market hints.
"""
import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
V2 = Path(__file__).resolve().parents[1]
PUBLIC = V2 / "public"
CONFIG = json.loads((V2.parent / "config" / "site-config.json").read_text(encoding="utf-8"))
WINDOW = CONFIG["availability"]["booking_window"]
FIXTURE = {"status": "fresh", "generated_at": "2026-10-07T00:00:00Z",
           "booking_window": {"start": WINDOW["start"], "end": WINDOW["end"]},
           "closed": [{"start": "2027-08-06", "end": "2027-08-09"}]}

HARNESS = r"""<script>
(function () {
  var q = new URLSearchParams(location.search), NOW = q.get('__t_now'), TZ = q.get('__t_tz');
  if (NOW) {
    var p = NOW.split('-'), R = Date, fixed = new R(+p[0], +p[1] - 1, +p[2], 12, 0, 0).getTime();
    var F = function () {
      if (!(this instanceof F)) return new R(fixed).toString();
      if (!arguments.length) return new R(fixed);
      return new (Function.prototype.bind.apply(R, [null].concat([].slice.call(arguments))))();
    };
    F.prototype = R.prototype; F.now = function () { return fixed; }; F.UTC = R.UTC; F.parse = R.parse;
    window.Date = F;
  }
  if (TZ) {
    var RO = Intl.DateTimeFormat.prototype.resolvedOptions;
    Intl.DateTimeFormat.prototype.resolvedOptions = function () { var o = RO.call(this); o.timeZone = TZ; return o; };
  }
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return [].slice.call(document.querySelectorAll(s)); };
  function links() { return { booking: $('[data-channel="booking"]').href, airbnb: $('[data-channel="airbnb"]').href }; }
  function done(r) { var pre = document.createElement('pre'); pre.id = '__result'; pre.textContent = JSON.stringify(r); document.body.appendChild(pre); }
  document.addEventListener('DOMContentLoaded', function () {
    var a = $('a[href="#availability"]'); if (a) a.click();   // triggers the availability fetch
    var tries = 0, timer = setInterval(function () {
      if (!$('[data-cal-months] .cal-month') && ++tries < 150) return;
      clearInterval(timer);
      var r = { tries: tries };
      r.months = $$('[data-cal-months] .cal-month').map(function (m) { var b = m.querySelector('button[data-date]'); return b ? b.getAttribute('data-date').slice(0, 7) : null; });
      r.prevDisabled = $('[data-cal-prev]').disabled;
      r.free = $$('[data-cal-months] .is-free').length;
      r.status = $('[data-cal-status]').textContent;
      r.noDates = links();
      var n = $('[data-tr-review-note]'); r.reviewNote = n ? (n.hidden ? 'hidden' : 'visible') : 'absent';
      r.reviewLink = !!$('[data-track="booking_review_click"][data-cta="reviews"]');
      r.market = document.documentElement.getAttribute('data-market-hint');
      if (q.get('__t_select')) {
        var parts = q.get('__t_select').split('_'), s = parts[0], e = parts[1];
        for (var i = 0; i < 24 && !$('button[data-date="' + s + '"]'); i++) $('[data-cal-next]').click();
        $('button[data-date="' + s + '"]').click();
        r.afterStart = links();
        for (var k = 0; k < 24 && !$('button[data-date="' + e + '"]'); k++) $('[data-cal-next]').click();
        $('button[data-date="' + e + '"]').click();
        r.selected = links();
        r.guests = {};
        var g = $('#guests');
        [1, 2, 3, 4].forEach(function (v) { g.value = String(v); g.dispatchEvent(new Event('change')); r.guests[v] = links(); });
        $('[data-cal-clear]').click();
        r.cleared = links();
      }
      done(r);
    }, 100);
  });
})();
</script>"""


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == "/api/availability.json":
            return self._send(json.dumps(FIXTURE).encode(), "application/json")
        if path.endswith("/") or path.endswith(".html"):
            f = PUBLIC / (path.lstrip("/") + ("index.html" if path.endswith("/") else ""))
            if f.is_file():
                body = f.read_text(encoding="utf-8").replace("<head>", "<head>" + HARNESS, 1)
                return self._send(body.encode("utf-8"), "text/html; charset=utf-8")
        return super().do_GET()

    def _send(self, body, ctype):
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def find_browser(explicit):
    cands = [explicit] if explicit else []
    for base in (os.environ.get("PROGRAMFILES", ""), os.environ.get("PROGRAMFILES(X86)", ""), os.environ.get("LOCALAPPDATA", "")):
        cands += [os.path.join(base, "Google", "Chrome", "Application", "chrome.exe"),
                  os.path.join(base, "Microsoft", "Edge", "Application", "msedge.exe")]
    cands += [shutil.which(n) for n in ("google-chrome", "chromium", "chrome", "msedge")]
    return next((c for c in cands if c and os.path.isfile(c)), None)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--browser")
    a = ap.parse_args()
    browser = find_browser(a.browser)
    if not browser:
        print("FAIL no headless Chrome/Edge found\n0/1 site.js browser tests passed")
        return 1
    srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(Handler, directory=str(PUBLIC)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{srv.server_address[1]}"
    profile = tempfile.mkdtemp(prefix="palmiye-js-")
    results = []

    def check(name, ok, detail=""):
        ok = bool(ok)
        results.append(ok)
        print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))

    def run(lang, now, extra="", width=1280):
        url = f"{base}/{'' if lang == 'en' else lang + '/'}?__t_now={now}{extra}"
        out = subprocess.run([browser, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
                              f"--user-data-dir={profile}", f"--window-size={width},1000", "--virtual-time-budget=20000",
                              "--dump-dom", url], capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
        m = re.search(r'<pre id="__result">(.*?)</pre>', out.stdout, re.S)
        return json.loads(html.unescape(m.group(1))) if m else {"error": out.stderr[-400:]}

    def qp(u):
        return {k: v[0] for k, v in parse_qs(urlsplit(u).query).items()}

    DATE_KEYS = ("checkin", "checkout", "check_in", "check_out")

    def no_dates(l):
        return not any(k in qp(l["booking"]) for k in DATE_KEYS) and not any(k in qp(l["airbnb"]) for k in DATE_KEYS)

    def listing(l):
        return (l["booking"].split("?")[0] == CONFIG["platforms"]["booking"]
                and l["airbnb"].split("?")[0] == CONFIG["platforms"]["airbnb"])

    try:
        ws = WINDOW["start"][:7]
        ws_next = "%s-%02d" % (WINDOW["start"][:4], int(WINDOW["start"][5:7]) + 1)
        # A/B/C + after the window: initial month
        r = run("en", "2026-10-07")
        check(f"B: today 2026-10-07 (before window) → calendar opens at {ws} + {ws_next}, no earlier month reachable",
              r.get("months") == [ws, ws_next] and r.get("prevDisabled") is True and r.get("free", 0) > 0, str(r))
        r = run("en", WINDOW["start"])
        check(f"A: today = window start {WINDOW['start']} → current month {ws}", r.get("months") == [ws, ws_next], str(r.get("months")))
        r = run("en", "2027-03-15")
        check("C: today 2027-03-15 (inside window) → current month 2027-03 + 2027-04",
              r.get("months") == ["2027-03", "2027-04"] and r.get("free", 0) > 0, str(r.get("months")))
        r = run("en", "2028-02-01")
        check("after window: today 2028-02-01 → current month, no day shown as free (no invented availability), links without dates",
              r.get("months") == ["2028-02", "2028-03"] and r.get("free") == 0 and no_dates(r["noDates"]), str(r))
        r = run("tr", "2026-10-07", width=390)
        check(f"B (mobile 390px, TR): one month, {ws}", r.get("months") == [ws], str(r.get("months")))

        # D/E/F per language
        for lang in ("en", "tr", "de", "ru"):
            r = run(lang, "2026-10-07", "&__t_select=2027-07-12_2027-07-18")
            if "error" in r or "selected" not in r:
                check(f"D/E/F [{lang}] scenario ran", False, str(r)[:300])
                continue
            check(f"D [{lang}]: no dates selected → Booking + Airbnb listing URLs without any date parameter",
                  no_dates(r["noDates"]) and listing(r["noDates"]) and r["status"] != "", str(r["noDates"]))
            check(f"D [{lang}]: only a check-in picked → still no date parameters", no_dates(r["afterStart"]), str(r["afterStart"]))
            b, ab = qp(r["selected"]["booking"]), qp(r["selected"]["airbnb"])
            check(f"E [{lang}]: 12–18 Jul 2027 → Booking checkin=2027-07-12 checkout=2027-07-18, Airbnb check_in/check_out the same",
                  (b.get("checkin"), b.get("checkout"), ab.get("check_in"), ab.get("check_out")) == ("2027-07-12", "2027-07-18", "2027-07-12", "2027-07-18"),
                  str((b, ab)))
            ok = True
            for g in ("1", "2", "3", "4"):
                gb, ga = qp(r["guests"][g]["booking"]), qp(r["guests"][g]["airbnb"])
                ok &= gb.get("group_adults") == g and ga.get("adults") == g and gb.get("checkin") == "2027-07-12" and ga.get("check_out") == "2027-07-18"
            check(f"F [{lang}]: guests 1/2/3/4 → Booking group_adults and Airbnb adults match, dates kept", ok, str(r["guests"]))
            check(f"D [{lang}]: after 'clear' → links without dates again", no_dates(r["cleared"]), str(r["cleared"]))

        # G/H/I: Booking review access note
        for lang in ("en", "tr", "de", "ru"):
            r = run(lang, "2026-10-07", "&ph_market=tr")
            check(f"G [{lang}]: ?ph_market=tr → review access note visible, review link present",
                  r.get("market") == "tr" and r.get("reviewNote") == "visible" and r.get("reviewLink"), str(r)[:200])
        r = run("tr", "2026-10-07", "&__t_tz=Europe/Istanbul")
        check("G: time-zone hint Europe/Istanbul (no URL param) → note visible", r.get("reviewNote") == "visible", str(r.get("reviewNote")))
        r = run("tr", "2026-10-07", "&ph_market=intl&__t_tz=Europe/Istanbul")
        check("H: ?ph_market=intl → note hidden (explicit beats time zone), review link present",
              r.get("reviewNote") == "hidden" and r.get("reviewLink"), str(r.get("reviewNote")))
        for lang in ("en", "de"):
            r = run(lang, "2026-10-07", "&__t_tz=America/New_York")
            check(f"I [{lang}]: neutral (non-TR time zone, no param) → note hidden, review link present",
                  r.get("market") == "neutral" and r.get("reviewNote") == "hidden" and r.get("reviewLink"), str(r.get("reviewNote")))
    finally:
        srv.shutdown()
        shutil.rmtree(profile, ignore_errors=True)

    print(f"\n{sum(results)}/{len(results)} site.js browser tests passed")
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(main())
