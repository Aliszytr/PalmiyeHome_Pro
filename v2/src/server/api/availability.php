<?php
/**
 * Palmiye Home V2 — public, anonymous availability endpoint.
 * Served as /api/availability.json (rewrite in .htaccess).
 *
 * Output: status (fresh | stale | unavailable), last successful sync, season and closed
 * date ranges. Never: guest data, reservation codes, prices or feed URLs.
 *
 * Stale-while-revalidate: the last good cache is answered immediately; if a sync is due
 * (cron missed / not configured) it runs AFTER the response has been sent.
 */
require_once __DIR__ . '/_lib/availability.php';

$all = palmiye_settings();
$s = isset($all['availability']) ? $all['availability'] : array();
$season = isset($s['season']) ? $s['season'] : null;
$paths = palmiye_av_paths();
$state = $paths ? palmiye_read_json($paths['state']) : null;
$now = time();
$out = palmiye_av_public($state, $s, $now, $season);

$body = json_encode($out, JSON_UNESCAPED_SLASHES);
$etag = '"' . substr(sha1($body), 0, 16) . '"';
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=' . (int) $s['public_cache_seconds'] . ', stale-while-revalidate=600');
header('ETag: ' . $etag);
header('X-Robots-Tag: noindex');

$due = $paths && (!is_array($state) || !isset($state['last_run'])
    || ($now - (int) $state['last_run']) >= 60 * (int) $s['sync_interval_minutes']);

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    $body = '';
}
header('Content-Length: ' . strlen($body));
echo $body;

if ($due) {
    // Finish the visitor's response first, then refresh in the background.
    ignore_user_abort(true);
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } elseif (function_exists('litespeed_finish_request')) {
        litespeed_finish_request();
    } else {
        @ob_end_flush();
        @flush();
    }
    @set_time_limit(60);
    palmiye_av_run(false);
}
