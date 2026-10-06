"""Booking Turkey restriction + market-hint tests (build level, stdlib only).

python v2/tools/test_market.py   → exit 1 on any failure

Builds the site IN MEMORY twice — booking_turkey_restriction.enabled = true and = false — without
touching config/site-config.json or v2/public, and checks that switching the flag is enough to
return to normal behaviour (no code change). Browser behaviour (hint order, ?ph_market, invalid
values, neutral time zone) is covered by the QA run documented in the report.
"""
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_site as B  # noqa: E402

LANGS = B.LANGS
results = []


def check(name, ok, detail=""):
    ok = bool(ok)
    results.append(ok)
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))


def page(files, lang):
    return files["index.html" if lang == "en" else f"{lang}/index.html"].decode("utf-8")


def runtime(html):
    return json.loads(re.search(r'<script type="application/json" id="site-data">(.*?)</script>', html, re.S).group(1).replace("<\\/", "</"))


def build(enabled):
    original = B.CONFIG["booking_turkey_restriction"]["enabled"]
    B.CONFIG["booking_turkey_restriction"]["enabled"] = enabled
    try:
        return B.build_files()
    finally:
        B.CONFIG["booking_turkey_restriction"]["enabled"] = original


notes = {l: B.text(l, "availability.booking_tr_note") for l in LANGS}
faq_q = {l: B.lookup(l, "faq.turkey")["q"] for l in LANGS}
on, off = build(True), build(False)

# ── restriction ON ──
for lang in LANGS:
    h = page(on, lang)
    rt = runtime(h)
    ok = ("data-tr-note" in h and notes[lang] in h and faq_q[lang] in h
          and rt["market"] and rt["market"]["param"] == "ph_market"
          and rt["market"]["order"]["tr_hint"] == ["whatsapp", "airbnb", "booking"]
          and rt["market"]["order"]["neutral"] == ["booking", "airbnb", "whatsapp"])
    check(f"restriction ON [{lang}]: note + FAQ item + market hints (ph_market) built", ok)

# ── restriction OFF ──
for lang in LANGS:
    h = page(off, lang)
    rt = runtime(h)
    items = re.findall(r'data-channel-item="(\w+)"', h)
    check(f"restriction OFF [{lang}]: no note, no FAQ item, no market logic, neutral order, Booking present",
          "data-tr-note" not in h and notes[lang] not in h and faq_q[lang] not in h and rt["market"] is None
          and items == ["booking", "airbnb", "whatsapp"] and 'data-channel="booking"' in h)
leftover = [p for p, c in off.items() if p.endswith((".html", ".js", ".json")) and any(notes[l] in c.decode("utf-8", "ignore") for l in LANGS)]
check("restriction OFF: no restriction copy in any built file (EN/TR/DE/RU)", not leftover, str(leftover))
check("restriction OFF needs no code change: only the config flag differs between the two builds",
      on["assets/js/site.js"] == off["assets/js/site.js"] and on["assets/js/track.js"] == off["assets/js/track.js"])

# ── Booking is never hidden / removed (both builds) ──
for label, files in (("ON", on), ("OFF", off)):
    bad = []
    for lang in LANGS:
        h = page(files, lang)
        li = re.search(r'<li data-channel-item="booking">(.*?)</li>', h, re.S)
        # the Booking <li> and its link must carry no hidden attribute (class names like
        # "visually-hidden" are the screen-reader "(opens in a new tab)" text, not hiding)
        if not li or re.search(r'<(li|a)[^>]*\shidden[\s>=]', li.group(0).split("data-tr-note")[0]):
            bad.append(lang)
    check(f"Booking channel always in the DOM and never hidden (restriction {label})", not bad, str(bad))

# ── Privacy / signal rules in the shipped JS ──
js = on["assets/js/site.js"].decode("utf-8")
market_js = js.split("// ── Reservation channel order")[1].split("// The mobile CTA")[0]
market_code = "\n".join(l for l in market_js.splitlines() if not l.strip().startswith("//"))
check("market code: no IP, no geolocation API, no navigator.language, no network call",
      not re.search(r"geolocation|navigator\.language|fetch\(|XMLHttpRequest|ipapi|ipinfo|geoip|sendBeacon", market_code, re.I)
      and "resolvedOptions().timeZone" in market_code)
check("signal priority: explicit ph_market (tr|intl) before time-zone hint; invalid values ignored",
      market_js.index("explicit_url") < market_js.index("timezone_hint")
      and "explicit === 'tr' || explicit === 'intl'" in market_js)
track = on["assets/js/track.js"].decode("utf-8")
check("analytics: market_hint + market_source only (no 'market'/'country' claim), only on channel clicks",
      "market_hint:" in track and "market_source:" in track and "country" not in track and not re.search(r"\bmarket:", track))

print(f"\n{sum(results)}/{len(results)} market tests passed")
sys.exit(0 if all(results) else 1)
