"""End-to-end tests of the PHP server side with a REAL PHP binary (stdlib only).

    python v2/tools/test_php_local.py --php C:\\path\\to\\php.exe [--php C:\\other\\php.exe]

For every PHP binary it builds a throw-away server layout in a temp folder:

    <tmp>/home/public_html/          copy of v2/public (the deploy root)
    <tmp>/home/palmiye-secrets/.env.php   TEST values only (local fake ICS URLs, test hash)

and serves invented iCal fixtures (v2/tests/fixtures) from a local HTTPS server with a
self-signed certificate (trusted only through this run's php.ini). Nothing leaves the machine:
no real ICS URL, no Telegram call (the Telegram secret stays a placeholder), no live host.

--local-tls-no-verify: some antivirus products (e.g. Avast Web Shield) intercept even localhost
HTTPS and re-sign self-signed certificates with a root that is deliberately not trusted. With this
flag the TEMPORARY sandbox copy (never the repository or the release package) gets
CURLOPT_SSL_VERIFYPEER => false so the feed logic can still be tested; TLS verification itself is
then a server check with the real Booking.com / Airbnb certificates.

Covers: php -l, selftest, forced sync, public endpoint, owner health (login, CSRF, sync, no
secret values in output), missing/invalid secrets, secret file inside the web root refused,
malformed ICS, HTTP 500, timeout, stale ladder, booking-window edges, sync script over HTTP,
Telegram request guards, and "no PHP warning/notice/stack trace in any response".
"""
import argparse
import http.client
import http.server
import json
import os
import re
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
V2 = Path(__file__).resolve().parents[1]
PUB, FIX = V2 / "public", V2 / "tests" / "fixtures"
TEST_PASSWORD = "local-test-only-password"
NOISE = re.compile(r"(Warning|Notice|Deprecated|Fatal error|Parse error|Stack trace|Uncaught)\b")

results = []


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


# ── Fake ICS server (HTTPS, self-signed) ─────────────────────────────
MODE = {"booking": "booking.ics", "airbnb": "airbnb.ics"}


class ICS(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        feed = self.path.strip("/").split(".")[0]
        what = MODE.get(feed, "404")
        if what == "500":
            self.send_response(500); self.send_header("Content-Length", "0"); self.send_header("Connection", "close")
            self.end_headers(); return
        if what == "slow":
            time.sleep(13); self.send_response(200); self.send_header("Content-Length", "0"); self.end_headers(); return
        if what == "html":
            body = (FIX / "not_calendar.txt").read_bytes()
        elif what.endswith(".ics"):
            body = (FIX / what).read_bytes()
        else:
            self.send_response(404); self.end_headers(); return
        self.send_response(200)
        self.send_header("Content-Type", "text/calendar")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass


def start_ics(tmp):
    cert, key = tmp / "cert.pem", tmp / "key.pem"
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "2", "-subj", "/CN=127.0.0.1",
                    "-addext", "subjectAltName=IP:127.0.0.1", "-keyout", str(key), "-out", str(cert)],
                   check=True, capture_output=True)
    port = free_port()
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", port), ICS)
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(cert, key)
    srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, port, cert


# ── Layout + PHP helpers ─────────────────────────────────────────────
def write_secrets(home, ics_port, php, *, booking=True, airbnb=True, hash_=True, where=None):
    h = ""
    if hash_:
        h = subprocess.run([php["exe"], "-c", php["ini"], "-r", f"echo password_hash('{TEST_PASSWORD}', PASSWORD_DEFAULT);"],
                           capture_output=True, text=True).stdout.strip()
    target = where or (home / "palmiye-secrets" / ".env.php")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("<?php\n// LOCAL TEST VALUES ONLY\n"
                      "define('TELEGRAM_ENABLED', true);\n"
                      "define('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE');\n"
                      "define('TELEGRAM_CHAT_ID', 'YOUR_CHAT_ID_HERE');\n"
                      f"define('PALMIYE_ICAL_BOOKING', '{'https://127.0.0.1:%d/booking.ics' % ics_port if booking else ''}');\n"
                      f"define('PALMIYE_ICAL_AIRBNB', '{'https://127.0.0.1:%d/airbnb.ics' % ics_port if airbnb else ''}');\n"
                      f"define('PALMIYE_AVAILABILITY_ADMIN_HASH', '{h}');\n", encoding="utf-8")
    return target


def php_cli(php, *args, env=None):
    r = subprocess.run([php["exe"], "-c", php["ini"], *args], capture_output=True, text=True, encoding="utf-8",
                       errors="replace", env={**os.environ, **(env or {})}, timeout=120)
    return r.returncode, r.stdout + r.stderr


class Web:
    def __init__(self, php, docroot, env=None):
        self.port = free_port()
        self.proc = subprocess.Popen([php["exe"], "-c", php["ini"], "-S", f"127.0.0.1:{self.port}", "-t", str(docroot)],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                     env={**os.environ, **(env or {})})
        for _ in range(50):
            try:
                socket.create_connection(("127.0.0.1", self.port), 0.2).close()
                break
            except OSError:
                time.sleep(0.1)
        self.cookie = None

    def req(self, method, path, body=None, headers=None):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=60)
        h = dict(headers or {})
        if self.cookie:
            h["Cookie"] = self.cookie
        if isinstance(body, dict):
            body = urllib.parse.urlencode(body)
            h["Content-Type"] = "application/x-www-form-urlencoded"
        c.request(method, path, body=body, headers=h)
        r = c.getresponse()
        data = r.read().decode("utf-8", "replace")
        sc = r.getheader("Set-Cookie")
        if sc and sc.startswith("palmiye_owner="):
            self.cookie = sc.split(";")[0]
        return r.status, dict(r.getheaders()), data

    def stop(self):
        self.proc.terminate()
        self.proc.wait(10)


def state_path(home):
    return home / "palmiye-secrets" / "availability-cache" / "state.json"


def run_suite(php, label):
    print(f"\n=== {label}: {php['exe']}")
    tmp = Path(tempfile.mkdtemp(prefix="palmiye-php-"))
    try:
        ics, ics_port, cert = start_ics(tmp)
        ini = tmp / "php.ini"
        ini.write_text(Path(php["ini"]).read_text(encoding="utf-8")
                       + f'\ncurl.cainfo="{cert.as_posix()}"\nopenssl.cafile="{cert.as_posix()}"\n'
                       + f'session.save_path="{tmp.as_posix()}"\ndisplay_errors=On\nerror_reporting=E_ALL\n', encoding="utf-8")
        php = {"exe": php["exe"], "ini": str(ini), "no_verify": php.get("no_verify")}
        home = tmp / "home"
        docroot = home / "public_html"
        shutil.copytree(PUB, docroot)
        if php.get("no_verify"):
            lib = docroot / "api/_lib/availability.php"
            src = lib.read_text(encoding="utf-8")
            assert src.count("CURLOPT_SSL_VERIFYPEER => true,") == 1
            lib.write_text(src.replace("CURLOPT_SSL_VERIFYPEER => true,", "CURLOPT_SSL_VERIFYPEER => false, // SANDBOX ONLY"), encoding="utf-8")
            print("NOTE sandbox copy only: TLS peer verification disabled for the local fake feeds")
        noise = []

        # 1. Syntax
        bad = [f for f in docroot.rglob("*.php") if "No syntax errors" not in php_cli(php, "-l", str(f))[1]]
        check(f"[{label}] php -l: all {len(list(docroot.rglob('*.php')))} PHP files", not bad, str(bad))

        # 2. Selftest
        write_secrets(home, ics_port, php)
        rc, out = php_cli(php, str(docroot / "api/availability-sync.php"), "--selftest", f"--fixtures={FIX}")
        check(f"[{label}] availability selftest → SELFTEST OK", rc == 0 and "SELFTEST OK" in out, out[-400:])
        noise += NOISE.findall(out)
        rc, out = php_cli(php, str(docroot / "api/availability-sync.php"), "--selftest")
        check(f"[{label}] selftest without --fixtures refuses (exit 2, usage)", rc == 2 and "Usage" in out)

        # 3. Forced sync against the local HTTPS fake feeds
        rc, out = php_cli(php, str(docroot / "api/availability-sync.php"), "--force")
        st = json.loads(state_path(home).read_text())
        check(f"[{label}] forced sync → 'synced', both feeds OK", rc == 0 and out.strip() == "synced"
              and all(st["feeds"][s]["error"] is None for s in ("booking", "airbnb")), out)
        web = Web(php, docroot)
        try:
            s, hd, body = web.req("GET", "/api/availability.json".replace(".json", ".php"))
            pub = json.loads(body)
            noise += NOISE.findall(body)
            ranges = [(c["start"], c["end"]) for c in pub["closed"]]
            exp = [("2027-06-10", "2027-06-14"), ("2027-07-01", "2027-07-12"), ("2027-07-20", "2027-07-25"), ("2027-08-05", "2027-08-09")]
            check(f"[{label}] public endpoint: fresh, Booking+Airbnb union (overlap/duplicate/adjacent merged)",
                  s == 200 and pub["status"] == "fresh" and ranges == exp, str(ranges))
            check(f"[{label}] public endpoint: only allowed keys; booking_window 2027-01-01 → 2027-12-31",
                  set(pub) == {"version", "status", "last_successful_sync", "booking_window", "closed", "ranges"}
                  and pub["booking_window"] == {"start": "2027-01-01", "end": "2027-12-31"})
            check(f"[{label}] public endpoint headers: JSON, nosniff, Cache-Control max-age + SWR, ETag, noindex",
                  hd.get("Content-Type", "").startswith("application/json") and hd.get("X-Content-Type-Options") == "nosniff"
                  and "max-age=300" in hd.get("Cache-Control", "") and "stale-while-revalidate" in hd.get("Cache-Control", "")
                  and hd.get("ETag") and "noindex" in hd.get("X-Robots-Tag", ""))
            s2, _, _ = web.req("GET", "/api/availability.php", headers={"If-None-Match": hd.get("ETag")})
            check(f"[{label}] ETag revalidation → 304", s2 == 304)
            check(f"[{label}] no ICS URL / guest data in public JSON or cache",
                  not re.search(r"127\.0\.0\.1|https?://|Test Guest|FIXTURE-RES|example\.invalid", body + state_path(home).read_text()))
            s, _, body = web.req("GET", "/api/availability-sync.php")
            check(f"[{label}] sync script over HTTP → 404, no output", s == 404 and body.strip() == "")

            # 4. Owner health
            s, hd, body = web.req("GET", "/api/availability-health.php")
            csrf = re.search(r'name="csrf" value="([0-9a-f]+)"', body)
            check(f"[{label}] health: login form, noindex, no-store, DENY framing",
                  s == 200 and csrf and 'type="password"' in body and "noindex" in hd.get("X-Robots-Tag", "")
                  and "no-store" in hd.get("Cache-Control", "") and hd.get("X-Frame-Options") == "DENY")
            s, _, body = web.req("POST", "/api/availability-health.php", {"csrf": "0" * 32, "action": "login", "password": TEST_PASSWORD})
            check(f"[{label}] health: wrong CSRF token rejected", "Oturum süresi doldu" in body and "Booking.com</td>" not in body)
            s, _, body = web.req("POST", "/api/availability-health.php", {"csrf": csrf.group(1), "action": "login", "password": "wrong"})
            check(f"[{label}] health: wrong password rejected", "Hatalı parola" in body and "Booking.com</td>" not in body)
            s, _, body = web.req("GET", "/api/availability-health.php")
            csrf = re.search(r'name="csrf" value="([0-9a-f]+)"', body).group(1)
            s, _, body = web.req("POST", "/api/availability-health.php", {"csrf": csrf, "action": "login", "password": TEST_PASSWORD})
            rows = re.findall(r"<tr><td>([^<]+)</td>", body)
            check(f"[{label}] health after login: rows exactly Booking.com + Airbnb, 'Rezervasyon penceresi', no 'Sezon'",
                  rows == ["Booking.com", "Airbnb"] and "Rezervasyon penceresi" in body and "Sezon:" not in body, str(rows))
            s, _, body2 = web.req("POST", "/api/availability-health.php", {"csrf": csrf, "action": "sync"})
            check(f"[{label}] health 'Şimdi senkronize et' works", "Senkronizasyon tamamlandı" in body2)
            leak = re.search(r"127\.0\.0\.1:\d+|\.ics|\$2y\$|" + re.escape(TEST_PASSWORD), body + body2)
            check(f"[{label}] health shows no feed URL, hash or password", not leak, leak.group(0) if leak else "")
            noise += NOISE.findall(body + body2)

            # 5. Feed failures keep the last good data (fail-safe)
            for what, label2 in (("html", "malformed (HTML instead of ICS)"), ("500", "HTTP 500"), ("slow", "timeout")):
                MODE["booking"] = what
                rc, out = php_cli(php, str(docroot / "api/availability-sync.php"), "--force")
                st = json.loads(state_path(home).read_text())
                s, _, body = web.req("GET", "/api/availability.php")
                pub = json.loads(body)
                check(f"[{label}] Booking {label2} → error {st['feeds']['booking']['error']!r}, last good closures kept, still fresh",
                      st["feeds"]["booking"]["error"] and [(c["start"], c["end"]) for c in pub["closed"]] == exp and pub["status"] == "fresh")
            MODE["booking"] = "500"
            MODE["airbnb"] = "500"

            # 6. Stale ladder (feeds keep failing)
            def age(minutes):
                st = json.loads(state_path(home).read_text())
                for f in st["feeds"].values():
                    if f.get("last_success"):
                        f["last_success"] = int(time.time()) - minutes * 60
                st["last_run"] = int(time.time())
                state_path(home).write_text(json.dumps(st))
            settings = json.loads((docroot / "api/_lib/settings.json").read_text())["availability"]
            age(settings["stale_after_minutes"] + 5)
            check(f"[{label}] data older than stale_after → 'stale' (closures still shown)",
                  json.loads(web.req("GET", "/api/availability.php")[2])["status"] == "stale")
            age(settings["expire_after_minutes"] + 5)
            pub = json.loads(web.req("GET", "/api/availability.php")[2])
            check(f"[{label}] data older than expire_after → 'unavailable' (no free date shown)", pub["status"] == "unavailable")
        finally:
            web.stop()
        MODE.update(booking="booking.ics", airbnb="airbnb.ics")

        # 7. Missing / invalid secrets → fail-closed
        shutil.rmtree(home / "palmiye-secrets")
        write_secrets(home, ics_port, php, airbnb=False)
        rc, out = php_cli(php, str(docroot / "api/availability-sync.php"), "--force")
        web = Web(php, docroot)
        try:
            pub = json.loads(web.req("GET", "/api/availability.php")[2])
            check(f"[{label}] Airbnb secret missing → 'unavailable' (no Booking-only availability)", pub["status"] == "unavailable")
            shutil.rmtree(home / "palmiye-secrets")
            s, _, body = web.req("GET", "/api/availability.php")
            check(f"[{label}] no secret file at all → 200 'unavailable', no error output",
                  s == 200 and json.loads(body)["status"] == "unavailable" and not NOISE.search(body))
            s, _, body = web.req("GET", "/api/availability-health.php")
            check(f"[{label}] no admin hash → owner health 404", s == 404)
            # Telegram guards (placeholder token → never calls Telegram)
            write_secrets(home, ics_port, php)
            org = {"Origin": "https://palmiyehomekemer.com", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0 test"}
            t1 = web.req("GET", "/api/telegram-notify.php")[0]
            t2 = web.req("POST", "/api/telegram-notify.php", body='{"language":"tr","page":"/tr/"}',
                         headers={"Origin": "https://evil.example", "Content-Type": "application/json", "User-Agent": "Mozilla/5.0"})[0]
            t3, _, b3 = web.req("POST", "/api/telegram-notify.php", body='{"language":"tr","page":"/tr/"}', headers=org)
            check(f"[{label}] Telegram endpoint: GET 405, foreign origin 403, placeholder token → 204 silently (no send)",
                  (t1, t2, t3) == (405, 403, 204) and b3 == "" and not (home / "palmiye-secrets" / "telegram-state.json").exists())
        finally:
            web.stop()

        # 8. Secret file inside the web root is refused
        shutil.rmtree(home / "palmiye-secrets")
        inside = write_secrets(home, ics_port, php, where=docroot / "leaked.env.php")
        web = Web(php, docroot, env={"PALMIYE_SECRETS_FILE": str(inside)})
        try:
            s, _, body = web.req("GET", "/api/availability-health.php")
            pub = json.loads(web.req("GET", "/api/availability.php")[2])
            check(f"[{label}] secret file inside the web root is refused (health 404, calendar unavailable)",
                  s == 404 and pub["status"] == "unavailable")
        finally:
            web.stop()
            inside.unlink()

        check(f"[{label}] no PHP warning / notice / deprecation / stack trace in any output", not noise, str(noise[:5]))
        ics.shutdown()
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--php", action="append", required=True, help="php executable (repeatable)")
    ap.add_argument("--local-tls-no-verify", action="store_true", help="see module docstring (sandbox copy only)")
    a = ap.parse_args()
    for exe in a.php:
        exe_p = Path(exe)
        ini = exe_p.parent / "php.ini"
        if not ini.exists():
            ini = Path(tempfile.mkdtemp()) / "php.ini"
            ini.write_text(f'extension_dir="{(exe_p.parent / "ext").as_posix()}"\nextension=curl\nextension=openssl\nextension=mbstring\n')
        ver = subprocess.run([exe, "-c", str(ini), "-r", "echo PHP_VERSION;"], capture_output=True, text=True).stdout.strip()
        run_suite({"exe": exe, "ini": str(ini), "no_verify": a.local_tls_no_verify}, f"PHP {ver}")
    print(f"\n{sum(results)}/{len(results)} PHP server tests passed")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
