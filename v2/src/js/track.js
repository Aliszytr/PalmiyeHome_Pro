/* Palmiye Home V2 — measurement, consent and visit notice.
 *
 * One click = at most one GA4 event (+ one Google Ads conversion for the three
 * booking channels). Event taxonomy:
 *   whatsapp_click        GA4 + Ads conversion "whatsapp"
 *   booking_click         GA4 + Ads conversion "booking"
 *   airbnb_click          GA4 + Ads conversion "airbnb"
 *   booking_review_click  GA4 only — never a booking conversion
 *   availability_check    GA4 only — "Check availability" CTA or a completed date range
 *
 * IDs and labels come from config/site-config.json via #site-data (never hard-coded here).
 * Consent: Google Consent Mode v2 defaults are set inline in <head> (all denied).
 * The visitor's choice is stored in localStorage "palmiye_cookies" (accepted | declined),
 * the same key production uses, so earlier choices stay valid.
 */
(function () {
  'use strict';

  var dataEl = document.getElementById('site-data');
  if (!dataEl) return;
  var D = JSON.parse(dataEl.textContent);
  var T = D.tracking;
  var CONSENT_KEY = 'palmiye_cookies';
  var DEBUG = /[?&]debug_tracking=1\b/.test(location.search) || location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  function store(kind, key, value) {
    try {
      var s = kind === 'session' ? window.sessionStorage : window.localStorage;
      if (value === undefined) return s.getItem(key);
      s.setItem(key, value);
    } catch (e) { return null; }
    return value;
  }

  function gtagSafe() {
    if (typeof window.gtag === 'function') window.gtag.apply(window, arguments);
  }

  // ── Events ─────────────────────────────────────────────
  var CONVERSION_FOR = { whatsapp_click: 'whatsapp', booking_click: 'booking', airbnb_click: 'airbnb' };
  var log = window.__palmiyeEvents = window.__palmiyeEvents || [];

  function track(name, params) {
    var p = { language: D.lang };
    for (var k in params) if (Object.prototype.hasOwnProperty.call(params, k) && params[k] !== undefined) p[k] = params[k];
    gtagSafe('event', name, p);
    var key = CONVERSION_FOR[name];
    var label = key && T.ads_conversion_labels[key];
    if (label) gtagSafe('event', 'conversion', { send_to: T.google_ads_id + '/' + label });
    log.push({ event: name, params: p, conversion: label ? T.google_ads_id + '/' + label : null });
    if (DEBUG) console.info('[track]', name, p, label ? '+ Ads conversion ' + key : '');
  }

  function classify(a) {
    var named = a.getAttribute('data-track');
    if (named) return named;
    var h = (a.getAttribute('href') || '').toLowerCase();
    if (h.indexOf('wa.me') !== -1 || h.indexOf('whatsapp.com') !== -1) return 'whatsapp_click';
    if (h.indexOf('booking.com') !== -1) return h.indexOf('#tab-reviews') !== -1 ? 'booking_review_click' : 'booking_click';
    if (h.indexOf('airbnb.') !== -1) return 'airbnb_click';
    return null;
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('a[href], [data-track]') : null;
    if (!el) return;
    var name = classify(el);
    if (!name) return;
    var section = el.closest('section[id], footer[id], header');
    track(name, {
      cta_location: el.getAttribute('data-cta') || (section && section.id) || 'page',
      method: name === 'availability_check' ? 'cta' : undefined
    });
  }, true);

  window.PalmiyeTrack = { track: track };

  // ── Consent ────────────────────────────────────────────
  var GRANTED = { ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', analytics_storage: 'granted' };
  var DENIED = { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied' };
  var tagLoaded = !!document.querySelector('script[src*="googletagmanager.com/gtag/js"]');

  function loadTagIfBasic() {
    if (tagLoaded || T.consent_mode !== 'basic') return;
    tagLoaded = true;
    gtagSafe('js', new Date());
    gtagSafe('config', T.google_ads_id);
    gtagSafe('config', T.ga4_measurement_id);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + T.google_ads_id;
    document.head.appendChild(s);
  }

  function clearGoogleCookies() {
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (/^(_ga|_gid|_gat|_gcl_)/.test(name)) {
        var host = location.hostname;
        ['', host, '.' + host.replace(/^www\./, '')].forEach(function (d) {
          document.cookie = name + '=; Max-Age=0; path=/' + (d ? '; domain=' + d : '');
        });
      }
    });
  }

  function applyChoice(choice) {
    store('local', CONSENT_KEY, choice);
    if (choice === 'accepted') {
      gtagSafe('consent', 'update', GRANTED);
      loadTagIfBasic();
    } else {
      gtagSafe('consent', 'update', DENIED);
      clearGoogleCookies();
    }
    if (DEBUG) console.info('[consent]', choice);
  }

  var banner = document.getElementById('consent');
  function showBanner() {
    if (!banner) return;
    banner.hidden = false;
    var first = banner.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  }
  if (banner) {
    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      applyChoice(b.getAttribute('data-consent'));
      banner.hidden = true;
    });
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-consent-open]')) showBanner();
  });

  var stored = store('local', CONSENT_KEY);
  if (stored === 'accepted') loadTagIfBasic();
  else if (stored !== 'declined') showBanner();

  // ── Visit notice (server-side Telegram, anonymous) ─────
  function notifyVisit() {
    if (!D.telegram_endpoint || store('session', 'palmiye_notified')) return;
    if (navigator.webdriver || /bot|crawl|spider|lighthouse|headless|preview/i.test(navigator.userAgent)) return;
    store('session', 'palmiye_notified', '1');
    var device = window.matchMedia('(max-width: 640px)').matches ? 'mobile'
      : window.matchMedia('(max-width: 1024px)').matches ? 'tablet' : 'desktop';
    var ref = '';
    try {
      var r = document.referrer ? new URL(document.referrer).hostname : '';
      if (r && r !== location.hostname) ref = r;
    } catch (e) { /* ignore */ }
    var body = JSON.stringify({ language: D.lang, device: device, page: location.pathname, referrer: ref });
    try {
      fetch(D.telegram_endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true, credentials: 'omit' })
        .catch(function () {});
    } catch (e) { /* ignore */ }
  }
  if (document.readyState === 'complete') notifyVisit();
  else window.addEventListener('load', notifyVisit);
})();
