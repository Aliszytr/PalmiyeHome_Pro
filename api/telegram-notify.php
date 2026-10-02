<?php
/**
 * Palmiye Home — Telegram Visitor Notification (GoDaddy/cPanel)
 *
 * Purpose: send the site owner a short "site visited" notification.
 *
 * Privacy / data rules (see TELEGRAM_PRIVACY_BEHAVIOR.md):
 *   - No per-visitor files. The visitor IP is never written anywhere by this script.
 *   - Only coarse, non-identifying fields are accepted and every field is whitelisted:
 *     language code, device class, page path, referring host name.
 *   - Spam protection is a single global, anonymous debounce state
 *     (timestamps + counters only), stored next to the secret file outside the web root.
 *
 * Secret: the bot token and chat id are read ONLY from a file outside the web root:
 *   1. the path in the PALMIYE_SECRETS_FILE environment variable, or
 *   2. <parent of document root>/palmiye-secrets/.env.php
 * A secret file located inside the document root is refused.
 * Template: env.example.php (placeholders only).
 *
 * The browser always gets 204 No Content; no error details are returned.
 * Compatible with PHP 7.0+.
 */

// ══════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════
$ALLOWED_ORIGINS   = ['https://palmiyehomekemer.com', 'https://www.palmiyehomekemer.com'];
$MIN_INTERVAL_SEC  = 60;    // at most one message per minute ...
$MAX_PER_HOUR      = 20;    // ... and at most 20 messages per rolling hour
$ALLOWED_LANGUAGES = ['en', 'tr', 'de', 'ru'];
$ALLOWED_DEVICES   = ['mobile', 'tablet', 'desktop'];
$ALLOWED_PAGES     = ['/', '/index.html', '/privacy.html', '/privacy', '/404.html'];

function palmiye_done($code = 204) {
    http_response_code($code);
    exit;
}

// ══════════════════════════════════════════
//  REQUEST CHECKS
// ══════════════════════════════════════════
$origin  = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$allowed = in_array($origin, $ALLOWED_ORIGINS, true);

if ($allowed) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if ($allowed) {
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
    palmiye_done($allowed ? 204 : 403);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    palmiye_done(405);
}
if (!$allowed) {
    palmiye_done(403);
}

$ua = strtolower(isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '');
foreach (['bot', 'crawler', 'spider', 'lighthouse', 'headless', 'preview'] as $needle) {
    if ($ua === '' || strpos($ua, $needle) !== false) {
        palmiye_done();
    }
}

// ══════════════════════════════════════════
//  SECRET — outside the web root only
// ══════════════════════════════════════════
$docRoot    = isset($_SERVER['DOCUMENT_ROOT']) ? realpath($_SERVER['DOCUMENT_ROOT']) : false;
$secretFile = getenv('PALMIYE_SECRETS_FILE');
if (!$secretFile && $docRoot) {
    $secretFile = dirname($docRoot) . '/palmiye-secrets/.env.php';
}
$secretReal = $secretFile ? realpath($secretFile) : false;
if (!$secretReal || !is_readable($secretReal)) {
    palmiye_done();
}
if ($docRoot && strpos($secretReal, $docRoot . DIRECTORY_SEPARATOR) === 0) {
    error_log('[Palmiye Telegram] Refused: secret file is inside the document root.');
    palmiye_done();
}
require_once $secretReal;

if (defined('TELEGRAM_ENABLED') && !TELEGRAM_ENABLED) {
    palmiye_done();
}
$botToken = defined('TELEGRAM_BOT_TOKEN') ? TELEGRAM_BOT_TOKEN : '';
$chatId   = defined('TELEGRAM_CHAT_ID') ? TELEGRAM_CHAT_ID : '';
if ($botToken === '' || $chatId === '' ||
    strpos($botToken, '_HERE') !== false || strpos($chatId, '_HERE') !== false) {
    palmiye_done();
}

// ══════════════════════════════════════════
//  INPUT — whitelisted, coarse fields only
// ══════════════════════════════════════════
$raw  = file_get_contents('php://input', false, null, 0, 2048);
$body = json_decode($raw, true);
if (!is_array($body)) {
    palmiye_done(400);
}

$language = isset($body['language']) ? strtolower(substr((string) $body['language'], 0, 2)) : '';
$language = in_array($language, $ALLOWED_LANGUAGES, true) ? $language : 'other';

$device = isset($body['device']) ? (string) $body['device'] : '';
$device = in_array($device, $ALLOWED_DEVICES, true) ? $device : 'unknown';

$page = isset($body['page']) ? (string) $body['page'] : '';
$page = in_array($page, $ALLOWED_PAGES, true) ? $page : 'other';

$referrer = isset($body['referrer']) ? strtolower((string) $body['referrer']) : '';
$referrer = preg_match('/^[a-z0-9.-]{1,253}$/', $referrer) ? preg_replace('/^www\./', '', $referrer) : '';

// ══════════════════════════════════════════
//  GLOBAL DEBOUNCE — one anonymous state file, no visitor data
// ══════════════════════════════════════════
$fh = @fopen(dirname($secretReal) . '/telegram-state.json', 'c+');
if (!$fh) {
    $fh = @fopen(rtrim(sys_get_temp_dir(), '/\\') . '/palmiye-telegram-state.json', 'c+');
}
if (!$fh) {
    palmiye_done(); // fail closed: without the debounce state no message is sent
}
flock($fh, LOCK_EX);
$state = json_decode(stream_get_contents($fh), true);
if (!is_array($state)) {
    $state = ['last_sent' => 0, 'hour_start' => 0, 'sent_this_hour' => 0, 'suppressed' => 0];
}
$now = time();
if ($now - (int) $state['hour_start'] >= 3600) {
    $state['hour_start'] = $now;
    $state['sent_this_hour'] = 0;
}
$send = ($now - (int) $state['last_sent'] >= $MIN_INTERVAL_SEC) && ((int) $state['sent_this_hour'] < $MAX_PER_HOUR);
$suppressedBefore = (int) $state['suppressed'];
if ($send) {
    $state['last_sent'] = $now;
    $state['sent_this_hour'] = (int) $state['sent_this_hour'] + 1;
    $state['suppressed'] = 0;
} else {
    $state['suppressed'] = $suppressedBefore + 1;
}
ftruncate($fh, 0);
rewind($fh);
fwrite($fh, json_encode($state));
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);

if (!$send) {
    palmiye_done();
}

// ══════════════════════════════════════════
//  MESSAGE — plain text (no Markdown parsing of input)
// ══════════════════════════════════════════
$dt = new DateTime('now', new DateTimeZone('Europe/Istanbul'));
$devices = ['mobile' => 'Telefon', 'tablet' => 'Tablet', 'desktop' => 'Masaüstü', 'unknown' => 'Bilinmiyor'];

$message = "🌴 Palmiye Home — yeni ziyaret\n"
    . $dt->format('d.m.Y H:i') . "\n"
    . 'Dil: ' . strtoupper($language) . ' · Cihaz: ' . $devices[$device] . "\n"
    . 'Sayfa: ' . $page
    . ($referrer !== '' ? "\nKaynak: " . $referrer : '')
    . ($suppressedBefore > 0 ? "\n(+" . $suppressedBefore . ' ziyaret daha, bildirim sınırı nedeniyle toplandı)' : '');

$ch = curl_init('https://api.telegram.org/bot' . $botToken . '/sendMessage');
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode(['chat_id' => $chatId, 'text' => $message, 'disable_web_page_preview' => true]),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 5,
    CURLOPT_SSL_VERIFYPEER => true,
]);
curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErrNo = curl_errno($ch);
curl_close($ch);

if ($httpCode !== 200) {
    // Log only a generic code — never the request URL (it contains the token).
    error_log('[Palmiye Telegram] Send failed: http=' . $httpCode . ' curl_errno=' . $curlErrNo);
}
palmiye_done();
