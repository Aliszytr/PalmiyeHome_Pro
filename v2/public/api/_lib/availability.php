<?php
/**
 * Palmiye Home V2 — availability engine (production, PHP 7.0+).
 *
 * Mirrors v2/tools/availability_engine.py rule for rule; v2/tools/test_availability.py
 * documents the expected behaviour and `php api/availability-sync.php --selftest` runs
 * the same scenarios on the server.
 *
 *   Booking.com iCal + Airbnb iCal → union of closed nights (a night closed in EITHER OTA is
 *   closed on the website). Direct/WhatsApp bookings are blocked by the owner in Booking.com or
 *   Airbnb and therefore arrive through those two feeds; there is no third calendar.
 *   → anonymous JSON (closed ranges, last successful sync, fresh/stale/unavailable).
 *
 * Only DTSTART / DTEND / STATUS are read from a feed. Guest names, e-mails, phones,
 * reservation codes, prices, UIDs and the feed URLs never enter the cache or the output.
 * FAIL-SAFE: an erroring feed keeps its last good data; old data turns the status to
 * 'stale' and then 'unavailable' (the site then shows no date as free).
 */

require_once __DIR__ . '/bootstrap.php';

define('PALMIYE_AV_SOURCES', 'booking,airbnb');

class PalmiyeFeedError extends Exception
{
}

function palmiye_av_sources()
{
    return explode(',', PALMIYE_AV_SOURCES);
}

function palmiye_av_tz()
{
    return new DateTimeZone('Europe/Istanbul');
}

function palmiye_av_add_days($ymd, $n)
{
    $d = DateTime::createFromFormat('!Y-m-d', $ymd, palmiye_av_tz());
    $d->modify(($n >= 0 ? '+' : '') . (int) $n . ' day');
    return $d->format('Y-m-d');
}

/** iCal DATE or DATE-TIME → Y-m-d in Istanbul local time. */
function palmiye_av_to_date($value)
{
    if (!preg_match('/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/', trim($value), $m)) {
        throw new PalmiyeFeedError('parse_error');
    }
    if (!isset($m[4]) || $m[4] === '') {
        return sprintf('%s-%s-%s', $m[1], $m[2], $m[3]);
    }
    if (isset($m[7]) && $m[7] === 'Z') {
        $dt = new DateTime(sprintf('%s-%s-%sT%s:%s:%sZ', $m[1], $m[2], $m[3], $m[4], $m[5], $m[6]));
        $dt->setTimezone(palmiye_av_tz());
        return $dt->format('Y-m-d');
    }
    return sprintf('%s-%s-%s', $m[1], $m[2], $m[3]); // floating / TZID local time
}

/** Returns array(ranges, events). Each range = array(start, endExclusive). */
function palmiye_av_parse_ics($text)
{
    if (!is_string($text) || strpos(substr($text, 0, 2000), 'BEGIN:VCALENDAR') === false
        || strpos(substr($text, -2000), 'END:VCALENDAR') === false) {
        throw new PalmiyeFeedError('not_a_calendar');
    }
    $text = str_replace(array("\r\n", "\r"), "\n", $text);
    $text = preg_replace('/\n[ \t]/', '', $text);
    $ranges = array();
    $events = 0;
    $cur = null;
    foreach (explode("\n", $text) as $line) {
        if ($line === 'BEGIN:VEVENT') {
            $cur = array();
            continue;
        }
        if ($line === 'END:VEVENT') {
            if ($cur === null || !isset($cur['DTSTART'])) {
                throw new PalmiyeFeedError('parse_error');
            }
            $events++;
            if (isset($cur['STATUS']) && strtoupper($cur['STATUS']) === 'CANCELLED') {
                $cur = null;
                continue;
            }
            $start = $cur['DTSTART'];
            $end = isset($cur['DTEND']) ? $cur['DTEND'] : palmiye_av_add_days($start, 1);
            if ($end <= $start) {
                $end = palmiye_av_add_days($start, 1);
            }
            $ranges[] = array($start, $end);
            $cur = null;
            continue;
        }
        if ($cur === null || strpos($line, ':') === false) {
            continue;
        }
        list($head, $value) = explode(':', $line, 2);
        $parts = explode(';', $head);
        $name = strtoupper($parts[0]);
        if ($name === 'DTSTART' || $name === 'DTEND') {
            $cur[$name] = palmiye_av_to_date($value);
        } elseif ($name === 'STATUS') {
            $cur[$name] = trim($value);
        }
        // SUMMARY, DESCRIPTION, UID, ATTENDEE … are deliberately ignored.
    }
    return array($ranges, $events);
}

function palmiye_av_merge($ranges)
{
    usort($ranges, function ($a, $b) {
        return strcmp($a[0] . $a[1], $b[0] . $b[1]);
    });
    $out = array();
    foreach ($ranges as $r) {
        $n = count($out);
        if ($n && $r[0] <= $out[$n - 1][1]) {
            if ($r[1] > $out[$n - 1][1]) {
                $out[$n - 1][1] = $r[1];
            }
        } else {
            $out[] = array($r[0], $r[1]);
        }
    }
    return $out;
}

function palmiye_av_clip($ranges, $today, $horizonDays)
{
    $lo = palmiye_av_add_days($today, -1);
    $hi = palmiye_av_add_days($today, $horizonDays);
    $out = array();
    foreach ($ranges as $r) {
        if ($r[1] > $lo && $r[0] < $hi) {
            $out[] = array(max($r[0], $lo), min($r[1], $hi));
        }
    }
    return $out;
}

/** HTTP GET of a feed. Never logs the URL (it is a secret). */
function palmiye_av_fetch($url, $timeout)
{
    if (!preg_match('#^https://#i', $url)) {
        throw new PalmiyeFeedError('bad_url');
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, array(
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_PROTOCOLS      => CURLPROTO_HTTPS,
        CURLOPT_TIMEOUT        => (int) $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'PalmiyeHome-Availability/1.0',
        CURLOPT_HTTPHEADER     => array('Accept: text/calendar'),
    ));
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_errno($ch);
    curl_close($ch);
    if ($err) {
        throw new PalmiyeFeedError($err === 28 ? 'timeout' : 'fetch_failed');
    }
    if (strlen((string) $body) > 5 * 1024 * 1024) {
        throw new PalmiyeFeedError('too_large');
    }
    return array($code, (string) $body);
}

/** One sync run. $fetch = callable($url, $timeout) → array(status, body). */
function palmiye_av_sync($state, $feeds, $settings, $nowTs, $fetch)
{
    if (!is_array($state)) {
        $state = array('version' => 1, 'feeds' => array());
    }
    $now = new DateTime('@' . $nowTs);
    $now->setTimezone(palmiye_av_tz());
    $today = $now->format('Y-m-d');
    foreach (palmiye_av_sources() as $src) {
        $url = isset($feeds[$src]) ? $feeds[$src] : '';
        if (!isset($state['feeds'][$src])) {
            $state['feeds'][$src] = array('last_success' => null, 'closed' => array(), 'error' => null, 'events' => 0, 'empty_seen' => 0);
        }
        $f = $state['feeds'][$src];
        $f['configured'] = ($url !== '');
        if ($url === '') {
            $f['error'] = 'not_configured';
            $state['feeds'][$src] = $f;
            continue;
        }
        $f['last_attempt'] = $nowTs;
        try {
            try {
                list($status, $body) = call_user_func($fetch, $url, $settings['fetch_timeout_seconds']);
            } catch (PalmiyeFeedError $e) {
                throw $e;
            } catch (Exception $e) {
                throw new PalmiyeFeedError('fetch_failed');
            }
            if ((int) $status !== 200) {
                throw new PalmiyeFeedError('http_' . (int) $status);
            }
            list($ranges, $events) = palmiye_av_parse_ics($body);
            $clipped = palmiye_av_merge(palmiye_av_clip($ranges, $today, (int) $settings['horizon_days']));
            $hadFuture = false;
            foreach ((array) $f['closed'] as $r) {
                if ($r[1] > $today) {
                    $hadFuture = true;
                    break;
                }
            }
            $emptySeen = isset($f['empty_seen']) ? (int) $f['empty_seen'] : 0;
            if ($events === 0 && $hadFuture && $emptySeen < 1) {
                $f['empty_seen'] = $emptySeen + 1;
                throw new PalmiyeFeedError('suspect_empty');
            }
            $f['empty_seen'] = 0;
            $f['closed'] = $clipped;
            $f['events'] = $events;
            $f['last_success'] = $nowTs;
            $f['error'] = null;
        } catch (PalmiyeFeedError $e) {
            $f['error'] = $e->getMessage(); // last good 'closed' list is kept
        }
        $state['feeds'][$src] = $f;
    }
    $state['last_run'] = $nowTs;
    return $state;
}

/** The anonymous JSON for /api/availability.json. */
function palmiye_av_public($state, $settings, $nowTs, $window)
{
    $now = new DateTime('@' . $nowTs);
    $now->setTimezone(palmiye_av_tz());
    $today = $now->format('Y-m-d');
    $feeds = array();
    $never = false;
    $byName = (is_array($state) && isset($state['feeds'])) ? $state['feeds'] : array();
    foreach (palmiye_av_sources() as $src) {
        // Both OTAs are required: a missing or never-synced source makes the calendar 'unavailable'.
        if (empty($byName[$src]['configured'])) {
            $never = true;
        } else {
            $feeds[] = $byName[$src];
        }
    }
    $oldest = null;
    $status = 'unavailable';
    foreach ($feeds as $f) {
        if (empty($f['last_success'])) {
            $never = true;
        } elseif ($oldest === null || $f['last_success'] < $oldest) {
            $oldest = (int) $f['last_success'];
        }
    }
    if ($feeds && !$never) {
        $age = ($nowTs - $oldest) / 60;
        $status = $age <= $settings['stale_after_minutes'] ? 'fresh'
            : ($age <= $settings['expire_after_minutes'] ? 'stale' : 'unavailable');
    } else {
        $oldest = null;
    }
    $all = array();
    foreach ($feeds as $f) {
        foreach ((array) $f['closed'] as $r) {
            $all[] = $r;
        }
    }
    $closed = array();
    foreach (palmiye_av_merge($all) as $r) {
        if ($r[1] > $today) {
            $closed[] = array('start' => $r[0], 'end' => $r[1]);
        }
    }
    $hasWindow = is_array($window) && !empty($window['start']) && !empty($window['end']);
    return array(
        'version'              => 1,
        'status'               => $status,
        'last_successful_sync' => $oldest ? gmdate('Y-m-d\TH:i:s\Z', $oldest) : null,
        'booking_window'               => $hasWindow ? array('start' => $window['start'], 'end' => $window['end']) : null,
        'closed'               => $closed,
        'ranges'               => 'start inclusive, end exclusive (check-out day)',
    );
}

/** Owner-only diagnostics. Never includes feed URLs. */
function palmiye_av_health($state, $settings, $nowTs)
{
    $out = array();
    foreach (palmiye_av_sources() as $src) {
        $f = (is_array($state) && isset($state['feeds'][$src])) ? $state['feeds'][$src] : array();
        $ls = empty($f['last_success']) ? null : (int) $f['last_success'];
        $age = $ls === null ? null : (int) round(($nowTs - $ls) / 60);
        $out[$src] = array(
            'configured'               => !empty($f['configured']),
            'ok'                       => !empty($f['configured']) && empty($f['error']),
            'error'                    => isset($f['error']) ? $f['error'] : null,
            'last_success_minutes_ago' => $age,
            'fresh'                    => $age !== null && $age <= $settings['stale_after_minutes'],
            'closed_ranges'            => isset($f['closed']) ? count($f['closed']) : 0,
            'events_in_feed'           => isset($f['events']) ? (int) $f['events'] : 0,
        );
    }
    return $out;
}

// ── Production wiring ────────────────────────────────────────────────

function palmiye_av_feeds_from_secrets()
{
    palmiye_load_secrets();
    return array(
        'booking' => palmiye_secret('PALMIYE_ICAL_BOOKING'),
        'airbnb'  => palmiye_secret('PALMIYE_ICAL_AIRBNB'),
    );
}

function palmiye_av_paths()
{
    $dir = palmiye_data_dir('availability-cache');
    if (!$dir) {
        return false;
    }
    return array('state' => $dir . '/state.json', 'lock' => $dir . '/sync.lock');
}

/**
 * Runs a sync if nobody else is running one. $force = ignore the interval.
 * Returns 'synced', 'busy', 'not_due' or 'no_storage'.
 */
function palmiye_av_run($force)
{
    $paths = palmiye_av_paths();
    if (!$paths) {
        return 'no_storage';
    }
    $all = palmiye_settings();
    $s = isset($all['availability']) ? $all['availability'] : array();
    $lock = @fopen($paths['lock'], 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) {
        return 'busy';
    }
    $state = palmiye_read_json($paths['state']);
    $now = time();
    if (!$force && is_array($state) && isset($state['last_run'])
        && ($now - (int) $state['last_run']) < 60 * (int) $s['sync_interval_minutes']) {
        flock($lock, LOCK_UN);
        fclose($lock);
        return 'not_due';
    }
    $state = palmiye_av_sync($state, palmiye_av_feeds_from_secrets(), $s, $now, 'palmiye_av_fetch');
    palmiye_write_json($paths['state'], $state);
    flock($lock, LOCK_UN);
    fclose($lock);
    return 'synced';
}
