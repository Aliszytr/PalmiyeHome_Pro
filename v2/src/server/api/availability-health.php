<?php
/**
 * Palmiye Home V2 — OWNER-ONLY availability health (not linked from the site, noindex).
 *
 * Shows per feed (Booking.com / Airbnb): OK or error, last successful sync, fresh/stale,
 * plus a "Sync now" button. Never shows feed URLs or guest data.
 *
 * Access: password whose hash is PALMIYE_AVAILABILITY_ADMIN_HASH in the secret file
 *   php -r "echo password_hash('a-long-passphrase', PASSWORD_DEFAULT), PHP_EOL;"
 * Without that hash the page is disabled (404).
 */
require_once __DIR__ . '/_lib/availability.php';

palmiye_load_secrets();
$hash = palmiye_secret('PALMIYE_AVAILABILITY_ADMIN_HASH');
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('Referrer-Policy: no-referrer');
header('X-Frame-Options: DENY');
if ($hash === '') {
    http_response_code(404);
    exit;
}

session_name('palmiye_owner');
session_set_cookie_params(1800, '/api/availability-health.php', '', true, true);
session_start();
if (empty($_SESSION['csrf'])) {
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION['csrf'];
$msg = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $okCsrf = isset($_POST['csrf']) && hash_equals($csrf, (string) $_POST['csrf']);
    $action = isset($_POST['action']) ? $_POST['action'] : '';
    if (!$okCsrf) {
        $msg = 'Oturum süresi doldu, tekrar deneyin.';
    } elseif ($action === 'login') {
        if (password_verify((string) (isset($_POST['password']) ? $_POST['password'] : ''), $hash)) {
            session_regenerate_id(true);
            $_SESSION['owner'] = true;
        } else {
            sleep(2);
            $msg = 'Hatalı parola.';
        }
    } elseif ($action === 'logout') {
        $_SESSION = array();
        session_destroy();
        header('Location: availability-health.php', true, 303);
        exit;
    } elseif ($action === 'sync' && !empty($_SESSION['owner'])) {
        @set_time_limit(60);
        $r = palmiye_av_run(true);
        $msg = $r === 'synced' ? 'Senkronizasyon tamamlandı.' : ($r === 'busy' ? 'Şu anda başka bir senkronizasyon çalışıyor.' : 'Depolama klasörü yazılamıyor (palmiye-secrets/availability-cache).');
    }
}

function h($s)
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

$owner = !empty($_SESSION['owner']);
?><!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>Müsaitlik durumu — Palmiye Home (yönetici)</title>
<style>
body{font:16px/1.5 system-ui,sans-serif;background:#f8f5ef;color:#1d2a2e;margin:0;padding:24px}main{max-width:760px;margin:0 auto}
table{width:100%;border-collapse:collapse;background:#fff;margin:16px 0}th,td{padding:10px;border-bottom:1px solid #e2d8c8;text-align:left}
.ok{color:#1b5c63;font-weight:700}.bad{color:#a9552f;font-weight:700}button,input{font:inherit;padding:10px 14px;border-radius:8px;border:1px solid #c9bda9}
button{background:#1b5c63;color:#fff;border-color:#1b5c63;cursor:pointer}.msg{padding:10px 14px;background:#fbf2e6;border-radius:8px}
</style></head><body><main>
<h1>Müsaitlik motoru — durum</h1>
<?php if ($msg !== '') : ?><p class="msg" role="status"><?php echo h($msg); ?></p><?php endif; ?>
<?php if (!$owner) : ?>
<form method="post"><input type="hidden" name="csrf" value="<?php echo h($csrf); ?>"><input type="hidden" name="action" value="login">
<label>Parola <input type="password" name="password" autocomplete="current-password" required></label> <button>Giriş</button></form>
<?php else :
    $all = palmiye_settings();
    $s = $all['availability'];
    $paths = palmiye_av_paths();
    $state = $paths ? palmiye_read_json($paths['state']) : null;
    $pub = palmiye_av_public($state, $s, time(), isset($s['season']) ? $s['season'] : null);
    $health = palmiye_av_health($state, $s, time());
    $names = array('booking' => 'Booking.com', 'airbnb' => 'Airbnb');
    ?>
<p>Genel durum: <strong class="<?php echo $pub['status'] === 'fresh' ? 'ok' : 'bad'; ?>"><?php echo h($pub['status']); ?></strong>
 · Son başarılı tam senkron (UTC): <?php echo h($pub['last_successful_sync'] ?: '—'); ?>
 · Sezon: <?php echo $pub['season'] ? h($pub['season']['start'] . ' → ' . $pub['season']['end']) : '<span class="bad">tanımlı değil (hiçbir gün müsait gösterilmez)</span>'; ?></p>
<table><thead><tr><th>Kaynak</th><th>Durum</th><th>Son başarılı</th><th>Kapalı aralık</th></tr></thead><tbody>
<?php foreach ($health as $src => $f) : ?>
<tr><td><?php echo h($names[$src]); ?></td>
<td class="<?php echo $f['ok'] ? 'ok' : 'bad'; ?>"><?php echo $f['ok'] ? 'OK' : h($f['error'] ?: 'hata'); ?><?php echo $f['ok'] && !$f['fresh'] ? ' (eski)' : ''; ?></td>
<td><?php echo $f['last_success_minutes_ago'] === null ? '—' : h($f['last_success_minutes_ago']) . ' dk önce'; ?></td>
<td><?php echo h($f['closed_ranges']); ?></td></tr>
<?php endforeach; ?>
</tbody></table>
<form method="post" style="display:inline"><input type="hidden" name="csrf" value="<?php echo h($csrf); ?>"><input type="hidden" name="action" value="sync"><button>Şimdi senkronize et</button></form>
<form method="post" style="display:inline"><input type="hidden" name="csrf" value="<?php echo h($csrf); ?>"><input type="hidden" name="action" value="logout"><button style="background:#fff;color:#1d2a2e">Çıkış</button></form>
<?php endif; ?>
</main></body></html>
