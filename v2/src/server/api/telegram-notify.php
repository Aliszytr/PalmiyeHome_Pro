<?php
/**
 * Palmiye Home V2 — Telegram visit notice for the owner (GoDaddy/cPanel).
 *
 * Message example:  "🌴 Yeni ziyaret · Antalya, Türkiye · TR · Ana sayfa"
 *
 * Privacy (2027 policy, privacy page § "Visit notifications"):
 *   - Accepted from the browser (whitelisted): language, page path, referring HOST name.
 *     No device class, screen size, user agent string or fingerprint data.
 *   - Approximate city/region/country is resolved on this server from a LOCAL GeoIP file
 *     (api/_lib/geo.php). The IP address is used only in memory for that lookup and is never
 *     stored, logged, archived or sent to Telegram.
 *   - No per-visitor files. Spam protection is one global anonymous debounce state
 *     (timestamps + counters only): max 1 message / minute and 20 / hour; visits in between
 *     are summarised as "+N".
 *   - Secret (bot token, chat id) only from the secret file outside the web root.
 *
 * The browser always gets 204 No Content; no error details are returned. PHP 7.0+.
 */
require_once __DIR__ . '/_lib/bootstrap.php';
require_once __DIR__ . '/_lib/geo.php';

// ══════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════
$ALLOWED_ORIGINS   = array('https://palmiyehomekemer.com', 'https://www.palmiyehomekemer.com');
$MIN_INTERVAL_SEC  = 60;    // at most one message per minute ...
$MAX_PER_HOUR      = 20;    // ... and at most 20 messages per rolling hour
$ALLOWED_LANGUAGES = array('en', 'tr', 'de', 'ru');
$PAGE_LABELS       = array(
    '/' => 'Ana sayfa', '/index.html' => 'Ana sayfa', '/tr/' => 'Ana sayfa', '/de/' => 'Ana sayfa', '/ru/' => 'Ana sayfa',
    '/tr/index.html' => 'Ana sayfa', '/de/index.html' => 'Ana sayfa', '/ru/index.html' => 'Ana sayfa',
    '/privacy.html' => 'Gizlilik', '/privacy' => 'Gizlilik', '/tr/privacy.html' => 'Gizlilik', '/de/privacy.html' => 'Gizlilik',
    '/ru/privacy.html' => 'Gizlilik', '/404.html' => '404 sayfası',
);

function palmiye_done($code = 204)
{
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
foreach (array('bot', 'crawler', 'spider', 'lighthouse', 'headless', 'preview') as $needle) {
    if ($ua === '' || strpos($ua, $needle) !== false) {
        palmiye_done();
    }
}
$ua = null; // only used for the bot check above

// ══════════════════════════════════════════
//  SECRET — outside the web root only
// ══════════════════════════════════════════
$secretReal = palmiye_load_secrets();
if (!$secretReal) {
    palmiye_done();
}
if (defined('TELEGRAM_ENABLED') && !TELEGRAM_ENABLED) {
    palmiye_done();
}
$botToken = palmiye_secret('TELEGRAM_BOT_TOKEN');
$chatId   = palmiye_secret('TELEGRAM_CHAT_ID');
if ($botToken === '' || $chatId === '') {
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

$page = isset($body['page']) ? (string) $body['page'] : '';
$pageLabel = isset($PAGE_LABELS[$page]) ? $PAGE_LABELS[$page] : 'Diğer sayfa';

$referrer = isset($body['referrer']) ? strtolower((string) $body['referrer']) : '';
$referrer = preg_match('/^[a-z0-9.-]{1,253}$/', $referrer) ? preg_replace('/^www\./', '', $referrer) : '';

// ══════════════════════════════════════════
//  GLOBAL DEBOUNCE — one anonymous state file, no visitor data
// ══════════════════════════════════════════
$fh = @fopen(dirname($secretReal) . '/telegram-state.json', 'c+');
if (!$fh) {
    palmiye_done(); // fail closed: without the debounce state no message is sent
}
flock($fh, LOCK_EX);
$state = json_decode(stream_get_contents($fh), true);
if (!is_array($state)) {
    $state = array('last_sent' => 0, 'hour_start' => 0, 'sent_this_hour' => 0, 'suppressed' => 0);
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
//  Location is resolved only now, only for a message that is actually sent.
// ══════════════════════════════════════════
$place = palmiye_approx_location();
$dt = new DateTime('now', new DateTimeZone('Europe/Istanbul'));

$message = '🌴 Yeni ziyaret · ' . ($place !== null ? $place : 'Konum bilinmiyor') . ' · ' . strtoupper($language) . ' · ' . $pageLabel
    . "\n" . $dt->format('d.m.Y H:i') . ' · konum yaklaşıktır'
    . ($referrer !== '' ? "\nKaynak: " . $referrer : '')
    . ($suppressedBefore > 0 ? "\n+" . $suppressedBefore . ' ziyaret daha (bildirim sınırı nedeniyle toplandı)' : '');

$ch = curl_init('https://api.telegram.org/bot' . $botToken . '/sendMessage');
curl_setopt_array($ch, array(
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode(array('chat_id' => $chatId, 'text' => $message, 'disable_web_page_preview' => true)),
    CURLOPT_HTTPHEADER     => array('Content-Type: application/json'),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 5,
    CURLOPT_SSL_VERIFYPEER => true,
));
curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErrNo = curl_errno($ch);
curl_close($ch);

if ($httpCode !== 200) {
    // Log only a generic code — never the request URL (it contains the token).
    error_log('[Palmiye Telegram] Send failed: http=' . $httpCode . ' curl_errno=' . $curlErrNo);
}
palmiye_done();
