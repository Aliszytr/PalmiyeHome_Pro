"""Static checks for the Palmiye Home CLEAN MASTER.

Run from anywhere:  python tools/verify_master.py [--live D:\\ProjelerFinal\\CanliDosyalar]
Exit code 0 = all hard checks pass. Never prints secret values.
"""
import hashlib
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ["en", "tr", "de", "ru"]
DEPLOY_TEXT = [
    "index.html", "privacy.html", "404.html", "script.js", "analytics.js", "tracking.js",
    "booking-redirect.js", "assets/js/bookings-source.js", "data/bookings.js", "manifest.json",
    "sitemap.xml", "robots.txt", "admin/index.html", "api/telegram-notify.php",
] + [f"lang/{l}.json" for l in LANGS]
TOKEN = re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b")
DEFINE = re.compile(r"define\(\s*'(TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID)'\s*,\s*'([^']*)'")

results = []


def check(name, ok, detail="", hard=True):
    results.append((name, ok, detail, hard))


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8-sig") as fh:
        return fh.read()


def flat(o, p=""):
    r = {}
    if isinstance(o, dict):
        for k, v in o.items():
            r.update(flat(v, f"{p}.{k}" if p else k))
    else:
        r[p] = o
    return r


def git(*args):
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True).stdout


cfg = json.loads(read("config/site-config.json"))

# 1. Secret scan — every file git would see (tracked + untracked, not ignored)
files = [f for f in git("ls-files", "--cached", "--others", "--exclude-standard").splitlines() if f]
secret_hits = []
for f in files:
    p = os.path.join(ROOT, f)
    if not os.path.isfile(p) or os.path.splitext(f)[1].lower() in (".jpg", ".jpeg", ".png", ".webp", ".avif"):
        continue
    b = open(p, "rb").read().decode("utf-8", "ignore")
    real_define = [m for m in DEFINE.finditer(b) if m.group(2) and "_HERE" not in m.group(2)]
    if TOKEN.search(b) or real_define:
        secret_hits.append(f)
check("secret scan (repo-visible files)", not secret_hits, "SECRET DETECTED in: " + ", ".join(secret_hits) if secret_hits else f"{len(files)} files clean")

# 2-4. Forbidden claims / 9.6 / old prices in deployable text
claim_hits = []
for rel in DEPLOY_TEXT:
    t = read(rel)
    for c in cfg["forbidden_claims"]:
        if c in t:
            claim_hits.append(f"{rel}: '{c}'")
check("obsolete claim + 9.6 + old price scan (deployable files)", not claim_hits, "; ".join(claim_hits) or "0 hits")

# 5. Config facts present
idx = read("index.html")
check("Booking score 9.4 in badge", '<span class="score-number">9.4</span>' in idx)
check("schema has no starRating/aggregateRating/reviewCount",
      not re.search(r"starRating|aggregateRating|reviewCount", idx))
for l in LANGS:
    d = flat(json.loads(read(f"lang/{l}.json")))
    check(f"[{l}] check-in 14:00–23:00", "14:00–23:00" in d.get("apartment.checkin", ""))
    check(f"[{l}] check-out 11:00", "11:00" in d.get("apartment.checkout", ""))
check("privacy.html check-in 14:00 → 23:00 (4 languages)", read("privacy.html").count("23:00") == 4)

# 6. Language-key consistency
used = set(re.findall(r'data-i18n(?:-more|-less)?="([^"]+)"', idx)) | {"calendar.whatsapp_message"}
en = flat(json.loads(read("lang/en.json")))
html_default_only = {"cookie.message", "cookie.privacy_link"}
missing_en = sorted(used - set(en) - html_default_only)
check("EN covers every key used by index.html", not missing_en, ", ".join(missing_en))
backlog = {}
for l in LANGS[1:]:
    d = flat(json.loads(read(f"lang/{l}.json")))
    backlog[l] = sorted(used - set(d) - html_default_only)
    extra = sorted(k for k in d if k not in used and not k.startswith("meta."))
    check(f"[{l}] no orphan keys", not extra, ", ".join(extra))
    check(f"[{l}] translation backlog (falls back to EN)", True, f"{len(backlog[l])} keys: " + ", ".join(backlog[l]), hard=False)
for l in LANGS:
    d = flat(json.loads(read(f"lang/{l}.json")))
    bad = [k for k, v in d.items() if isinstance(v, str) and re.search(r"\{(start|end)\}", v) and k != "calendar.whatsapp_message"]
    check(f"[{l}] calendar.whatsapp_message has {{start}} and {{end}}",
          "{start}" in d.get("calendar.whatsapp_message", "") and "{end}" in d.get("calendar.whatsapp_message", "") and not bad)
inline_ok = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "gen_inline_langs.py"), "--check"]).returncode == 0
check("INLINE_LANGS in sync with lang/*.json", inline_ok)

# 7. Broken internal links / anchors
missing_files, missing_anchors = [], []
ids = set(re.findall(r'\bid="([^"]+)"', idx))
for page in ["index.html", "privacy.html", "404.html", "admin/index.html", "style.css", "manifest.json"]:
    t = read(page)
    base = os.path.dirname(page)
    for ref in re.findall(r"""(?:src|href)=["']([^"']+)["']|url\(['"]?([^'")]+)['"]?\)|"src":\s*"([^"]+)\"""", t):
        ref = next(r for r in ref if r)
        if re.match(r"^(https?:|mailto:|tel:|data:|//|javascript:)", ref):
            continue
        if ref.startswith("#"):
            if page == "index.html" and ref != "#" and ref[1:] not in ids:
                missing_anchors.append(ref)
            continue
        path = ref.split("#")[0].split("?")[0]
        if not path:
            continue
        full = os.path.normpath(os.path.join(ROOT, path.lstrip("/")) if path.startswith("/") else os.path.join(ROOT, base, path))
        if not os.path.exists(full):
            missing_files.append(f"{page} -> {ref}")
check("internal file references resolve", not missing_files, "; ".join(missing_files))
check("in-page anchors resolve", not missing_anchors, ", ".join(sorted(set(missing_anchors))))

# 8. JSON validity
for rel in [f"lang/{l}.json" for l in LANGS] + ["manifest.json", "config/site-config.json"]:
    try:
        json.loads(read(rel))
        check(f"valid JSON: {rel}", True)
    except ValueError as e:
        check(f"valid JSON: {rel}", False, str(e))

# 9. Booking / Airbnb / WhatsApp presence
check("Booking.com links present", idx.count(cfg["platforms"]["booking"]) >= 6, f"{idx.count(cfg['platforms']['booking'])} links")
check("Airbnb links present", idx.count(cfg["platforms"]["airbnb"]) >= 4, f"{idx.count(cfg['platforms']['airbnb'])} links")
check("WhatsApp links present", idx.count("wa.me/" + cfg["contact"]["whatsapp_e164"]) >= 10,
      f"{idx.count('wa.me/' + cfg['contact']['whatsapp_e164'])} links")

# 10. Ads / GA4 tag preservation
t = cfg["tracking"]
trk = read("tracking.js")
for k, v in t["ads_conversion_labels"].items():
    check(f"tracking.js keeps production label for {k}", f"{k}: '{v}'" in trk.replace("  ", " ") or v in trk)
for page in ["index.html", "privacy.html", "404.html"]:
    check(f"{page}: gtag {t['google_ads_id']} + Consent Mode default", t["google_ads_id"] in read(page) and "'consent', 'default'" in read(page))
check("index.html: GA4 config", t["ga4_measurement_id"] in idx)
live = None
if "--live" in sys.argv:
    live = sys.argv[sys.argv.index("--live") + 1]
if live:
    def norm(p):
        return hashlib.sha256(open(p, "rb").read().replace(b"\r\n", b"\n")).hexdigest()
    for rel in ["analytics.js", "tracking.js", "booking-redirect.js", "data/bookings.js", "style.css", ".htaccess"]:
        check(f"{rel} identical to LIVE (content)", norm(os.path.join(ROOT, rel)) == norm(os.path.join(live, rel)))

# 11. Telegram: no per-visitor files, no secret inside web root
php = read("api/telegram-notify.php")
check("telegram: no REMOTE_ADDR use", "REMOTE_ADDR" not in php)
check("telegram: no per-visitor lock files", ".lock" not in php and "config/tmp" not in php)
check("telegram: secret not read from api/config", "/config/.env.php" not in php)
check("telegram: no Markdown parse_mode", "parse_mode" not in php)
check("telegram client: no screen size / client timestamp", "screenSize" not in read("script.js") and "timestamp:" not in read("script.js"))

# 12. Repo cleanliness
tracked = git("ls-files").splitlines()
bad_tracked = [f for f in tracked if re.search(r"(^|/)\.env\.php$|^publish/|/tmp/|\.lock$|error_log$|desktop\.ini$", f)]
check("no secret/publish/runtime files tracked", not bad_tracked, ", ".join(bad_tracked))
ign = git("check-ignore", "publish/api/config/.env.php", "api/config/.env.php", "publish/x")
check(".gitignore covers publish/ and .env.php", ign.count("\n") >= 3)

fails = [r for r in results if r[3] and not r[1]]
for name, ok, detail, hard in results:
    flag = "PASS" if ok else ("FAIL" if hard else "WARN")
    print(f"[{flag}] {name}" + (f" — {detail}" if detail else ""))
print(f"\n{len(results) - len(fails)}/{len(results)} checks passed, {len(fails)} hard failures")
sys.exit(1 if fails else 0)
