"""Palmiye Home V2 — static verification of the generated site (stdlib only).

python v2/tools/verify_v2.py   → prints every check, exit 1 on any FAIL
"""
import json
import re
import subprocess
import sys
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
SECRET = re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|api\.telegram\.org/bot\d|define\('TELEGRAM_BOT_TOKEN',\s*'(?!YOUR_)")
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
order = [idx.find(x) for x in ("googletagmanager.com/gtag/js", "'consent','default'", "'config','AW-", "'config','G-")]
check("<head> order: gtag.js → consent default (denied) → config AW → config GA4", all(o > 0 for o in order) and order == sorted(order), str(order))
check("consent default denies all four types", all(f"{k}:'denied'" in idx for k in ("ad_storage", "ad_user_data", "ad_personalization", "analytics_storage")))
track_js = (PUB / "assets/js/track.js").read_text(encoding="utf-8")
check("event taxonomy present (5 events) and review click has no conversion",
      all(e in track_js for e in ("whatsapp_click", "booking_click", "airbnb_click", "booking_review_click", "availability_check"))
      and "booking_review_click: " not in track_js.split("CONVERSION_FOR")[1].split("}")[0])

php = (PUB / "api/telegram-notify.php").read_text(encoding="utf-8")
check("Telegram endpoint: no REMOTE_ADDR, no per-visitor files, secret outside web root",
      "REMOTE_ADDR" not in php and "md5(" not in php and "palmiye-secrets" in php and "Refused: secret file is inside the document root" in php)
check("Telegram client sends only language/device/page/referrer",
      "body = JSON.stringify({ language: D.lang, device: device, page: location.pathname, referrer: ref })" in track_js
      and "screen." not in track_js and "userAgent" not in track_js.split("notifyVisit")[1].split("JSON.stringify")[1])

failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
sys.exit(1 if failed else 0)
