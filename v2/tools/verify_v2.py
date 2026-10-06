"""Palmiye Home V2 — static verification of the generated site (stdlib only).

python v2/tools/verify_v2.py   → prints every check, exit 1 on any FAIL
"""
import json
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

V2 = Path(__file__).resolve().parents[1]
REPO = V2.parent
PUB = V2 / "public"
CONFIG = json.loads((REPO / "config" / "site-config.json").read_text(encoding="utf-8"))
LANGS = CONFIG["site"]["languages"]

results = []


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail else ""))


# 1. Build + images up to date ------------------------------------------------
r = subprocess.run([sys.executable, str(V2 / "tools" / "build_site.py"), "--check"], capture_output=True, text=True)
check("build output up to date (build_site.py --check)", r.returncode == 0, r.stdout.strip().splitlines()[-1] if r.stdout else r.stderr[-200:])
r = subprocess.run([sys.executable, str(V2 / "tools" / "build_images.py"), "--verify"], capture_output=True, text=True)
check("images: sources unchanged, variants present, no EXIF/GPS/ICC/XMP metadata", r.returncode == 0, r.stdout.strip().replace("\n", " | "))

# 2. Text scans ---------------------------------------------------------------
TEXT_EXT = {".html", ".js", ".json", ".xml", ".txt", ".php", ".css", ".htaccess", ""}
pub_text = {p: p.read_text(encoding="utf-8", errors="replace") for p in PUB.rglob("*")
            if p.is_file() and (p.suffix in TEXT_EXT or p.name == ".htaccess")}
src_text = {p: p.read_text(encoding="utf-8", errors="replace") for p in (V2 / "src").rglob("*")
            if p.is_file() and p.suffix in {".html", ".js", ".json", ".css", ".php"}}
# Guest quotes are verbatim third-party text; claims rules apply to our own copy.
REVIEW_TEXTS = [i["text"] for i in CONFIG["guest_reviews"]["items"]]


def strip_reviews(s):
    for t in REVIEW_TEXTS:
        s = s.replace(t, "").replace(t.replace("'", "&#x27;"), "")
    return s


forbidden = list(CONFIG["forbidden_claims"]) + [
    "five minutes", "5 minutes", "best price guaranteed", "Best Price Guaranteed", "June–November", "June-November",
    "Haziran–Kasım", "Haziran-Kasım", "Juni–November", "июнь–ноябрь", "Cirali", "Çıralı", "★", "⭐",
    "aggregateRating", "reviewCount", "starRating", "Green dates are available", "Yeşil tarihler müsait",
    "Message Queue", "fonts.googleapis.com", "fonts.gstatic.com", "unpkg.com", "lucide",
    # 2027 QA revision: manual calendar is gone, no device class, no admin-style public button
    "bookings.js", "PALMIYE_BOOKINGS", "Calendar last updated", "Takvimin son güncellenmesi", "Kalender zuletzt aktualisiert",
    "Календарь обновлён", "updated manually", "elle güncellenir", "von Hand aktualisiert", "обновляется вручную",
    "Rezervasyon tarihlerini güncelle", "guests love", "misafirler bayılıyor",
]
hits = []
for p, s in list(pub_text.items()) + list(src_text.items()):
    s2 = strip_reviews(s)
    for f in forbidden:
        if f in s2:
            hits.append(f"{p.relative_to(REPO)}: {f!r}")
check(f"forbidden claims / third-party scan ({len(forbidden)} patterns, public + src)", not hits, "; ".join(hits[:12]))

nine_six = [str(p.relative_to(REPO)) for p, s in list(pub_text.items()) + list(src_text.items()) if re.search(r"9[.,]6\b", s)]
check("no 9.6 / 9,6 anywhere in V2", not nine_six, ", ".join(nine_six))

# Secrets: Telegram bot token pattern, filled env values, private keys — whole V2 tree + tracked repo files
SECRET = re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|api\.telegram\.org/bot\d|define\('TELEGRAM_BOT_TOKEN',\s*'(?!YOUR_)"
                    # private iCal export URLs (Booking / Airbnb / Google Calendar secret address)
                    r"|admin\.booking\.com/hotel/hoteladmin/ical|airbnb\.[a-z.]+/calendar/ical/\d|calendar\.google\.com/calendar/ical/[^\s'\"]+/private-"
                    r"|define\('PALMIYE_ICAL_[A-Z]+',\s*'https?://|\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}")
tracked = subprocess.run(["git", "ls-files"], cwd=REPO, capture_output=True, text=True).stdout.split("\n")
scan = set(p for p in V2.rglob("*") if p.is_file() and ".mock" not in p.parts and p.suffix not in {".avif", ".webp", ".jpg", ".png"})
scan |= set(REPO / t for t in tracked if t and Path(t).suffix not in {".avif", ".webp", ".jpg", ".jpeg", ".png", ".zip", ".ico", ".heic"})
sec_hits = []
for p in scan:
    try:
        if SECRET.search(p.read_text(encoding="utf-8", errors="ignore")):
            sec_hits.append(str(p.relative_to(REPO)))
    except OSError:
        pass
check(f"secret scan ({len(scan)} files: V2 tree + git-tracked files)", not sec_hits, ", ".join(sec_hits))
check("no real secret file inside v2/public", not any(p.name == ".env.php" for p in PUB.rglob("*")))


# 3. HTML structure ---------------------------------------------------------------
class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.imgs, self.refs, self.anchors, self.h1, self.tags = [], [], [], [], 0, []
        self.meta, self.links, self.lang = {}, [], None
        self.in_title, self.title = False, ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        self.tags.append(tag)
        if tag == "html":
            self.lang = a.get("lang")
        if "id" in a:
            self.ids.append(a["id"])
        if tag == "h1":
            self.h1 += 1
        if tag == "title":
            self.in_title = True
        if tag == "img":
            self.imgs.append(a)
        if tag == "meta":
            self.meta[a.get("name") or a.get("property") or ""] = a.get("content", "")
        if tag == "link":
            self.links.append(a)
        for k in ("src", "href"):
            if k in a and a[k]:
                self.refs.append(a[k])
        for k in ("srcset", "imagesrcset"):
            if a.get(k):
                self.refs += [c.strip().split(" ")[0] for c in a[k].split(",")]
        if tag == "a" and a.get("href", "").startswith("#"):
            self.anchors.append(a["href"][1:])

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, d):
        if self.in_title:
            self.title += d


pages = sorted(PUB.rglob("*.html"))
problems = {k: [] for k in ("dup_id", "alt", "dims", "missing", "anchor", "h1", "lazy", "seo")}
for path in pages:
    rel = str(path.relative_to(PUB))
    pg = Page()
    pg.feed(path.read_text(encoding="utf-8"))
    dups = {i for i in pg.ids if pg.ids.count(i) > 1}
    if dups:
        problems["dup_id"].append(f"{rel}: {sorted(dups)}")
    if pg.h1 != 1:
        problems["h1"].append(f"{rel}: {pg.h1}")
    for img in pg.imgs:
        if "data-lb-img" in img:
            continue
        if not img.get("alt"):
            problems["alt"].append(f"{rel}: {img.get('src')}")
        if not (img.get("width") and img.get("height")):
            problems["dims"].append(f"{rel}: {img.get('src')}")
        hero = "hero-img" in (img.get("class") or "")
        if hero and (img.get("loading") == "lazy" or img.get("fetchpriority") != "high"):
            problems["lazy"].append(f"{rel}: hero must be eager + fetchpriority=high")
        if not hero and img.get("loading") != "lazy":
            problems["lazy"].append(f"{rel}: {img.get('src')} not lazy")
    for ref in pg.refs:
        u = urlsplit(ref)
        if u.scheme or ref.startswith(("mailto:", "data:", "#")) or ref.startswith("//"):
            continue
        target = PUB / unquote(u.path).lstrip("/")
        if u.path.endswith("/"):
            target = target / "index.html"
        if not target.exists():
            problems["missing"].append(f"{rel}: {ref}")
    for an in pg.anchors:
        if an and an not in pg.ids:
            problems["anchor"].append(f"{rel}: #{an}")
    if rel != "404.html":
        need = ["description"]
        if "privacy" not in rel:
            need += ["og:title", "og:description", "og:image", "og:url"]
        miss = [n for n in need if not pg.meta.get(n)]
        canon = [l for l in pg.links if l.get("rel") == "canonical"]
        alts = {l.get("hreflang") for l in pg.links if l.get("rel") == "alternate"}
        if miss or not canon or alts != set(LANGS) | {"x-default"}:
            problems["seo"].append(f"{rel}: missing {miss} canonical={bool(canon)} hreflang={sorted(a for a in alts if a)}")
        if not (10 <= len(pg.title) <= 70):
            problems["seo"].append(f"{rel}: title length {len(pg.title)}")
        if not (50 <= len(pg.meta.get("description", "")) <= 170):
            problems["seo"].append(f"{rel}: description length {len(pg.meta.get('description', ''))}")
    if pg.lang not in LANGS:
        problems["seo"].append(f"{rel}: html lang={pg.lang}")

check(f"no duplicate IDs ({len(pages)} pages)", not problems["dup_id"], "; ".join(problems["dup_id"]))
check("exactly one <h1> per page", not problems["h1"], "; ".join(problems["h1"]))
check("every <img> has alt text", not problems["alt"], "; ".join(problems["alt"][:5]))
check("every <img> has width/height (CLS)", not problems["dims"], "; ".join(problems["dims"][:5]))
check("hero eager + fetchpriority=high, all other images lazy", not problems["lazy"], "; ".join(problems["lazy"][:5]))
check("no missing local assets / broken internal links", not problems["missing"], "; ".join(problems["missing"][:8]))
check("all in-page #anchors resolve", not problems["anchor"], "; ".join(problems["anchor"][:8]))
check("SEO head: title/description length, canonical, hreflang (4 + x-default), OG", not problems["seo"], "; ".join(problems["seo"][:6]))

# 4. i18n parity ----------------------------------------------------------------
def shape(node, prefix=""):
    if isinstance(node, dict):
        out = set()
        for k, v in node.items():
            out |= shape(v, f"{prefix}.{k}" if prefix else k)
        return out
    if isinstance(node, list):
        out = {f"{prefix}[len={len(node)}]"}
        for i, v in enumerate(node):
            out |= shape(v, f"{prefix}[{i}]")
        return out
    return {prefix}


i18n = {l: json.loads((V2 / "src" / "i18n" / f"{l}.json").read_text(encoding="utf-8")) for l in LANGS}
base = shape(i18n["en"])
diff = {l: sorted(base ^ shape(i18n[l]))[:5] for l in LANGS if shape(i18n[l]) != base}
check("i18n: EN/TR/DE/RU have identical key structure", not diff, json.dumps(diff, ensure_ascii=False))
leftover = []
for path in pages:
    html_text = path.read_text(encoding="utf-8")
    body = re.sub(r'<script type="application/json" id="site-data">.*?</script>', "", html_text, flags=re.S)
    for m in re.findall(r"\{(score|checkin|checkin_from|checkin_until|checkout|max_guests|unit|email|build_date)\}", body):
        leftover.append(f"{path.relative_to(PUB)}: {{{m}}}")
check("no unfilled build placeholders in pages", not leftover, "; ".join(leftover[:5]))

# 5. Config consistency + tracking continuity --------------------------------------
t = CONFIG["tracking"]
cons = []
for lang in LANGS:
    p = PUB / ("index.html" if lang == "en" else f"{lang}/index.html")
    s = p.read_text(encoding="utf-8")
    score = CONFIG["ratings"]["booking"]["score"]
    if score not in s and score.replace(".", ",") not in s:
        cons.append(f"{lang}: score")
    for v in (CONFIG["policies"]["checkin"], CONFIG["policies"]["checkout"], CONFIG["platforms"]["booking"], CONFIG["platforms"]["airbnb"], CONFIG["contact"]["whatsapp_e164"]):
        if v not in s:
            cons.append(f"{lang}: {v}")
check("index pages carry config values (score, check-in/out, platform URLs, WhatsApp)", not cons, "; ".join(cons))

ids_found = set()
for s in pub_text.values():
    ids_found |= set(re.findall(r"\bAW-\d{6,}\b|\bG-[A-Z0-9]{8,}\b", s))
check("only production Google IDs present (AW-17307806485, G-6NK46VG4DY)", ids_found == {t["google_ads_id"], t["ga4_measurement_id"]}, str(sorted(ids_found)))
labels_found = set()
for s in pub_text.values():
    for m in re.findall(r'"ads_conversion_labels":(\{[^}]*\})', s):
        labels_found.add(json.dumps(json.loads(m), sort_keys=True))
check("Ads conversion labels in pages == config (Set B)", labels_found == {json.dumps(t["ads_conversion_labels"], sort_keys=True)}, str(labels_found))
idx = (PUB / "index.html").read_text(encoding="utf-8")
track_js = (PUB / "assets/js/track.js").read_text(encoding="utf-8")
if CONFIG["site"]["consent_mode"] == "basic":
    head = idx.split("</head>")[0]
    loader = track_js.split("function loadTagIfBasic")[1].split("function clearGoogleCookies")[0]
    lo = [loader.find(x) for x in ("gtagSafe('config', T.google_ads_id)", "gtagSafe('config', T.ga4_measurement_id)", "googletagmanager.com/gtag/js")]
    check("BASIC consent: no gtag.js in any HTML; consent default set inline; tag + config AW → GA4 injected only after Accept",
          not any("googletagmanager.com/gtag/js" in t_ for p_, t_ in pub_text.items() if p_.suffix == ".html")
          and "'consent','default'" in head and all(o > 0 for o in lo) and lo == sorted(lo)
          and "var sent = !BASIC || consented();" in track_js, str(lo))
else:
    order = [idx.find(x) for x in ("googletagmanager.com/gtag/js", "'consent','default'", "'config','AW-", "'config','G-")]
    check("<head> order: gtag.js → consent default (denied) → config AW → config GA4", all(o > 0 for o in order) and order == sorted(order), str(order))
check("consent default denies all four types", all(f"{k}:'denied'" in idx for k in ("ad_storage", "ad_user_data", "ad_personalization", "analytics_storage")))
conv_map = track_js.split("var CONVERSION_FOR = ")[1].split("}")[0]
check("event taxonomy present; only whatsapp/booking/airbnb clicks are Ads conversions (review clicks never)",
      all(e in track_js for e in ("whatsapp_click", "booking_click", "airbnb_click", "booking_review_click", "availability_check", "review_source_click"))
      and set(re.findall(r"(\w+_click):", conv_map)) == {"whatsapp_click", "booking_click", "airbnb_click"})
review_links_ok = True
for lang in LANGS:
    s_ = (PUB / ("index.html" if lang == "en" else f"{lang}/index.html")).read_text(encoding="utf-8")
    for m in re.finditer(r'<a [^>]*href="([^"]+)"[^>]*>', s_):
        tag, href = m.group(0), m.group(1)
        if "#tab-reviews" in href and 'data-track="booking_review_click"' not in tag:
            review_links_ok = False
        if 'data-cta="reviews"' in tag and re.search(r'data-track="(booking|airbnb|whatsapp)_click"', tag):
            review_links_ok = False
check("every review link is tagged as a review click, none as a booking conversion", review_links_ok)

php = (PUB / "api/telegram-notify.php").read_text(encoding="utf-8")
geo = (PUB / "api/_lib/geo.php").read_text(encoding="utf-8")
boot = (PUB / "api/_lib/bootstrap.php").read_text(encoding="utf-8")
server_php = {p_.relative_to(PUB).as_posix(): p_.read_text(encoding="utf-8") for p_ in (PUB / "api").rglob("*.php")}
ip_users = sorted(k for k, v in server_php.items() if "REMOTE_ADDR" in v)
geo_body = geo.split("function palmiye_approx_location")[1]
check("Telegram: IP read only inside api/_lib/geo.php, local lookup only, discarded; never written/logged/sent",
      ip_users == ["api/_lib/geo.php"]
      and not re.search(r"file_put_contents|fwrite|error_log|curl_|file_get_contents\(\s*'http", geo_body)
      and "$ip = null;" in geo_body and "HTTP_X_FORWARDED_FOR" not in geo
      and "$ip" not in php and "REMOTE_ADDR" not in php, str(ip_users))
check("Telegram: no per-visitor files, one anonymous debounce state, 1/min + 20/h, '+N' summary, secret outside web root",
      "md5(" not in php and "$MIN_INTERVAL_SEC  = 60" in php and "$MAX_PER_HOUR      = 20" in php and "$suppressedBefore . ' ziyaret daha" in php
      and "palmiye-secrets" in boot and "Refused: secret file is inside the document root" in boot)
check("Telegram client sends only language/page/referrer host (no device class, screen, UA)",
      "body = JSON.stringify({ language: D.lang, page: location.pathname, referrer: ref })" in track_js
      and "device" not in track_js.split("function notifyVisit")[1] and "screen." not in track_js
      and "'device'" not in php)

# 6. 2027 QA revision rules -----------------------------------------------------------
manifest = json.loads((V2 / "src" / "assets-manifest.json").read_text(encoding="utf-8"))
hero = next(e for e in manifest["images"] if e["slug"] == "hero-pool-mountain")
check("hero = new natural IMG_0167 retouch (old clouded version 362887… not used)",
      hero["source"]["sha256"] != "362887a55fbe911f36c5cc6eaf299b7af2d2830fb0dd7a978f03ef554f761f96")
check("hero CTA scrolls to the on-page availability section (not to Booking.com)",
      all('href="#availability" data-track="availability_check" data-cta="hero"' in (PUB / ("index.html" if l == "en" else f"{l}/index.html")).read_text(encoding="utf-8") for l in LANGS))
check("root page: no forced language redirect (only explicit legacy ?lang=)",
      "navigator.language" not in idx.split("</head>")[0] and "palmiye_lang" not in idx.split("</head>")[0]
      and "data-lang-suggest" in idx)
check("legacy data/bookings.js is not a V2 dependency (no file, no reference)",
      not (PUB / "data" / "bookings.js").exists() and not any("bookings.js" in t_ for t_ in pub_text.values()))
av_php = (PUB / "api/_lib/availability.php").read_text(encoding="utf-8")
av_pub = (PUB / "api/availability.php").read_text(encoding="utf-8")
check("availability engine: endpoint + cron + owner health present; library not web-accessible; secrets only via palmiye_secret()",
      all((PUB / f).exists() for f in ("api/availability.php", "api/availability-sync.php", "api/availability-health.php", "api/_lib/settings.json", "api/_lib/.htaccess"))
      and "Require all denied" in (PUB / "api/_lib/.htaccess").read_text()
      and "RewriteRule ^api/availability\\.json$ /api/availability.php" in (PUB / ".htaccess").read_text()
      and "palmiye_secret('PALMIYE_ICAL_BOOKING')" in av_php and "PHP_SAPI !== 'cli'" in (PUB / "api/availability-sync.php").read_text())
pub_fn = av_php.split("function palmiye_av_public")[1].split("function palmiye_av_health")[0]
pub_keys = re.findall(r"'(\w+)'\s+=>", pub_fn.split("return array(")[-1])
check("availability public JSON: only version / status / last sync / season / closed ranges (no SUMMARY, DESCRIPTION, UID, price)",
      "'SUMMARY'" not in av_php and "'DESCRIPTION'" not in av_php and "'UID'" not in av_php
      and pub_keys == ["version", "status", "last_successful_sync", "season", "start", "end", "closed", "ranges"], str(pub_keys))
r = subprocess.run([sys.executable, str(V2 / "tools" / "test_availability.py")], capture_output=True, text=True, encoding="utf-8", errors="replace")
check("availability fail-safe tests (Python reference engine)", r.returncode == 0, (r.stdout.strip().splitlines() or ["?"])[-1])
check("production season is not invented (config availability.season stays null until Ali sets it)",
      CONFIG["availability"]["season"]["start"] is None or bool(re.match(r"^\d{4}-\d{2}-\d{2}$", CONFIG["availability"]["season"]["start"])))
excerpt_ok = all(seg in r_["text"] for r_ in CONFIG["guest_reviews"]["items"] for seg in r_["excerpt"])
google_ok = True
for it in CONFIG["platform_reviews"]["items"]:
    if not it.get("text"):
        for lang in LANGS:
            s_ = (PUB / ("index.html" if lang == "en" else f"{lang}/index.html")).read_text(encoding="utf-8")
            card = s_.split('class="review-source rs-google"')[1].split("</article>")[0]
            if "<blockquote" in card or 'class="rs-text"' in card:
                google_ok = False
check("reviews: excerpts are verbatim; a rating without text (Google · Hamza Konak 5/5) shows no invented text", excerpt_ok and google_ok)
check("Google Business: no invented profile URL (null until verified) — Maps links use documented search/directions URLs",
      (CONFIG["google_business"]["profile_url"] is None and "google.com/maps/search/?api=1" in idx and "google.com/maps/dir/?api=1" in idx)
      or bool(CONFIG["google_business"]["profile_url"]))
check("Turkey logic: all three channels always present; TR order + note via time zone only (no IP, no geo API)",
      all(f'data-channel-item="{c}"' in idx for c in ("booking", "airbnb", "whatsapp")) and "data-tr-note" in idx
      and "resolvedOptions().timeZone" in (PUB / "assets/js/site.js").read_text(encoding="utf-8")
      and CONFIG["market"]["channel_order"]["tr"] == ["whatsapp", "airbnb", "booking"]
      and CONFIG["market"]["channel_order"]["intl"] == ["booking", "airbnb", "whatsapp"])

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
