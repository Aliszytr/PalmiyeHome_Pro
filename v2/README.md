# Palmiye Home V2 (2027)

Static, dependency-free rebuild of palmiyehomekemer.com. **`v2/public/` is the build output** that the release packager copies into an immutable release folder; production is uploaded only from that release folder (see *Source of truth* below). Nothing else in this repository is deployed for V2. The Clean Master files in the repository root are left unchanged on this branch.

## Single sources

| What | Where |
|---|---|
| Business facts, links, tracking IDs, consent mode, ratings, reviews, market order, availability behaviour | `config/site-config.json` |
| Every visible text (EN/TR/DE/RU), incl. FAQ, consent UI, alt texts, privacy | `v2/src/i18n/<lang>.json` |
| Page markup | `v2/src/templates/index.html`, `v2/src/templates/page.html` |
| Styles / scripts | `v2/src/css/site.css`, `v2/src/js/track.js`, `v2/src/js/site.js` |
| Server (PHP 7.0+) | `v2/src/server/.htaccess`, `v2/src/server/api/` (Telegram notice, availability engine, `_lib/`) |
| Secrets template (never deployed inside public_html) | `v2/deploy/palmiye-secrets/env.example.php` |
| Availability | Booking.com iCal + Airbnb iCal only → `/api/availability.json` (no third/Direct calendar; the V1 `data/bookings.js` is not used by V2) |
| Image variants | generated from the approved retouched originals (read-only) |

Business values reach the texts through placeholders: `{score}`, `{checkin}`, `{checkin_from}`, `{checkin_until}`, `{checkout}`, `{max_guests}`, `{unit}`, `{email}`, `{build_date}`.

## Commands (Python 3.10+, Pillow with AVIF support for images)

```
python v2/tools/build_images.py       # when source photos change (a changed source is rebuilt automatically)
python v2/tools/build_site.py         # regenerate v2/public (removes files the build no longer produces)
python v2/tools/verify_v2.py          # all checks must PASS before QA/deploy
python v2/tools/test_availability.py  # fail-safe tests of the availability engine (Python reference)
python v2/tools/test_market.py        # Booking Turkey restriction ON/OFF, market hints, pool policy, review note, beach copy
python v2/tools/test_site_js.py       # headless Chrome/Edge: initial calendar month, OTA links (no dates / exact dates, guests 1–4), TR review note
python v2/tools/test_php_local.py --php C:\path\php.exe   # real PHP: lint, selftest, sync, endpoint, health, fail-safe (sandbox)
python v2/tools/dev_server.py         # http://localhost:8080 — Telegram, gtag.js and availability are local mocks
python v2/tools/package_release.py --version 1.0.0-rc4 --date 2026-10-07 --root D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES [--php C:\path\php.exe] [--same-as <approved release folder>]
```

`package_release.py` refuses to run on a dirty tree, a stale build or any failing suite, never overwrites a release folder, and copies only `v2/public` (no fixtures, tools, mocks or reports) into `<release>/publish`. Selftest fixtures go to `<release>/deployment/selftest-fixtures` (outside the web root).

Dev server helpers: `/__dev/availability?scenario=fresh|stale|unavailable|offline`, `/__dev/availability-health`, `?__dev_consent=accepted|declined`, `?__dev_tz=America/New_York` (simulated time zone). Site parameter: `?ph_market=tr|intl`.

## Availability operating rule (Direct / WhatsApp bookings)

When a direct or WhatsApp booking is confirmed, the owner **blocks those dates in Booking.com or Airbnb**. The website keeps no separate direct-booking calendar: it shows the union of the Booking.com and Airbnb feeds, so a night closed in **either** OTA is closed on the website (this also covers the delay of the OTAs' own iCal sync with each other). If either feed is missing, never synced or too old, the calendar shows no date as free.

## Booking window vs. pool (two different things)

`config → availability.booking_window` (2027-01-01 → 2027-12-31) is only the outer range in which the website evaluates stays; daily availability comes from the Booking.com + Airbnb feeds. `config → pool` is COPY ONLY: seasonal outdoor pool, conservative reference date (1 June), optional `confirmed_opening_date`. **POOL STATUS != APARTMENT AVAILABILITY** — the pool never closes a date. Maintenance closures are blocked in Booking.com / Airbnb.

## Booking.com Turkey restriction (config switch)

`config/site-config.json → booking_turkey_restriction.enabled`. `true`: channel order follows a market **hint** (`?ph_market=tr|intl` first, then the browser time zone `Europe/Istanbul` as a low-confidence hint, otherwise neutral) and the Booking note + FAQ item are built. `false`: everyone gets the neutral order Booking → Airbnb → WhatsApp, no note, no FAQ item and no market logic — rebuild only, no code change. Booking.com is never hidden or removed. No IP, geolocation API, GPS or third-party geo service is used for this.

## Reservation links and calendar start

Booking.com / Airbnb links carry `checkin/checkout` · `check_in/check_out` **only after the guest has picked a valid check-in and check-out**; with no selection they open the plain listing (guest count only). Before the booking window starts, the calendar opens at the window's first month (today: January 2027); inside the window, at the current month; after it, at the current month with no day shown as free.

## Source of truth and release discipline

| What | Where |
|---|---|
| CANONICAL SOURCE | `D:\ProjelerFinal\WebProjesi\PalmiyeHome_Pro\v2` |
| Git repository | `D:\ProjelerFinal\WebProjesi\PalmiyeHome_Pro` |
| Immutable release packages | `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\<DATE>_v<VERSION>\` (`publish`, `reports`, `checksums`, `deployment`) |
| What is live right now | `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\PRODUCTION_POINTER.json` |
| Every deploy / rollback (append-only) | `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_RELEASES\DEPLOYMENT_HISTORY.md` |
| Full live backup before every deploy | `D:\ProjelerFinal\WebProjesi\PalmiyeHome_2027_LIVE_BACKUPS\<YYYY-MM-DD>_before_<VERSION>\` |

**Production is deployed ONLY from `PalmiyeHome_2027_RELEASES\<APPROVED_VERSION>\publish`.** The production upload source is NEVER:
- `PalmiyeHome_Pro\publish` (legacy V1),
- `PalmiyeHome_Pro\v2\public` (build workspace),
- `D:\ProjelerFinal\CanliDosyalar` (legacy reference copy of the old live site — kept, never modified, not used for new backups),
- `_PalmiyeHome_2027_BASELINE\v2-build` (QA archive).

Rules:
1. Release folders (RCs and finals) are immutable: never edited after packaging; a fix means a new RC.
2. Before every deploy the whole live web root is downloaded to a new dated folder under `PalmiyeHome_2027_LIVE_BACKUPS` (file count + SHA-256 list recorded); no upload before the backup is complete.
3. Final promotion: the approved RC's commit is packaged again as `--version 1.0.0` with `--same-as <approved RC folder>`; the packager stops unless `publish` is byte-identical. Only promotion metadata (VERSION, manifest, tag) differs. Target: tag `palmiye-home-2027-v1.0.0`, `PalmiyeHome_2027_RELEASES\2026-10-07_v1.0.0\publish`.
4. After a deploy passes its post-deploy checks: append to `DEPLOYMENT_HISTORY.md`, then update `PRODUCTION_POINTER.json`. An RC is never recorded as production.
5. Step-by-step upload procedure: `v2/deploy/FILEZILLA_DEPLOY.md`; full server checklist: `v2/deploy/DEPLOY_CHECKLIST.md` (both are copied into every release's `deployment/`).

## Deploy notes (not done — needs Ali's approval)

- Upload the **contents** of the approved release's `publish\` folder (including `.htaccess` and `api/_lib/.htaccess`) to the live web root (`public_html`) — see `v2/deploy/FILEZILLA_DEPLOY.md`.
- Create `/home/<user>/palmiye-secrets/.env.php` (outside `public_html`, chmod 600) from `v2/deploy/palmiye-secrets/env.example.php`: Telegram token (rotated), the Booking.com and Airbnb iCal export URLs, owner password hash, optional GeoIP paths.
- cPanel cron every 20 min: `/usr/local/bin/php /home/<user>/public_html/api/availability-sync.php`
- On the server: `php api/availability-sync.php --selftest --fixtures=/home/<user>/palmiye-release/selftest-fixtures`, then `--force`, then open `/api/availability-health.php`.
