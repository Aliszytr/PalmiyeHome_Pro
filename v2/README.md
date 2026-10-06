# Palmiye Home V2 (2027)

Static, dependency-free rebuild of palmiyehomekemer.com. **`v2/public/` is the complete deploy root**; nothing else in this repository is deployed for V2. The Clean Master files in the repository root are left unchanged on this branch.

## Single sources

| What | Where |
|---|---|
| Business facts, links, tracking IDs, consent mode, ratings, reviews, market order, availability behaviour | `config/site-config.json` |
| Every visible text (EN/TR/DE/RU), incl. FAQ, consent UI, alt texts, privacy | `v2/src/i18n/<lang>.json` |
| Page markup | `v2/src/templates/index.html`, `v2/src/templates/page.html` |
| Styles / scripts | `v2/src/css/site.css`, `v2/src/js/track.js`, `v2/src/js/site.js` |
| Server (PHP 7.0+) | `v2/src/server/.htaccess`, `v2/src/server/api/` (Telegram notice, availability engine, `_lib/`) |
| Secrets template (never deployed inside public_html) | `v2/deploy/palmiye-secrets/env.example.php` |
| Availability | Booking.com + Airbnb + Direct calendar iCal → `/api/availability.json` (the V1 `data/bookings.js` is not used by V2) |
| Image variants | generated from the approved retouched originals (read-only) |

Business values reach the texts through placeholders: `{score}`, `{checkin}`, `{checkin_from}`, `{checkin_until}`, `{checkout}`, `{max_guests}`, `{unit}`, `{email}`, `{build_date}`.

## Commands (Python 3.10+, Pillow with AVIF support for images)

```
python v2/tools/build_images.py       # when source photos change (a changed source is rebuilt automatically)
python v2/tools/build_site.py         # regenerate v2/public (removes files the build no longer produces)
python v2/tools/verify_v2.py          # 37 checks; must be all PASS before QA/deploy
python v2/tools/test_availability.py  # fail-safe tests of the availability engine (Python reference)
python v2/tools/dev_server.py         # http://localhost:8080 — Telegram, gtag.js and availability are local mocks
```

Dev server helpers: `/__dev/availability?scenario=fresh|stale|unavailable|offline`, `/__dev/availability-health`, `?__dev_consent=accepted|declined`, `?market=tr|intl`.

## Deploy notes (not done — needs Ali's approval)

- Upload the **contents** of `v2/public/` (including `.htaccess` and `api/_lib/.htaccess`) to `public_html`.
- Create `/home/<user>/palmiye-secrets/.env.php` (outside `public_html`, chmod 600) from `v2/deploy/palmiye-secrets/env.example.php`: Telegram token (rotated), iCal export URLs, owner password hash, optional GeoIP paths.
- Set `availability.season` in `config/site-config.json`, rebuild, upload.
- cPanel cron every 20 min: `/usr/local/bin/php /home/<user>/public_html/api/availability-sync.php`
- On the server: `php api/availability-sync.php --selftest`, then `--force`, then open `/api/availability-health.php`.
