# Palmiye Home V2 (2027)

Static, dependency-free rebuild of palmiyehomekemer.com. **`v2/public/` is the complete deploy root**; nothing else in this repository is deployed for V2. The Clean Master files in the repository root are left unchanged on this branch.

## Single sources

| What | Where |
|---|---|
| Business facts, links, tracking IDs, consent mode, guest reviews | `config/site-config.json` |
| Every visible text (EN/TR/DE/RU), incl. FAQ, consent UI, alt texts, privacy | `v2/src/i18n/<lang>.json` |
| Page markup | `v2/src/templates/index.html`, `v2/src/templates/page.html` |
| Styles / scripts | `v2/src/css/site.css`, `v2/src/js/track.js`, `v2/src/js/site.js` |
| Server files | `v2/src/server/.htaccess`, `v2/src/server/telegram-notify.php` |
| Availability data | `data/bookings.js` (copied unchanged to `v2/public/data/bookings.js`) |
| Image variants | generated from the approved retouched originals (read-only) |

Business values reach the texts through placeholders: `{score}`, `{checkin}`, `{checkin_from}`, `{checkin_until}`, `{checkout}`, `{max_guests}`, `{unit}`, `{email}`, `{build_date}`.

## Commands (Python 3.10+, Pillow with AVIF support for images)

```
python v2/tools/build_images.py     # only when the source photos change
python v2/tools/build_site.py       # regenerate v2/public
python v2/tools/verify_v2.py        # 24 checks; must be all PASS before QA/deploy
python v2/tools/dev_server.py       # http://localhost:8080 — Telegram + gtag.js are local mocks
```

Change the build date shown on the privacy page in `v2/src/BUILD_DATE`.

## Deploy notes (not done — needs Ali's approval)

- Upload the **contents** of `v2/public/` (including `.htaccess`) to `public_html`.
- The real Telegram secret goes to `/home/<user>/palmiye-secrets/.env.php` (outside `public_html`), template: `env.example.php`.
- On the server Ali edits `data/bookings.js` exactly as before.
