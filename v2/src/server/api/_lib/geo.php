<?php
/**
 * Palmiye Home V2 — approximate visitor location for the owner's Telegram notice.
 *
 * Privacy rules (privacy page § "Visit notifications"):
 *   - The IP address is read from REMOTE_ADDR into a local variable, looked up in a LOCAL
 *     GeoIP database file (no external API), and discarded. It is never written to a file,
 *     a log, the debounce state or the Telegram message.
 *   - Only city / region / country come back. Accuracy is approximate (VPN, mobile carriers).
 *   - X-Forwarded-For is ignored (spoofable).
 *
 * Needs (deployment inputs, both outside the web root, paths in the secret file):
 *   PALMIYE_GEOIP_DB      e.g. /home/<user>/palmiye-secrets/geo/dbip-city-lite.mmdb
 *                         (DB-IP "IP to City Lite", CC BY 4.0, or MaxMind GeoLite2-City)
 *   PALMIYE_GEOIP_READER  autoload.php of the official MaxMind DB reader (maxmind-db/reader,
 *                         pure PHP, Apache-2.0) — not needed if the maxminddb PHP extension exists.
 * Without them the notice simply says the location is unknown.
 */

require_once __DIR__ . '/bootstrap.php';

function palmiye_country_tr($code, $fallback)
{
    static $names = array(
        'TR' => 'Türkiye', 'DE' => 'Almanya', 'RU' => 'Rusya', 'GB' => 'Birleşik Krallık', 'NL' => 'Hollanda',
        'UA' => 'Ukrayna', 'PL' => 'Polonya', 'AT' => 'Avusturya', 'CH' => 'İsviçre', 'BE' => 'Belçika',
        'FR' => 'Fransa', 'IT' => 'İtalya', 'ES' => 'İspanya', 'SE' => 'İsveç', 'NO' => 'Norveç', 'DK' => 'Danimarka',
        'FI' => 'Finlandiya', 'CZ' => 'Çekya', 'SK' => 'Slovakya', 'RO' => 'Romanya', 'BG' => 'Bulgaristan',
        'RS' => 'Sırbistan', 'HU' => 'Macaristan', 'LT' => 'Litvanya', 'LV' => 'Letonya', 'EE' => 'Estonya',
        'KZ' => 'Kazakistan', 'AZ' => 'Azerbaycan', 'GE' => 'Gürcistan', 'BY' => 'Belarus', 'IL' => 'İsrail',
        'IE' => 'İrlanda', 'US' => 'ABD', 'CA' => 'Kanada', 'AE' => 'BAE', 'SA' => 'Suudi Arabistan',
        'IR' => 'İran', 'IQ' => 'Irak', 'GR' => 'Yunanistan', 'CY' => 'Kıbrıs', 'MD' => 'Moldova', 'UZ' => 'Özbekistan',
    );
    return isset($names[$code]) ? $names[$code] : $fallback;
}

/** Returns a short Turkish label such as "Antalya, Türkiye", or null. */
function palmiye_approx_location()
{
    palmiye_load_secrets();
    $db = palmiye_secret('PALMIYE_GEOIP_DB');
    if ($db === '' || !is_readable($db)) {
        return null;
    }
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        return null;
    }
    $rec = null;
    try {
        if (!class_exists('MaxMind\\Db\\Reader')) {
            $reader = palmiye_secret('PALMIYE_GEOIP_READER');
            if ($reader !== '' && is_readable($reader)) {
                require_once $reader;
            }
        }
        if (class_exists('MaxMind\\Db\\Reader')) {
            $r = new \MaxMind\Db\Reader($db);
            $rec = $r->get($ip);
            $r->close();
        }
    } catch (Exception $e) {
        $rec = null;
    }
    $ip = null; // discarded — never stored or sent
    unset($ip);
    if (!is_array($rec)) {
        return null;
    }
    $name = function ($node) {
        if (!is_array($node) || !isset($node['names']) || !is_array($node['names'])) {
            return '';
        }
        return isset($node['names']['en']) ? (string) $node['names']['en'] : (string) reset($node['names']);
    };
    $city = isset($rec['city']) ? $name($rec['city']) : '';
    $region = (isset($rec['subdivisions'][0])) ? $name($rec['subdivisions'][0]) : '';
    $cc = isset($rec['country']['iso_code']) ? strtoupper((string) $rec['country']['iso_code']) : '';
    $country = palmiye_country_tr($cc, isset($rec['country']) ? $name($rec['country']) : '');
    $place = $city !== '' ? $city : ($region !== '' ? $region . ' bölgesi' : '');
    $label = trim($place . ($place !== '' && $country !== '' ? ', ' : '') . $country);
    // Plain text only: strip anything unexpected from the database strings.
    $label = preg_replace('/[^\p{L}\p{N} ,.\'()-]/u', '', $label);
    if ($label === '') {
        return null;
    }
    return function_exists('mb_substr') ? mb_substr($label, 0, 80, 'UTF-8') : $label;
}
