<?php
/**
 * Palmiye Home V2 — secret template (PLACEHOLDERS ONLY — never put real values here)
 *
 * On the server, copy this file OUTSIDE the web root and fill it there:
 *     /home/<cpanel-user>/palmiye-secrets/.env.php        (chmod 600)
 * Every V2 server script reads it via api/_lib/bootstrap.php (or from the path in the
 * PALMIYE_SECRETS_FILE environment variable) and refuses a file inside public_html.
 * The same folder also holds (created automatically, chmod 700):
 *     telegram-state.json          anonymous debounce counters
 *     availability-cache/          last good availability state (dates only)
 *
 * A value that still contains "_HERE" is treated as not set.
 * Never copy the real file into this repository, v2/public, publish/, dist/ or a zip.
 */

// ── Telegram visit notice ─────────────────────────────────────────────
// ROTATE the bot token before go-live (@BotFather → /revoke): the old token existed in old server files.
define('TELEGRAM_ENABLED',   true);
define('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE');
define('TELEGRAM_CHAT_ID',   'YOUR_CHAT_ID_HERE');

// Approximate visitor location (local file lookup, no external API; optional).
// DB-IP "IP to City Lite" (.mmdb, CC BY 4.0) or MaxMind GeoLite2-City, plus the MaxMind DB reader.
define('PALMIYE_GEOIP_DB',     'PATH_TO_CITY_MMDB_HERE');          // e.g. /home/<user>/palmiye-secrets/geo/dbip-city-lite.mmdb
define('PALMIYE_GEOIP_READER', 'PATH_TO_MAXMIND_READER_AUTOLOAD_HERE'); // e.g. /home/<user>/palmiye-secrets/geo/MaxMind-DB-Reader-php/autoload.php

// ── Availability engine: private iCal export URLs (each one is a SECRET) ──────
// Booking.com extranet → Rates & Availability → Sync calendars → Export calendar link
define('PALMIYE_ICAL_BOOKING', 'BOOKING_ICAL_EXPORT_URL_HERE');
// Airbnb → Listing → Availability → Connect calendars → Export calendar link
define('PALMIYE_ICAL_AIRBNB',  'AIRBNB_ICAL_EXPORT_URL_HERE');
// Direct / WhatsApp bookings: a dedicated Google Calendar → Settings → "Secret address in iCal format"
define('PALMIYE_ICAL_DIRECT',  'DIRECT_CALENDAR_SECRET_ICAL_URL_HERE');

// Owner-only page /api/availability-health.php (disabled while empty / placeholder).
// php -r "echo password_hash('a-long-passphrase', PASSWORD_DEFAULT), PHP_EOL;"
define('PALMIYE_AVAILABILITY_ADMIN_HASH', 'PASSWORD_HASH_HERE');
