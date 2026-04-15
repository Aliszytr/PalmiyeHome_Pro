<?php
/**
 * Palmiye Home — Telegram Visitor Notification (GoDaddy/cPanel)
 * 
 * Bu dosya her ziyaretçi bildirimi için çağrılır.
 * Token ve Chat ID .env.php dosyasından okunur — git'e ASLA commit edilmez.
 *
 * KURULUM:
 * 1. api/config/ klasöründeki .env.php dosyasına token ve chat_id girin
 * 2. Bu dosyayı /api/telegram-notify.php olarak yükleyin
 */

// ══════════════════════════════════════════
//  YAPILANDIRMA — .env.php dosyasından oku
// ══════════════════════════════════════════
$configFile = __DIR__ . '/config/.env.php';
if (!file_exists($configFile)) {
    http_response_code(204);
    exit;
}
require_once $configFile;

$botToken = defined('TELEGRAM_BOT_TOKEN') ? TELEGRAM_BOT_TOKEN : '';
$chatId   = defined('TELEGRAM_CHAT_ID')   ? TELEGRAM_CHAT_ID   : '';

if (empty($botToken) || empty($chatId) || 
    strpos($botToken, '_HERE') !== false || 
    strpos($chatId, '_HERE') !== false) {
    http_response_code(204);
    exit;
}

// ══════════════════════════════════════════
//  GÜVENLİK — İzin verilen originler
// ══════════════════════════════════════════
$ALLOWED_ORIGINS = [
    'https://palmiyehomekemer.com',
    'https://www.palmiyehomekemer.com',
];

// ── CORS ──
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$allowed = in_array($origin, $ALLOWED_ORIGINS);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if ($allowed) {
        header("Access-Control-Allow-Origin: $origin");
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Vary: Origin');
    }
    http_response_code($allowed ? 200 : 403);
    exit;
}

// ── Sadece POST ──
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// ── Origin kontrolü ──
if (!$allowed) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

// ── Rate Limiting (IP bazlı — 1 saat cooldown) ──
$rateLimitFile = sys_get_temp_dir() . '/palmiye_notify_' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '.lock';
if (file_exists($rateLimitFile) && (time() - filemtime($rateLimitFile)) < 3600) {
    header("Content-Type: application/json");
    if ($allowed) header("Access-Control-Allow-Origin: $origin");
    http_response_code(200);
    echo json_encode(['status' => 'ok', 'note' => 'cooldown']);
    exit;
}
touch($rateLimitFile);

// ── JSON body oku ──
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!$body || !is_array($body)) {
    http_response_code(400);
    header("Content-Type: application/json");
    if ($allowed) header("Access-Control-Allow-Origin: $origin");
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// ── Bot/Crawler kontrolü ──
$ua = strtolower($_SERVER['HTTP_USER_AGENT'] ?? '');
if (strpos($ua, 'bot') !== false || strpos($ua, 'crawler') !== false || 
    strpos($ua, 'spider') !== false || strpos($ua, 'lighthouse') !== false) {
    http_response_code(204);
    exit;
}

// ── Mesaj oluştur ──
$language = isset($body['language']) ? $body['language'] : 'unknown';
$referrer = isset($body['referrer']) ? $body['referrer'] : '';
$page = isset($body['page']) ? $body['page'] : 'Ana Sayfa';
$screenSize = isset($body['screenSize']) ? $body['screenSize'] : '';
$timestamp = isset($body['timestamp']) ? $body['timestamp'] : date('c');

// Türkiye saati
$dt = new DateTime($timestamp);
$dt->setTimezone(new DateTimeZone('Europe/Istanbul'));
$trTime = $dt->format('d.m.Y H:i:s');

// Cihaz tipi
$deviceType = '🖥️ Masaüstü';
if ($screenSize) {
    $width = intval(explode('x', $screenSize)[0]);
    if ($width > 0) {
        if ($width <= 480) $deviceType = '📱 Telefon';
        elseif ($width <= 1024) $deviceType = '📱 Tablet';
    }
}

// Dil
$langFlags = [
    'tr' => '🇹🇷 Türkçe',
    'en' => '🇬🇧 English',
    'ru' => '🇷🇺 Русский',
    'de' => '🇩🇪 Deutsch',
];
$langDisplay = isset($langFlags[$language]) ? $langFlags[$language] : "🌐 $language";

$message = "🌴 *Yeni Ziyaretçi!*\n"
    . "━━━━━━━━━━━━━━━\n"
    . "🕐 $trTime\n"
    . "$deviceType\n"
    . "🌍 Dil: $langDisplay\n"
    . "📄 Sayfa: $page\n"
    . ($referrer ? "🔗 Kaynak: $referrer\n" : "")
    . "━━━━━━━━━━━━━━━";

// ── Telegram API'ye gönder ──
$telegramUrl = 'https://api.telegram.org/bot' . $botToken . '/sendMessage';
$postData = json_encode([
    'chat_id' => $chatId,
    'text' => $message,
    'parse_mode' => 'Markdown',
    'disable_notification' => false,
]);

$ch = curl_init($telegramUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $postData,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_SSL_VERIFYPEER => true,
]);

$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// ── Yanıt ──
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: $origin");
header("Vary: Origin");

if ($httpCode === 200) {
    echo json_encode(['status' => 'ok']);
} else {
    http_response_code(502);
    echo json_encode(['error' => 'Telegram send failed']);
}
