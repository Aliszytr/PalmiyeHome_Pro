"""Palmiye Home V2 — static site builder (no dependencies beyond the Python stdlib).

Single sources:
  config/site-config.json     business facts, links, tracking IDs, consent mode
  v2/src/i18n/<lang>.json      every visible text, per language
  v2/src/assets-manifest.json  image variants (from build_images.py)
  v2/src/templates/*.html      page markup
  v2/src/server/               PHP endpoints (Telegram notice, availability engine) + .htaccess
  v2/tests/fixtures/           invented iCal fixtures for the server self-test — NOT deployed in the
                               web root (package_release.py ships them in deployment/selftest-fixtures)

Output: v2/public/  (the complete deploy root; nothing outside it is needed)

Usage:
  python v2/tools/build_site.py           # build
  python v2/tools/build_site.py --check   # fail if v2/public is out of date
"""
import hashlib
import html
import json
import re
import shutil
import sys
from datetime import date
from pathlib import Path
from urllib.parse import quote, urlencode

V2 = Path(__file__).resolve().parents[1]
REPO = V2.parent
SRC = V2 / "src"
OUT = V2 / "public"

CONFIG = json.loads((REPO / "config" / "site-config.json").read_text(encoding="utf-8"))
MANIFEST = json.loads((SRC / "assets-manifest.json").read_text(encoding="utf-8"))
LANGS = CONFIG["site"]["languages"]
I18N = {l: json.loads((SRC / "i18n" / f"{l}.json").read_text(encoding="utf-8")) for l in LANGS}
BASE = CONFIG["site"]["base_url"].rstrip("/")
BUILD_DATE = (SRC / "BUILD_DATE").read_text().strip() if (SRC / "BUILD_DATE").exists() else date.today().isoformat()

IMAGES = {e["slug"]: e for e in MANIFEST["images"]}

# Order used by the gallery grid and the lightbox (hero excluded from the grid).
GALLERY = ["living-room", "living-kitchen", "kitchen", "kitchen-entrance", "bedroom", "bedroom-wardrobe",
           "bathroom", "bathroom-laundry", "aerial-pool", "exterior-pool", "pool-palms-house",
           "pool-garden-mountain", "pool-loungers", "house-mountain", "terrace-seating", "terrace-pool",
           "garden", "hero-pool-mountain"]
# Visible grid tiles: (slug, css class)
GRID = [("aerial-pool", "wide"), ("living-kitchen", "tall"), ("kitchen", ""), ("bedroom-wardrobe", ""),
        ("pool-palms-house", "tall"), ("bathroom", ""), ("terrace-pool", "wide"), ("exterior-pool", "")]

ICONS = {
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "chevron-right": '<path d="M9 18l6-6-6-6"/>',
    "check": '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    "home": '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    "users": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>',
    "waves": '<path d="M2 8c2-1.5 3.5-1.5 5 0s3 1.5 5 0 3.5-1.5 5 0 3 1.5 5 0"/><path d="M2 13c2-1.5 3.5-1.5 5 0s3 1.5 5 0 3.5-1.5 5 0 3 1.5 5 0"/><path d="M2 18c2-1.5 3.5-1.5 5 0s3 1.5 5 0 3.5-1.5 5 0 3 1.5 5 0"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "key": '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
    "snowflake": '<path d="M12 2v20M4 6.5l16 11M20 6.5l-16 11"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
    "wifi": '<path d="M2 9a15 15 0 0120 0M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0"/><circle cx="12" cy="19" r="1"/>',
    "tv": '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/>',
    "utensils": '<path d="M6 2v8a2 2 0 002 2v10M10 2v8M8 2v6"/><path d="M17 22V2c-2 1-3 4-3 8h3"/>',
    "washer": '<rect x="4" y="2.5" width="16" height="19" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M8 6h.01M11 6h.01"/>',
    "wind": '<path d="M3 8h11a3 3 0 10-3-3"/><path d="M3 12h15a3 3 0 11-3 3"/><path d="M3 16h7"/>',
    "baby": '<circle cx="12" cy="6" r="3"/><path d="M8 21v-5l-3-3M16 21v-5l3-3M8 13h8"/>',
    "car": '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M3 16h18v3H3z"/><circle cx="7.5" cy="13" r=".8"/><circle cx="16.5" cy="13" r=".8"/>',
    "camera": '<path d="M3 7h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="3.5"/>',
    "pin": '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    "chat": '<path d="M4 20l1.4-4.2A8 8 0 1112 20a8.2 8.2 0 01-3.8-.9z"/>',
    "external": '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
    "route": '<circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="5" r="2.2"/><path d="M8.2 19H15a3.5 3.5 0 000-7H9a3.5 3.5 0 010-7h6.8"/>',
    "star": '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor" stroke="none"/>',
    "grid": '<rect x="3" y="3" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1"/>',
}


def sprite():
    symbols = "".join(f'<symbol id="i-{k}" viewBox="0 0 24 24">{v}</symbol>' for k, v in ICONS.items())
    return f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{symbols}</svg>'


def icon(name):
    if name not in ICONS:
        raise KeyError(f"unknown icon {name}")
    return f'<svg class="icon" aria-hidden="true"><use href="#i-{name}"/></svg>'


# ── Facts reachable as {placeholders} inside any i18n string ──────────────
def facts():
    ci = CONFIG["policies"]["checkin"]
    frm, until = [p.strip() for p in re.split(r"[–-]", ci)]
    return {
        "score": CONFIG["ratings"]["booking"]["score"],
        "checkin": ci,
        "checkin_from": frm,
        "checkin_until": until,
        "checkout": CONFIG["policies"]["checkout"],
        "max_guests": str(CONFIG["property"]["max_guests"]),
        "unit": CONFIG["property"]["unit"],
        "email": CONFIG["contact"]["email"],
        "build_date": BUILD_DATE,
    }


FACTS = facts()
# Locale-aware number formatting for the score (9.4 → 9,4 in TR/DE).
DECIMAL_COMMA = {"tr", "de", "ru"}


def fill(s, lang, extra=None):
    vals = dict(FACTS)
    if lang in DECIMAL_COMMA:
        vals["score"] = vals["score"].replace(".", ",")
    if extra:
        vals.update(extra)
    for k, v in vals.items():
        s = s.replace("{" + k + "}", v)
    return s


def lookup(lang, key):
    node = I18N[lang]
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            raise KeyError(f"[{lang}] missing i18n key: {key}")
        node = node[part]
    return node


def text(lang, key):
    return fill(lookup(lang, key), lang)


def esc(s):
    return html.escape(s, quote=True)


# ── Images ───────────────────────────────────────────────────────────────
def srcset(slug, fmt):
    vs = [v for v in IMAGES[slug]["variants"] if v["format"] == fmt]
    return ", ".join(f'/{v["file"]} {v["width"]}w' for v in vs)


def fallback(slug):
    return next(v for v in IMAGES[slug]["variants"] if v["format"] == "jpg")


def picture(slug, sizes, lang, cls="", eager=False):
    fb = fallback(slug)
    alt = esc(text(lang, f"alt.{slug}"))
    load = 'fetchpriority="high" decoding="async"' if eager else 'loading="lazy" decoding="async"'
    c = f' class="{cls}"' if cls else ""
    return (f'<picture><source type="image/avif" srcset="{srcset(slug, "avif")}" sizes="{sizes}">'
            f'<source type="image/webp" srcset="{srcset(slug, "webp")}" sizes="{sizes}">'
            f'<img src="/{fb["file"]}" width="{fb["width"]}" height="{fb["height"]}" alt="{alt}"{c} {load}></picture>')


def hero_picture(lang):
    land, port = "hero-pool-mountain", "hero-pool-mountain-portrait"
    fb = fallback(land)
    alt = esc(text(lang, "alt.hero-pool-mountain"))
    mq = "(max-width: 640px)"
    return (f'<picture>'
            f'<source media="{mq}" type="image/avif" srcset="{srcset(port, "avif")}" sizes="100vw">'
            f'<source media="{mq}" type="image/webp" srcset="{srcset(port, "webp")}" sizes="100vw">'
            f'<source type="image/avif" srcset="{srcset(land, "avif")}" sizes="100vw">'
            f'<source type="image/webp" srcset="{srcset(land, "webp")}" sizes="100vw">'
            f'<img class="hero-img" src="/{fb["file"]}" width="{fb["width"]}" height="{fb["height"]}" alt="{alt}" fetchpriority="high" decoding="async"></picture>')


def hero_preload():
    return (f'<link rel="preload" as="image" type="image/avif" media="(max-width: 640px)" imagesrcset="{srcset("hero-pool-mountain-portrait", "avif")}" imagesizes="100vw" fetchpriority="high">\n'
            f'<link rel="preload" as="image" type="image/avif" media="(min-width: 641px)" imagesrcset="{srcset("hero-pool-mountain", "avif")}" imagesizes="100vw" fetchpriority="high">')


# ── URLs ─────────────────────────────────────────────────────────────────
def page_path(lang, page):
    prefix = "/" if lang == CONFIG["site"]["default_language"] else f"/{lang}/"
    return prefix if page == "index" else f"{prefix}{page}.html"


def hreflang(page):
    out = [f'<link rel="alternate" hreflang="{l}" href="{BASE}{page_path(l, page)}">' for l in LANGS]
    out.append(f'<link rel="alternate" hreflang="x-default" href="{BASE}{page_path("en", page)}">')
    return "\n".join(out)


def lang_switch(lang, page):
    items = []
    for l in LANGS:
        cur = ' aria-current="true"' if l == lang else ""
        name = I18N[l]["_lang"]["name"]
        items.append(f'<a href="{page_path(l, page)}" hreflang="{l}" lang="{l}" data-lang-link="{l}"{cur}>'
                     f'<span aria-hidden="true">{l.upper()}</span><span class="visually-hidden">{esc(name)}</span></a>')
    return f'<div class="lang-switch" role="group" aria-label="{esc(text(lang, "a11y.language"))}">{"".join(items)}</div>'


def booking_base():
    return CONFIG["platforms"]["booking"]


def booking_url():
    bl = CONFIG["booking_links"]
    return f'{booking_base()}?group_adults={bl["default_guests"]}&amp;no_rooms=1&amp;label={bl["booking_label"]}'


def booking_reviews_url():
    bl = CONFIG["booking_links"]
    return f'{booking_base()}?label={bl["booking_label"]}{bl["booking_reviews_anchor"]}'


def airbnb_url():
    return f'{CONFIG["platforms"]["airbnb"]}?adults={CONFIG["booking_links"]["default_guests"]}'


def maps_view_url():
    """Real Business Profile when known; otherwise the documented Maps search URL (name + address).
    Never an invented profile URL."""
    gb = CONFIG["google_business"]
    if gb.get("profile_url"):
        return gb["profile_url"]
    q = {"api": "1", "query": gb["maps_query"]}
    if gb.get("place_id"):
        q["query_place_id"] = gb["place_id"]
    return "https://www.google.com/maps/search/?" + urlencode(q, quote_via=quote)


def directions_url():
    """Documented Maps directions URL: the verified Business Profile (place id) when known,
    otherwise the verified coordinates."""
    g, gb = CONFIG["property"]["geo"], CONFIG["google_business"]
    if gb.get("place_id"):
        q = {"api": "1", "destination": gb["maps_query"], "destination_place_id": gb["place_id"]}
    else:
        q = {"api": "1", "destination": f'{g["lat"]},{g["lng"]}'}
    return "https://www.google.com/maps/dir/?" + urlencode(q, quote_via=quote, safe=",")


def whatsapp_url(lang):
    return f'https://wa.me/{CONFIG["contact"]["whatsapp_e164"]}?text={quote(text(lang, "availability.wa_message"))}'


# ── Head snippets ────────────────────────────────────────────────────────
def gtag_block():
    t = CONFIG["tracking"]
    ads, ga4 = t["google_ads_id"], t["ga4_measurement_id"]
    mode = CONFIG["site"]["consent_mode"]
    denied = "{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500}"
    granted = "{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'}"
    core = ("window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}\n"
            f"gtag('consent','default',{denied});\n"
            "gtag('set','ads_data_redaction',true);\n"
            f"try{{if(localStorage.getItem('palmiye_cookies')==='accepted'){{gtag('consent','update',{granted});}}}}catch(e){{}}\n")
    if mode == "basic":
        # Tag is injected by track.js only after the visitor accepts.
        return f"<script>\n{core}</script>"
    return (f'<script async src="https://www.googletagmanager.com/gtag/js?id={ads}"></script>\n'
            f"<script>\n{core}gtag('js',new Date());\ngtag('config','{ads}');\ngtag('config','{ga4}');\n</script>")


def legacy_lang_param():
    """Old V1 links (?lang=tr|de|ru, used by Ads sitelinks) carry an explicit language request:
    honour it (the server does the same with a 301). No redirect is ever made from the browser
    language or a stored preference — the root page stays English and only suggests a language."""
    langs = [l for l in LANGS if l != "en"]
    return ("<script>(function(){try{var L=" + json.dumps(langs) + ",q=new URLSearchParams(location.search).get('lang');"
            "if(q&&L.indexOf(q)>-1)location.replace('/'+q+'/'+location.hash);}catch(e){}})();</script>")


def lang_suggest():
    """Root page only: a small, dismissible hint offering the visitor's browser language."""
    return ('<div class="lang-suggest" data-lang-suggest hidden>'
            '<p data-ls-text></p><a class="btn btn-primary btn-sm" data-ls-link href="/"></a>'
            f'<button type="button" class="ls-close" data-ls-dismiss>{icon("close")}<span class="visually-hidden" data-ls-dismiss-label></span></button></div>')


def schema(lang):
    """Only verifiable facts. No aggregateRating / review markup (self-serving reviews are not
    eligible and the review count is not verified); no VacationRental type (Google reserves it
    for vacation-rental partners' feeds)."""
    p, a, g = CONFIG["property"], CONFIG["property"]["address"], CONFIG["property"]["geo"]
    gb = CONFIG["google_business"]
    same = [CONFIG["platforms"]["booking"], CONFIG["platforms"]["airbnb"]] + ([gb["profile_url"]] if gb.get("profile_url") else [])
    photos = [f'{BASE}/{fallback(sl)["file"]}' for sl in ("hero-pool-mountain", "living-room", "kitchen", "bedroom", "pool-loungers")]
    lodging = {
        "@type": "LodgingBusiness",
        "@id": f"{BASE}/#lodging",
        "name": p["name"],
        "description": text(lang, "hero.text"),
        "url": BASE + page_path(lang, "index"),
        "image": [f"{BASE}/assets/img/og-image.jpg"] + photos,
        "email": CONFIG["contact"]["email"],
        "telephone": "+" + CONFIG["contact"]["whatsapp_e164"],
        "address": {"@type": "PostalAddress", "streetAddress": a["street"], "addressLocality": a["locality"],
                    "addressRegion": a["region"], "postalCode": a["postal_code"], "addressCountry": a["country"]},
        "geo": {"@type": "GeoCoordinates", "latitude": g["lat"], "longitude": g["lng"]},
        "checkinTime": FACTS["checkin_from"],
        "checkoutTime": FACTS["checkout"],
        "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": n, "value": True}
                           for n in ["Seasonal shared pool", "Air conditioning", "Wi-Fi", "Fully equipped kitchen",
                                     "Washing machine", "Free open-air parking on site", "Self check-in"]],
        "containsPlace": {"@type": "Apartment", "name": f'{p["unit"]} apartment', "numberOfBedrooms": 1,
                          "occupancy": {"@type": "QuantitativeValue", "maxValue": p["max_guests"]}},
        "sameAs": same,
    }
    if gb.get("profile_url") or gb.get("place_id"):
        lodging["hasMap"] = maps_view_url()
    website = {"@type": "WebSite", "@id": f"{BASE}/#website", "url": f"{BASE}/", "name": p["name"],
               "inLanguage": LANGS, "publisher": {"@id": f"{BASE}/#lodging"}}
    data = {"@context": "https://schema.org", "@graph": [website, lodging]}
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


# ── Repeated blocks ──────────────────────────────────────────────────────
def footer(lang):
    a = CONFIG["property"]["address"]
    email = CONFIG["contact"]["email"]
    wa = CONFIG["contact"]["whatsapp_e164"]
    year = BUILD_DATE[:4]
    return f'''<footer class="site-footer" id="contact">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <p class="footer-brand">Palmiye Home</p>
        <p>{text(lang, "footer.tagline")}</p>
      </div>
      <div>
        <h2>{text(lang, "footer.contact")}</h2>
        <ul>
          <li><a href="https://wa.me/{wa}" target="_blank" rel="noopener" data-track="whatsapp_click" data-cta="footer">{text(lang, "footer.whatsapp")}<span class="visually-hidden"> {text(lang, "a11y.new_tab")}</span></a></li>
          <li><a href="mailto:{email}">{email}</a></li>
        </ul>
      </div>
      <div>
        <h2>{text(lang, "location.address_label")}</h2>
        <address>{esc(a["street"])}<br>{esc(a["postal_code"])} {esc(a["locality"])} / {esc(a["region"])}</address>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© {year} Palmiye Home. {text(lang, "footer.rights")}</span>
      <span><a href="{page_path(lang, "privacy")}">{text(lang, "footer.privacy")}</a> · <button type="button" class="linklike" data-consent-open>{text(lang, "footer.cookie_settings")}</button></span>
    </div>
  </div>
</footer>'''


def consent(lang):
    return f'''<div class="consent" id="consent" role="region" aria-label="{esc(text(lang, "consent.title"))}" hidden>
  <p id="consent-text">{text(lang, "consent.text")} <a href="{page_path(lang, "privacy")}">{text(lang, "consent.more")}</a></p>
  <div class="consent-actions">
    <button type="button" class="btn btn-ghost btn-sm" data-consent="declined">{text(lang, "consent.decline")}</button>
    <button type="button" class="btn btn-ghost btn-sm" data-consent="accepted">{text(lang, "consent.accept")}</button>
  </div>
</div>'''


def runtime(lang, with_gallery=True):
    t = CONFIG["tracking"]
    avail_keys = ["pick_start", "pick_end", "selected", "legend_free", "legend_booked", "legend_unknown",
                  "wa_message_dates", "wa_message", "loading", "state_stale", "state_unavailable"]
    i18n = {f"availability.{k}": text(lang, f"availability.{k}") for k in avail_keys}
    i18n["gallery.counter"] = text(lang, "gallery.counter")
    data = {
        "lang": lang,
        "i18n": i18n,
        "telegram_endpoint": CONFIG["site"]["telegram_endpoint"],
        "availability_endpoint": CONFIG["site"]["availability_endpoint"],
        "market": market_runtime(),
        "tracking": {"google_ads_id": t["google_ads_id"], "ga4_measurement_id": t["ga4_measurement_id"],
                     "ads_conversion_labels": t["ads_conversion_labels"], "consent_mode": CONFIG["site"]["consent_mode"]},
        "links": {"whatsapp": CONFIG["contact"]["whatsapp_e164"], "booking": CONFIG["platforms"]["booking"],
                  "airbnb": CONFIG["platforms"]["airbnb"], "booking_label": CONFIG["booking_links"]["booking_label"],
                  "default_guests": CONFIG["booking_links"]["default_guests"],
                  "min_stay": CONFIG["booking_links"]["min_stay_nights"]},
    }
    if lang == CONFIG["site"]["default_language"] and with_gallery:
        data["lang_suggest"] = {l: {"text": text(l, "lang_suggest.text"), "switch": text(l, "lang_suggest.switch"),
                                    "dismiss": text(l, "lang_suggest.dismiss"), "href": page_path(l, "index")}
                                for l in LANGS if l != lang}
    if with_gallery:
        data["gallery"] = [{"alt": text(lang, f"alt.{s}"), "avif": srcset(s, "avif"), "webp": srcset(s, "webp"),
                            "src": "/" + fallback(s)["file"], "w": fallback(s)["width"], "h": fallback(s)["height"]}
                           for s in GALLERY]
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def gallery_grid(lang):
    tiles = []
    for slug, cls in GRID:
        i = GALLERY.index(slug)
        sizes = "(min-width: 760px) 50vw, 50vw" if cls == "wide" else "(min-width: 760px) 25vw, 50vw"
        tiles.append(f'<li class="{cls}"><button class="gallery-item" type="button" data-lightbox-open="{i}" '
                     f'aria-label="{esc(text(lang, "gallery.open"))}: {esc(text(lang, f"alt.{slug}"))}">'
                     f'{picture(slug, sizes, lang)}</button></li>')
    return f'<ul class="gallery-grid" role="list" style="list-style:none">{"".join(tiles)}</ul>'


def apartment_list(lang):
    items = "".join(f"<li>{icon('check')}<span>{fill(s, lang)}</span></li>" for s in lookup(lang, "apartment.list"))
    return f'<ul class="check-list">{items}</ul>'


def restriction_on():
    return CONFIG["booking_turkey_restriction"]["enabled"] is True


def market_runtime():
    """Channel-order hints for site.js — present only while the Booking Turkey restriction is on.
    Off → null: the page carries no market logic at all and everyone gets the neutral order."""
    if not restriction_on():
        return None
    m = CONFIG["market"]
    return {"param": m["url_param"], "hint_time_zones": m["hint_time_zones"], "order": m["channel_order"]}


def day_month(lang, iso_date):
    """'2027-06-01' → '1 June' / '1 Haziran' / '1. Juni' / '1 июня' (date inside a sentence)."""
    y, m, d = (int(x) for x in iso_date.split("-"))
    return lookup(lang, "dates.day_month").replace("{d}", str(d)).replace("{month}", lookup(lang, "dates.months")[m - 1])


POOL_STATUSES = {"planned", "open", "closed"}


def pool_note(lang):
    """Seasonal pool copy from config.pool. COPY ONLY — the pool never closes apartment dates.
    A confirmed opening date switches to the confirmed text; otherwise the conservative reference
    date is shown only as 'confirm before booking', never as a guaranteed opening."""
    p = CONFIG["pool"]
    if p["status"] not in POOL_STATUSES:
        raise ValueError(f"config.pool.status must be one of {sorted(POOL_STATUSES)}")
    if p.get("confirmed_opening_date"):
        return fill(lookup(lang, "pool.note_confirmed"), lang, {"pool_open_date": day_month(lang, p["confirmed_opening_date"])})
    return fill(lookup(lang, "pool.note_reference"), lang, {"pool_reference_date": day_month(lang, p["reference_opening_date"])})


def faq(lang):
    items = list(lookup(lang, "faq.items"))
    if restriction_on():
        items.insert(4, lookup(lang, "faq.turkey"))  # after the parking question
    return '<div class="faq">' + "".join(
        f'<details><summary>{fill(i["q"], lang)}</summary><p>{fill(i["a"], lang, {"pool_note": pool_note(lang)})}</p></details>'
        for i in items) + "</div>"


def month_year(lang, ym):
    y, m = ym.split("-")[:2]
    return f'{lookup(lang, "reviews.months")[int(m) - 1]} {y}'


def stars(rating, scale, lang):
    label = esc(fill(lookup(lang, "reviews.rating_out_of"), lang, {"rating": str(rating), "scale": str(scale)}))
    icons = "".join(f'<svg class="icon{"" if i < rating else " off"}" aria-hidden="true"><use href="#i-star"/></svg>' for i in range(scale))
    return f'<span class="stars" role="img" aria-label="{label}">{icons}</span>'


def excerpt(r):
    out = []
    for seg in r["excerpt"]:
        if seg not in r["text"]:
            raise ValueError(f"excerpt is not verbatim: {seg!r}")
        out.append(seg)
    s_ = " … ".join(esc(x) for x in out)
    if not r["text"].startswith(r["excerpt"][0]):
        s_ = "… " + s_
    if not r["text"].rstrip().endswith(r["excerpt"][-1]):
        s_ += " …"
    return s_


def new_tab(lang):
    return f'<span class="visually-hidden"> {text(lang, "a11y.new_tab")}</span>'


def reviews(lang):
    """Platform-attributed trust layer: every card names its source and links to it.
    Quotes are verbatim excerpts in the original language; ratings without text stay without text."""
    rb = CONFIG["ratings"]["booking"]
    score = rb["score"].replace(".", ",") if lang in DECIMAL_COMMA else rb["score"]
    quotes = []
    for r in CONFIG["guest_reviews"]["items"]:
        langs = lookup(lang, "reviews.languages")
        quotes.append(
            f'<figure class="quote"><blockquote lang="{r["lang"]}"><p>“{excerpt(r)}”</p></blockquote>'
            f'<figcaption><strong>{esc(r["author"])}</strong> · {esc(lookup(lang, "reviews.countries")[r["country_code"]])} · {month_year(lang, r["date"])}'
            f'<span class="quote-lang">{esc(fill(lookup(lang, "reviews.original"), lang, {"language": langs[r["lang"]]}))}</span></figcaption></figure>')
    booking = (
        '<article class="review-source rs-booking" aria-labelledby="rs-booking">'
        f'<header class="rs-head"><h3 id="rs-booking" class="platform"><span class="booking-mark">Booking.com</span></h3>'
        f'<p class="rs-score"><span aria-hidden="true"><strong>{score}</strong> / {rb["scale"]}</span><span class="visually-hidden">{text(lang, "proof.score_aria")}</span></p></header>'
        f'<p class="rs-label">{text(lang, "reviews.booking_label")} · {text(lang, "reviews.booking_note")}</p>'
        + "".join(quotes) +
        f'<p class="rs-link"><a class="link-arrow" href="{booking_reviews_url()}" target="_blank" rel="noopener" data-track="booking_review_click" data-cta="reviews">{text(lang, "reviews.all")}{new_tab(lang)}</a></p>'
        + (f'<p class="rs-access-note" data-tr-review-note hidden>{text(lang, "reviews.booking_tr_access_note")}</p>'
           if restriction_on() else "") +
        '</article>')
    side = []
    for r in CONFIG["platform_reviews"]["items"]:
        if r["platform"] != "google":
            continue
        body = f'<p class="rs-text">{esc(r["text"])}</p>' if r.get("text") else f'<p class="rs-note">{text(lang, "reviews.google_rating_only")}</p>'
        side.append(
            '<article class="review-source rs-google" aria-labelledby="rs-google">'
            f'<header class="rs-head"><h3 id="rs-google" class="platform">Google</h3>{stars(r["rating"], r["scale"], lang)}</header>'
            f'<p class="rs-author"><strong>{esc(r["author"])}</strong> · <span aria-hidden="true">{r["rating"]}/{r["scale"]}</span></p>{body}'
            f'<p class="rs-link"><a class="link-arrow" href="{esc(maps_view_url())}" target="_blank" rel="noopener" data-track="review_source_click" data-platform="google" data-cta="reviews">{text(lang, "reviews.google_link")}{new_tab(lang)}</a></p>'
            '</article>')
    ra = CONFIG["ratings"]["airbnb"]
    a_score = ""
    if ra.get("score"):
        a_score = f'<p class="rs-score"><strong>{esc(ra["score"])}</strong> / {ra["scale"]}</p>'
    side.append(
        '<article class="review-source rs-airbnb" aria-labelledby="rs-airbnb">'
        f'<header class="rs-head"><h3 id="rs-airbnb" class="platform">Airbnb</h3>{a_score}</header>'
        f'<p class="rs-text">{text(lang, "reviews.airbnb_text")}</p>'
        f'<p class="rs-link"><a class="link-arrow" href="{CONFIG["platforms"]["airbnb"]}" target="_blank" rel="noopener" data-track="review_source_click" data-platform="airbnb" data-cta="reviews">{text(lang, "reviews.airbnb_link")}{new_tab(lang)}</a></p>'
        '</article>')
    for r in CONFIG["direct_testimonials"]["items"]:
        if r.get("consent_confirmed") is True:
            side.append(f'<article class="review-source rs-direct"><p class="rs-text">{esc(r["text"])}</p>'
                        f'<p class="rs-author"><strong>{esc(r["author"])}</strong></p></article>')
    return f'<div class="reviews-layout">{booking}<div class="reviews-side">{"".join(side)}</div></div>'


def channels(lang):
    """Neutral order in the HTML. While the Booking Turkey restriction is on, site.js may reorder
    for a TR market hint and reveal the note. Booking is always present and never hidden."""
    order = CONFIG["market"]["channel_order"]["neutral"]
    note = (f'<p class="channel-note" data-tr-note hidden>{icon("info")}<span>{text(lang, "availability.booking_tr_note")}</span></p>'
            if restriction_on() else "")
    items = {
        "booking": (f'<li data-channel-item="booking"><a class="channel" data-channel="booking" data-track="booking_click" data-cta="availability" href="{booking_url()}" target="_blank" rel="noopener">'
                    f'{icon("external")}<span><strong>{text(lang, "availability.booking")}</strong><small>{text(lang, "availability.booking_desc")}</small></span>{new_tab(lang)}</a>'
                    f'{note}</li>'),
        "airbnb": (f'<li data-channel-item="airbnb"><a class="channel" data-channel="airbnb" data-track="airbnb_click" data-cta="availability" href="{airbnb_url()}" target="_blank" rel="noopener">'
                   f'{icon("external")}<span><strong>{text(lang, "availability.airbnb")}</strong><small>{text(lang, "availability.airbnb_desc")}</small></span>{new_tab(lang)}</a></li>'),
        "whatsapp": (f'<li data-channel-item="whatsapp"><a class="channel" data-channel="whatsapp" data-track="whatsapp_click" data-cta="availability" href="{whatsapp_url(lang)}" target="_blank" rel="noopener">'
                     f'{icon("chat")}<span><strong>{text(lang, "availability.whatsapp")}</strong><small>{text(lang, "availability.whatsapp_desc")}</small></span>{new_tab(lang)}</a></li>'),
    }
    return '<ul class="channels" data-channels>' + "".join(items[c] for c in order) + "</ul>"


def guests_select(lang):
    mx, df = CONFIG["property"]["max_guests"], CONFIG["booking_links"]["default_guests"]
    opts = "".join(f'<option value="{n}"{" selected" if n == df else ""}>{n}</option>' for n in range(1, mx + 1))
    return f'<select id="guests" name="guests">{opts}</select>'


# ── Template engine ──────────────────────────────────────────────────────
TOKEN = re.compile(r"\{\{(t|a|c|v|icon|pic) ([^}]+)\}\}")


def render(template, lang, values):
    def sub(m):
        kind, arg = m.group(1), m.group(2).strip()
        if kind == "t":
            return text(lang, arg)
        if kind == "a":
            return esc(re.sub(r"<[^>]+>", "", text(lang, arg)))
        if kind == "c":
            node = CONFIG
            for part in arg.split("."):
                node = node[part]
            s = str(node)
            if arg == "ratings.booking.score" and lang in DECIMAL_COMMA:
                s = s.replace(".", ",")
            return esc(s)
        if kind == "v":
            if arg not in values:
                raise KeyError(f"template value missing: {arg}")
            return values[arg]
        if kind == "icon":
            return icon(arg)
        if kind == "pic":
            parts = arg.split("|")
            return picture(parts[0], parts[1], lang, parts[2] if len(parts) > 2 else "")
    return TOKEN.sub(sub, template)


def asset_url(path, content):
    return f"/{path}?v={hashlib.sha256(content).hexdigest()[:10]}"


def build_files():
    files = {}
    css = (SRC / "css" / "site.css").read_bytes()
    js_track = (SRC / "js" / "track.js").read_bytes()
    js_site = (SRC / "js" / "site.js").read_bytes()
    files["assets/css/site.css"] = css
    files["assets/js/track.js"] = js_track
    files["assets/js/site.js"] = js_site
    common = {
        "css": asset_url("assets/css/site.css", css),
        "js_track": asset_url("assets/js/track.js", js_track),
        "js_site": asset_url("assets/js/site.js", js_site),
        "sprite": sprite(),
        "gtag": gtag_block(),
    }
    index_tpl = (SRC / "templates" / "index.html").read_text(encoding="utf-8")
    page_tpl = (SRC / "templates" / "page.html").read_text(encoding="utf-8")
    a = CONFIG["property"]["address"]
    g = CONFIG["property"]["geo"]

    for lang in LANGS:
        meta = I18N[lang]["_lang"]
        vals = dict(common)
        vals.update({
            "lang": lang,
            "locale": meta["locale"],
            "og_locale_alternates": "\n".join(f'<meta property="og:locale:alternate" content="{I18N[l]["_lang"]["locale"]}">' for l in LANGS if l != lang),
            "canonical": BASE + page_path(lang, "index"),
            "hreflang": hreflang("index"),
            "og_image": f"{BASE}/assets/img/og-image.jpg",
            "hero_preload": hero_preload(),
            "lang_redirect": legacy_lang_param() if lang == "en" else "",
            "lang_suggest": lang_suggest() if lang == "en" else "",
            "schema": schema(lang),
            "home_url": page_path(lang, "index"),
            "lang_switch": lang_switch(lang, "index"),
            "hero_picture": hero_picture(lang),
            "booking_reviews_url": booking_reviews_url(),
            "booking_url": booking_url(),
            "airbnb_url": airbnb_url(),
            "whatsapp_url": whatsapp_url(lang),
            "apartment_list": apartment_list(lang),
            "gallery_grid": gallery_grid(lang),
            "gallery_all_label": f'{esc(text(lang, "gallery.title"))} ({len(GALLERY)})',
            "address_line": f'{esc(a["street"])}, {esc(a["postal_code"])} {esc(a["locality"])} / {esc(a["region"])}',
            "map_embed": f'https://maps.google.com/maps?q={g["lat"]},{g["lng"]}&amp;hl={lang}&amp;z=15&amp;output=embed',
            "map_link": esc(maps_view_url()),
            "directions_link": esc(directions_url()),
            "channels": channels(lang),
            "pool_note": pool_note(lang),
            "reviews": reviews(lang),
            "faq": faq(lang),
            "guests_select": guests_select(lang),
            "footer": footer(lang),
            "consent": consent(lang),
            "runtime": runtime(lang),
        })
        out = "index.html" if lang == "en" else f"{lang}/index.html"
        files[out] = render(index_tpl, lang, vals).encode("utf-8")

        # Privacy page
        sections = "".join(f'<h2>{fill(s["h"], lang)}</h2><p>{fill(s["p"], lang)}</p>' for s in lookup(lang, "privacy.sections"))
        body = (f'<h1>{text(lang, "privacy.title")}</h1><p class="muted">{text(lang, "privacy.updated")}</p>{sections}'
                f'<p style="margin-top:2em"><a class="link-arrow" href="{page_path(lang, "index")}">{text(lang, "privacy.back")}</a></p>')
        pvals = dict(common)
        pvals.update({
            "lang": lang, "page_title": esc(text(lang, "privacy.title")),
            "page_description": esc(text(lang, "privacy.meta_description")), "robots": "",
            "canonical": BASE + page_path(lang, "privacy"), "hreflang": hreflang("privacy"),
            "home_url": page_path(lang, "index"), "lang_switch": lang_switch(lang, "privacy"),
            "body": body, "footer": footer(lang), "consent": consent(lang), "runtime": runtime(lang, with_gallery=False),
        })
        out = "privacy.html" if lang == "en" else f"{lang}/privacy.html"
        files[out] = render(page_tpl, lang, pvals).encode("utf-8")

    # 404 (English; links to every language home)
    lang = "en"
    links = " · ".join(f'<a href="{page_path(l, "index")}" lang="{l}">{esc(I18N[l]["notfound"]["back"])}</a>' for l in LANGS)
    body = f'<h1>{text(lang, "notfound.title")}</h1><p>{text(lang, "notfound.text")}</p><p>{links}</p>'
    nvals = dict(common)
    nvals.update({
        "lang": lang, "page_title": esc(text(lang, "notfound.title")), "page_description": esc(text(lang, "notfound.text")),
        "robots": '<meta name="robots" content="noindex">', "canonical": BASE + "/404.html", "hreflang": "",
        "home_url": "/", "lang_switch": lang_switch(lang, "index"), "body": body,
        "footer": footer(lang), "consent": consent(lang), "runtime": runtime(lang, with_gallery=False),
    })
    files["404.html"] = render(page_tpl, lang, nvals).encode("utf-8")

    # sitemap.xml
    urls = []
    for page in ("index", "privacy"):
        alts = "".join(f'\n    <xhtml:link rel="alternate" hreflang="{l}" href="{BASE}{page_path(l, page)}"/>' for l in LANGS)
        alts += f'\n    <xhtml:link rel="alternate" hreflang="x-default" href="{BASE}{page_path("en", page)}"/>'
        for l in LANGS:
            urls.append(f'  <url>\n    <loc>{BASE}{page_path(l, page)}</loc>\n    <lastmod>{BUILD_DATE}</lastmod>{alts}\n  </url>')
    files["sitemap.xml"] = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
                            + "\n".join(urls) + "\n</urlset>\n").encode("utf-8")
    files["robots.txt"] = ("User-agent: *\nAllow: /\nDisallow: /api/\n\n"
                           f"Sitemap: {BASE}/sitemap.xml\n").encode("utf-8")
    files["manifest.json"] = json.dumps({
        "name": "Palmiye Home", "short_name": "Palmiye Home", "start_url": "/", "display": "browser",
        "background_color": "#f8f5ef", "theme_color": "#f8f5ef",
        "icons": [{"src": "/assets/icons/favicon-32.png", "sizes": "32x32", "type": "image/png"},
                  {"src": "/assets/icons/favicon-180.png", "sizes": "180x180", "type": "image/png"}],
    }, indent=2).encode("utf-8")

    # Server side (PHP) — copied as-is. The legacy data/bookings.js is no longer part of V2.
    for f in sorted((SRC / "server" / "api").rglob("*")):
        if f.is_file():
            files["api/" + f.relative_to(SRC / "server" / "api").as_posix()] = f.read_bytes()
    av = CONFIG["availability"]
    files["api/_lib/settings.json"] = json.dumps({"availability": {k: v for k, v in av.items() if not k.startswith("_")}},
                                                 indent=2).encode("utf-8")
    files[".htaccess"] = (SRC / "server" / ".htaccess").read_bytes()
    files["assets/icons/favicon-32.png"] = (REPO / "Logo" / "favicon-32.png").read_bytes()
    files["favicon.ico"] = files["assets/icons/favicon-32.png"]  # browsers request /favicon.ico regardless of <link rel=icon>
    files["assets/icons/favicon-180.png"] = (REPO / "Logo" / "favicon-180.png").read_bytes()
    return files


def orphans(files):
    """Generated files in v2/public that the current build no longer produces (images excluded:
    build_images.py owns assets/img)."""
    out = []
    for f in OUT.rglob("*"):
        rel = f.relative_to(OUT).as_posix()
        if f.is_file() and not rel.startswith("assets/img/") and rel not in files:
            out.append(rel)
    return sorted(out)


def main():
    files = build_files()
    if "--check" in sys.argv:
        stale = [p for p, c in files.items() if not (OUT / p).exists() or (OUT / p).read_bytes() != c]
        stale += [f"(orphan) {p}" for p in orphans(files)]
        for p in stale:
            print("STALE", p)
        print("build up to date" if not stale else f"{len(stale)} file(s) out of date — run build_site.py")
        sys.exit(1 if stale else 0)
    for p in orphans(files):
        (OUT / p).unlink()
        print("removed orphan", p)
    for p, c in files.items():
        dest = OUT / p
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists() or dest.read_bytes() != c:
            dest.write_bytes(c)
    print(f"built {len(files)} files into {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
