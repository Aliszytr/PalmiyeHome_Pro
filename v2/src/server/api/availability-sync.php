<?php
/**
 * Palmiye Home V2 — scheduled availability sync (CLI only).
 *
 * cPanel → Cron Jobs, every 20 minutes:
 *   /usr/local/bin/php /home/<user>/public_html/api/availability-sync.php >/dev/null 2>&1
 *
 *   php availability-sync.php            sync if due
 *   php availability-sync.php --force    sync now
 *   php availability-sync.php --selftest --fixtures=/path/to/selftest-fixtures
 *                                        run the fail-safe scenarios against the invented test
 *                                        fixtures (same expectations as v2/tools/test_availability.py).
 *                                        Fixtures are not deployed in the web root; the release
 *                                        package ships them in deployment/selftest-fixtures.
 *
 * Over HTTP this file answers 404 and does nothing.
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/_lib/availability.php';

$args = array_slice($argv, 1);

if (in_array('--selftest', $args, true)) {
    $fx = '';
    foreach ($args as $a) {
        if (strpos($a, '--fixtures=') === 0) {
            $fx = rtrim(substr($a, 11), '/\\') . '/';
        }
    }
    if ($fx === '' || !is_readable($fx . 'booking.ics')) {
        fwrite(STDERR, "Usage: php availability-sync.php --selftest --fixtures=/path/to/selftest-fixtures\n");
        exit(2);
    }
    $all = palmiye_settings();
    $S = $all['availability'];
    $season = array('start' => '2027-05-01', 'end' => '2027-10-31');
    $now = gmmktime(9, 0, 0, 5, 1, 2027);
    $feeds = array('booking' => 'secret://booking', 'airbnb' => 'secret://airbnb');
    $ok = array('secret://booking' => 'booking.ics', 'secret://airbnb' => 'airbnb.ics');
    $fails = 0;
    $check = function ($name, $cond) use (&$fails) {
        echo ($cond ? 'PASS ' : 'FAIL ') . $name . "\n";
        if (!$cond) {
            $fails++;
        }
    };
    $fetcher = function ($map) use ($fx) {
        return function ($url, $timeout) use ($map, $fx) {
            $w = $map[$url];
            if ($w instanceof Exception) {
                throw $w;
            }
            if (is_array($w)) {
                return $w;
            }
            return array(200, file_get_contents($fx . $w));
        };
    };
    $ranges = function ($pub) {
        $o = array();
        foreach ($pub['closed'] as $c) {
            $o[] = $c['start'] . '/' . $c['end'];
        }
        return implode(',', $o);
    };
    $expected = '2027-06-10/2027-06-14,2027-07-01/2027-07-12,2027-07-20/2027-07-25,2027-08-05/2027-08-09';
    $closedOn = function ($pub, $day) {
        foreach ($pub['closed'] as $c) {
            if ($c['start'] <= $day && $day < $c['end']) {
                return true;
            }
        }
        return false;
    };

    $st = palmiye_av_sync(null, $feeds, $S, $now, $fetcher($ok));
    $pub = palmiye_av_public($st, $S, $now, $season);
    $check('sources are exactly Booking.com + Airbnb', palmiye_av_sources() === array('booking', 'airbnb'));
    $check('union of Booking + Airbnb, overlaps/duplicates/adjacent merged', $ranges($pub) === $expected);
    $check('status fresh', $pub['status'] === 'fresh');
    $check('Booking-only closure is closed on the web', $closedOn($pub, '2027-08-05') && $closedOn($pub, '2027-08-08') && !$closedOn($pub, '2027-08-09'));
    $check('Airbnb-only closure is closed on the web', $closedOn($pub, '2027-07-20') && $closedOn($pub, '2027-07-24') && !$closedOn($pub, '2027-07-25'));
    list($edge, $n) = palmiye_av_parse_ics(file_get_contents($fx . 'parser_edge.ics'));
    $edgeStr = implode(',', array_map(function ($x) {
        return $x[0] . '/' . $x[1];
    }, palmiye_av_merge($edge)));
    $check('parser: UTC→Istanbul, cancelled skipped, missing DTEND = one night', $edgeStr === '2027-09-01/2027-09-03,2027-09-20/2027-09-21' && $n === 3);
    $blob = json_encode($pub) . json_encode($st);
    $check('no personal data / feed URL in cache or output', strpos($blob, 'Test Guest') === false
        && strpos($blob, 'FIXTURE-RES') === false && strpos($blob, 'secret://') === false && strpos($blob, 'example.invalid') === false);
    $later = $now + 1800;
    $st2 = palmiye_av_sync($st, $feeds, $S, $later, $fetcher(array_merge($ok, array('secret://airbnb' => new PalmiyeFeedError('fetch_failed')))));
    $check('feed error keeps last good data', $ranges(palmiye_av_public($st2, $S, $later, $season)) === $expected && $st2['feeds']['airbnb']['error'] === 'fetch_failed');
    $html = array(200, file_get_contents($fx . 'not_calendar.txt'));
    $st3 = palmiye_av_sync($st, $feeds, $S, $later, $fetcher(array_merge($ok, array('secret://booking' => $html))));
    $check('HTML instead of iCal rejected, data kept', $st3['feeds']['booking']['error'] === 'not_a_calendar' && $ranges(palmiye_av_public($st3, $S, $later, $season)) === $expected);
    $allFail = array();
    foreach ($ok as $k => $v) {
        $allFail[$k] = new PalmiyeFeedError('fetch_failed');
    }
    $tStale = $now + 60 * ($S['stale_after_minutes'] + 5);
    $check('stale ladder: stale', palmiye_av_public(palmiye_av_sync($st, $feeds, $S, $tStale, $fetcher($allFail)), $S, $tStale, $season)['status'] === 'stale');
    $tExp = $now + 60 * ($S['expire_after_minutes'] + 5);
    $check('stale ladder: unavailable', palmiye_av_public(palmiye_av_sync($st, $feeds, $S, $tExp, $fetcher($allFail)), $S, $tExp, $season)['status'] === 'unavailable');
    $miss = palmiye_av_sync(null, array('booking' => 'secret://booking', 'airbnb' => ''), $S, $now, $fetcher($ok));
    $check('missing Airbnb secret → unavailable (no Booking-only fail-open)', palmiye_av_public($miss, $S, $now, $season)['status'] === 'unavailable');
    $check('Airbnb never synced → unavailable', palmiye_av_public(palmiye_av_sync(null, $feeds, $S, $now, $fetcher(array_merge($ok, array('secret://airbnb' => array(403, ''))))), $S, $now, $season)['status'] === 'unavailable');
    $check('no feed configured → unavailable', palmiye_av_public(palmiye_av_sync(null, array(), $S, $now, $fetcher(array())), $S, $now, $season)['status'] === 'unavailable');
    $e1 = palmiye_av_sync($st, $feeds, $S, $later, $fetcher(array_merge($ok, array('secret://booking' => 'empty.ics'))));
    $check('sudden empty calendar rejected once', $e1['feeds']['booking']['error'] === 'suspect_empty');
    $e2 = palmiye_av_sync($e1, $feeds, $S, $later + 1200, $fetcher(array_merge($ok, array('secret://booking' => 'empty.ics'))));
    $check('second empty answer accepted', $e2['feeds']['booking']['error'] === null && count($e2['feeds']['booking']['closed']) === 0);
    $check('null season stays null', palmiye_av_public($st, $S, $now, null)['season'] === null);
    $check('data dir outside web root is writable', palmiye_av_paths() !== false);
    echo $fails ? "\nSELFTEST FAILED ($fails)\n" : "\nSELFTEST OK\n";
    exit($fails ? 1 : 0);
}

$result = palmiye_av_run(in_array('--force', $args, true));
echo $result . "\n";
exit($result === 'no_storage' ? 1 : 0);
