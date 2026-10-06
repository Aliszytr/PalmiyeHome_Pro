"""Local preview server for v2/public (stdlib only).

- Serves the generated site at http://localhost:8080/
- Never contacts Google: every gtag.js URL in HTML **and JS** is rewritten to a local stub
  (in basic consent mode track.js injects the tag after "Accept").
- MOCKS /api/telegram-notify.php: no PHP, no Telegram, no network. Same whitelist and global
  debounce as the PHP endpoint; the message that WOULD be sent is appended to
  v2/.mock/telegram-mock.jsonl. The client IP is never written (the mock has no GeoIP file,
  so the place is "Konum bilinmiyor", exactly like a server without the database).
- MOCKS /api/availability.json with the Python reference engine and the INVENTED fixtures in
  v2/tests/fixtures (response header X-Palmiye-Mock). Scenario switch for QA:
      /__dev/availability?scenario=fresh|stale|unavailable|offline
  'offline' answers 503 (as if PHP were broken). /__dev/availability-health shows the
  owner diagnostics JSON.
- Emulates the .htaccess ?lang=xx → /xx/ redirect.
- ?__dev_consent=accepted|declined pre-sets the consent choice (screenshots only).
- ?__dev_tz=America/New_York simulates the browser time zone (market-hint QA on this machine).

Usage: python v2/tools/dev_server.py [port]
"""
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

sys.path.insert(0, str(Path(__file__).resolve().parent))
import availability_engine as AE  # noqa: E402

V2 = Path(__file__).resolve().parents[1]
ROOT = V2 / "public"
MOCK_DIR = V2 / ".mock"
MOCK_LOG = MOCK_DIR / "telegram-mock.jsonl"
FIX = V2 / "tests" / "fixtures"
CONFIG = json.loads((V2.parent / "config" / "site-config.json").read_text(encoding="utf-8"))

ALLOWED_LANGUAGES = {"en", "tr", "de", "ru"}
PAGE_LABELS = {"/": "Ana sayfa", "/index.html": "Ana sayfa", "/tr/": "Ana sayfa", "/de/": "Ana sayfa", "/ru/": "Ana sayfa",
               "/tr/index.html": "Ana sayfa", "/de/index.html": "Ana sayfa", "/ru/index.html": "Ana sayfa",
               "/privacy.html": "Gizlilik", "/privacy": "Gizlilik", "/tr/privacy.html": "Gizlilik",
               "/de/privacy.html": "Gizlilik", "/ru/privacy.html": "Gizlilik", "/404.html": "404 sayfası"}
MIN_INTERVAL, MAX_PER_HOUR = 60, 20
STATE = {"last_sent": 0, "hour_start": 0, "sent_this_hour": 0, "suppressed": 0}

# Availability mock: invented fixtures, MOCK season (production season stays null in config).
MOCK_SEASON = {"start": "2027-05-01", "end": "2027-10-31"}
SCENARIO = {"name": "fresh"}
GTAG = b"https://www.googletagmanager.com/gtag/js?id="


def mock_availability(scenario):
    s = CONFIG["availability"]
    feeds = {"booking": "fixture://booking", "airbnb": "fixture://airbnb"}
    files = {"fixture://booking": "booking.ics", "fixture://airbnb": "airbnb.ics"}

    def fetch(url, timeout):
        return 200, (FIX / files[url]).read_text(encoding="utf-8")

    now = datetime.now(timezone.utc)
    synced_at = {"fresh": now - timedelta(minutes=5),
                 "stale": now - timedelta(minutes=s["stale_after_minutes"] + 30),
                 "unavailable": now - timedelta(minutes=s["expire_after_minutes"] + 30)}[scenario]
    state = AE.sync(None, feeds, s, synced_at, fetch)
    return state, AE.public_view(state, s, now, MOCK_SEASON), AE.health_view(state, s, now)


class Server(ThreadingHTTPServer):
    # Default backlog (5) makes Windows reset connections when the page requests many images at once.
    request_queue_size = 128
    daemon_threads = True


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_body(self, code, ctype, body, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        u = urlsplit(self.path)
        q = parse_qs(u.query)
        lang = q.get("lang", [""])[0]
        if u.path in ("/", "/index.html") and lang in ("tr", "de", "ru"):
            self.send_response(301)
            self.send_header("Location", f"/{lang}/")
            self.end_headers()
            return
        if u.path == "/__dev/gtag-stub.js":
            # Local stand-in for gtag.js: nothing leaves the machine. Commands stay in window.dataLayer.
            return self.send_body(200, "application/javascript", b"window.__gtagStub=true;")
        if u.path == "/__dev/availability":
            name = q.get("scenario", [SCENARIO["name"]])[0]
            if name in ("fresh", "stale", "unavailable", "offline"):
                SCENARIO["name"] = name
            return self.send_body(200, "application/json", json.dumps({"scenario": SCENARIO["name"]}).encode())
        if u.path == "/__dev/availability-health":
            if SCENARIO["name"] == "offline":
                return self.send_body(200, "application/json", b'{"offline": true}')
            _, _, health = mock_availability(SCENARIO["name"])
            return self.send_body(200, "application/json", json.dumps(health, indent=2).encode())
        if u.path == "/api/availability.json":
            if SCENARIO["name"] == "offline":
                return self.send_body(503, "text/plain", b"mock: availability endpoint down")
            _, pub, _ = mock_availability(SCENARIO["name"])
            return self.send_body(200, "application/json; charset=utf-8", json.dumps(pub).encode(),
                                  {"X-Palmiye-Mock": f"availability-fixtures; scenario={SCENARIO['name']}"})
        if u.path.endswith(".php"):
            return self.send_body(404, "text/plain", b"PHP is not available in the local preview")
        target = ROOT / u.path.lstrip("/")
        if target.is_dir():
            target = target / "index.html"
        if target.suffix in (".html", ".js") and target.exists():
            body = target.read_bytes().replace(GTAG, b"/__dev/gtag-stub.js?id=")
            choice = q.get("__dev_consent", [""])[0]
            if target.suffix == ".html" and choice in ("accepted", "declined"):
                body = body.replace(b"<head>", b"<head><script>localStorage.setItem('palmiye_cookies','" + choice.encode() + b"')</script>", 1)
            tz = q.get("__dev_tz", [""])[0]
            if target.suffix == ".html" and tz.replace("/", "").replace("_", "").isalpha():
                body = body.replace(b"<head>", b"<head><script>(function(){var o=Intl.DateTimeFormat.prototype.resolvedOptions;"
                                    b"Intl.DateTimeFormat.prototype.resolvedOptions=function(){var r=o.call(this);r.timeZone='" + tz.encode() + b"';return r;};})();</script>", 1)
            ctype = "text/html; charset=utf-8" if target.suffix == ".html" else "application/javascript"
            return self.send_body(200, ctype, body)
        if not target.exists():
            return self.send_body(404, "text/html; charset=utf-8", (ROOT / "404.html").read_bytes())
        super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != "/api/telegram-notify.php":
            self.send_response(405); self.end_headers(); return
        raw = self.rfile.read(min(int(self.headers.get("Content-Length", 0)), 2048))
        try:
            body = json.loads(raw)
        except ValueError:
            self.send_response(400); self.end_headers(); return
        lang = str(body.get("language", ""))[:2].lower()
        lang = lang if lang in ALLOWED_LANGUAGES else "other"
        page = PAGE_LABELS.get(body.get("page"), "Diğer sayfa")
        ref = str(body.get("referrer", ""))[:253]
        now = time.time()
        if now - STATE["hour_start"] >= 3600:
            STATE.update(hour_start=now, sent_this_hour=0)
        send = now - STATE["last_sent"] >= MIN_INTERVAL and STATE["sent_this_hour"] < MAX_PER_HOUR
        before = STATE["suppressed"]
        if send:
            STATE.update(last_sent=now, sent_this_hour=STATE["sent_this_hour"] + 1, suppressed=0)
        else:
            STATE["suppressed"] += 1
        place = "Konum bilinmiyor"  # no GeoIP database locally (same as a server without it)
        message = (f"🌴 Yeni ziyaret · {place} · {lang.upper()} · {page}\n"
                   f"{datetime.now().strftime('%d.%m.%Y %H:%M')} · konum yaklaşıktır"
                   + (f"\nKaynak: {ref}" if ref else "")
                   + (f"\n+{before} ziyaret daha (bildirim sınırı nedeniyle toplandı)" if before else ""))
        rec = {"received_keys": sorted(body.keys()), "would_send": send, "message": message if send else None,
               "aggregated_before": before}
        MOCK_DIR.mkdir(exist_ok=True)
        with MOCK_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[dev] " + fmt % args + "\n")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"Serving {ROOT} on http://localhost:{port}/  (Telegram, gtag.js and availability are local mocks)")
    Server(("127.0.0.1", port), Handler).serve_forever()
