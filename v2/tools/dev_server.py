"""Local preview server for v2/public (stdlib only).

- Serves the generated site at http://localhost:8080/
- MOCKS /api/telegram-notify.php: no PHP, no Telegram, no network. It applies the same
  whitelist + global debounce rules as the PHP endpoint and appends what *would* be sent
  to v2/.mock/telegram-mock.jsonl, so the client payload and rate limit can be tested.
- Emulates the .htaccess ?lang=xx → /xx/ redirect.

Usage: python v2/tools/dev_server.py [port]
"""
import json
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs

V2 = Path(__file__).resolve().parents[1]
ROOT = V2 / "public"
MOCK_DIR = V2 / ".mock"
MOCK_LOG = MOCK_DIR / "telegram-mock.jsonl"

ALLOWED_LANGUAGES = {"en", "tr", "de", "ru"}
ALLOWED_DEVICES = {"mobile", "tablet", "desktop"}
ALLOWED_PAGES = {"/", "/index.html", "/privacy.html", "/privacy", "/404.html", "/tr/", "/de/", "/ru/",
                 "/tr/index.html", "/de/index.html", "/ru/index.html",
                 "/tr/privacy.html", "/de/privacy.html", "/ru/privacy.html"}
MIN_INTERVAL, MAX_PER_HOUR = 60, 20
STATE = {"last_sent": 0, "hour_start": 0, "sent_this_hour": 0, "suppressed": 0}


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

    def do_GET(self):
        u = urlsplit(self.path)
        lang = parse_qs(u.query).get("lang", [""])[0]
        if u.path in ("/", "/index.html") and lang in ("tr", "de", "ru"):
            self.send_response(301)
            self.send_header("Location", f"/{lang}/")
            self.end_headers()
            return
        if u.path == "/__dev/gtag-stub.js":
            # Local stand-in for gtag.js: nothing leaves the machine. Commands stay in window.dataLayer.
            body = b"window.__gtagStub=true;"
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        target = ROOT / u.path.lstrip("/")
        if target.is_dir():
            target = target / "index.html"
        if target.suffix == ".html" and target.exists():
            # Never contact Google from a local preview (protects production GA4/Ads data).
            html = target.read_bytes().replace(b"https://www.googletagmanager.com/gtag/js?id=", b"/__dev/gtag-stub.js?id=")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return
        if not (ROOT / u.path.lstrip("/")).exists():
            self.send_response(404)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write((ROOT / "404.html").read_bytes())
            return
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
        rec = {
            "language": lang if lang in ALLOWED_LANGUAGES else "other",
            "device": body.get("device") if body.get("device") in ALLOWED_DEVICES else "unknown",
            "page": body.get("page") if body.get("page") in ALLOWED_PAGES else "other",
            "referrer": str(body.get("referrer", ""))[:253],
            "received_keys": sorted(body.keys()),
        }
        now = time.time()
        if now - STATE["hour_start"] >= 3600:
            STATE.update(hour_start=now, sent_this_hour=0)
        send = now - STATE["last_sent"] >= MIN_INTERVAL and STATE["sent_this_hour"] < MAX_PER_HOUR
        rec["would_send"] = send
        rec["aggregated_before"] = STATE["suppressed"]
        if send:
            STATE.update(last_sent=now, sent_this_hour=STATE["sent_this_hour"] + 1, suppressed=0)
        else:
            STATE["suppressed"] += 1
        MOCK_DIR.mkdir(exist_ok=True)
        with MOCK_LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("[dev] " + fmt % args + "\n")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"Serving {ROOT} on http://localhost:{port}/  (Telegram endpoint is a local mock)")
    Server(("127.0.0.1", port), Handler).serve_forever()
