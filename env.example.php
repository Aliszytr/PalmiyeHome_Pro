<?php
/**
 * Palmiye Home — secret template (PLACEHOLDERS ONLY — never put real values here)
 *
 * On the server, copy this file OUTSIDE the web root and fill it there:
 *     /home/<cpanel-user>/palmiye-secrets/.env.php        (chmod 600)
 * api/telegram-notify.php reads it from that location (or from the path in the
 * PALMIYE_SECRETS_FILE environment variable) and refuses a file inside public_html.
 * The same folder also holds telegram-state.json (anonymous debounce counters).
 *
 * Never copy the real file into this repository, publish/, dist/ or a zip.
 */

define('TELEGRAM_ENABLED',   true);
define('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE');
define('TELEGRAM_CHAT_ID',   'YOUR_CHAT_ID_HERE');
