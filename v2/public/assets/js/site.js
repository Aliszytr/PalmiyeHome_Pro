/* Palmiye Home V2 — page behaviour: navigation, language hint, channel order, gallery, map, availability calendar
 * and reservation links. Texts and business values come from #site-data, which the
 * build generates from v2/src/i18n/*.json and config/site-config.json. */
(function () {
  'use strict';

  var D = JSON.parse(document.getElementById('site-data').textContent);
  var L = D.links;
  var t = function (key, vars) {
    var s = D.i18n[key] || key;
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // ── Navigation ─────────────────────────────────────────
  var toggle = $('.nav-toggle');
  var nav = $('#site-nav');
  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', toggle.getAttribute(open ? 'data-label-close' : 'data-label-open'));
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setMenu(!nav.classList.contains('is-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
    });
  }

  // ── Language: remember an explicit choice; on the root page only SUGGEST a language ──
  // No automatic redirect: the root (English) page is stable for every visitor and crawler.
  function remember(lang) { try { localStorage.setItem('palmiye_lang', lang); } catch (err) { /* ignore */ } }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('[data-lang-link]');
    if (a) remember(a.getAttribute('data-lang-link'));
  });
  var hint = $('[data-lang-suggest]');
  if (hint && D.lang_suggest) {
    var stored = null;
    try { stored = localStorage.getItem('palmiye_lang'); } catch (err) { /* ignore */ }
    var langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''])
      .map(function (l) { return String(l).slice(0, 2).toLowerCase(); });
    var want = stored && stored !== D.lang ? stored : (stored ? null : langs.filter(function (l) { return D.lang_suggest[l]; })[0]);
    var s = want && D.lang_suggest[want];
    if (s && !/bot|crawl|spider|lighthouse/i.test(navigator.userAgent)) {
      hint.setAttribute('lang', want);
      $('[data-ls-text]', hint).textContent = s.text;
      var link = $('[data-ls-link]', hint);
      link.textContent = s['switch'];
      link.href = s.href + location.hash;
      link.setAttribute('data-lang-link', want);
      link.setAttribute('hreflang', want);
      $('[data-ls-dismiss-label]', hint).textContent = s.dismiss;
      hint.hidden = false;
      $('[data-ls-dismiss]', hint).addEventListener('click', function () { hint.hidden = true; remember(D.lang); });
    }
  }

  // ── Reservation channel order by market ────────────────
  // Booking.com may not accept bookings for Turkish properties made from within Turkey.
  // The market is guessed ONLY from the browser's time zone (no IP, no network request);
  // ?market=tr|intl overrides it for QA. Nothing is hidden: only the order and one note change,
  // so a wrong guess costs nothing.
  var market = (function () {
    var q = (location.search.match(/[?&]market=(tr|intl)\b/) || [])[1];
    if (q) return q;
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return D.market.tr_time_zones.indexOf(tz) !== -1 ? 'tr' : 'intl';
    } catch (err) { return 'intl'; }
  })();
  document.documentElement.setAttribute('data-market', market);
  var list = $('[data-channels]');
  if (list && D.market.order[market]) {
    D.market.order[market].forEach(function (c) {
      var li = $('[data-channel-item="' + c + '"]', list);
      if (li) list.appendChild(li);
    });
    var note = $('[data-tr-note]', list);
    if (note) note.hidden = market !== 'tr';
  }

  // The mobile CTA appears only after the hero (which has its own CTA) has scrolled away,
  // and hides again while the availability section is on screen — never two CTAs at once.
  var bar = $('[data-mobile-cta]');
  var avail = $('#availability');
  var hero = $('.hero');
  if (bar && avail && hero && 'IntersectionObserver' in window) {
    var seen = { hero: true, avail: false };
    var sync = function () { bar.classList.toggle('is-hidden', seen.hero || seen.avail); };
    bar.classList.add('is-hidden');
    new IntersectionObserver(function (en) { seen.hero = en[0].isIntersecting; sync(); }, { threshold: 0.15 }).observe(hero);
    new IntersectionObserver(function (en) { seen.avail = en[0].isIntersecting; sync(); }, { rootMargin: '0px 0px -30% 0px' }).observe(avail);
  }

  // ── Gallery lightbox ───────────────────────────────────
  var dlg = $('#lightbox');
  var idx = 0;
  function showPhoto(i) {
    var g = D.gallery;
    idx = (i + g.length) % g.length;
    var p = g[idx];
    $('[data-lb-avif]', dlg).srcset = p.avif;
    $('[data-lb-webp]', dlg).srcset = p.webp;
    var img = $('[data-lb-img]', dlg);
    img.src = p.src; img.width = p.w; img.height = p.h; img.alt = p.alt;
    img.sizes = '100vw';
    $('[data-lb-caption]', dlg).textContent = p.alt + ' — ' + t('gallery.counter', { n: idx + 1, total: g.length });
  }
  if (dlg && typeof dlg.showModal === 'function') {
    document.addEventListener('click', function (e) {
      var opener = e.target.closest && e.target.closest('[data-lightbox-open]');
      if (!opener) return;
      showPhoto(parseInt(opener.getAttribute('data-lightbox-open'), 10) || 0);
      dlg.showModal();
    });
    $('[data-lb-close]', dlg).addEventListener('click', function () { dlg.close(); });
    $('[data-lb-prev]', dlg).addEventListener('click', function () { showPhoto(idx - 1); });
    $('[data-lb-next]', dlg).addEventListener('click', function () { showPhoto(idx + 1); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') showPhoto(idx - 1);
      if (e.key === 'ArrowRight') showPhoto(idx + 1);
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }

  // ── Map: click-to-load only ────────────────────────────
  $$('[data-map-load]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var box = btn.closest('[data-map]');
      var f = document.createElement('iframe');
      f.src = box.getAttribute('data-map-src');
      f.title = box.getAttribute('data-map-title');
      f.loading = 'lazy';
      f.referrerPolicy = 'no-referrer-when-downgrade';
      box.appendChild(f);
      btn.parentNode.hidden = true;
    });
  });


  // ── Dates ──────────────────────────────────────────────
  var RX = /^\d{4}-\d{2}-\d{2}$/;
  function parse(s) { if (!RX.test(s || '')) return null; var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addDays(d, n) { var r = new Date(d.getTime()); r.setDate(r.getDate() + n); return r; }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  var fmt = new Intl.DateTimeFormat(D.lang, { day: 'numeric', month: 'short', year: 'numeric' });
  var fmtMonth = new Intl.DateTimeFormat(D.lang, { month: 'long', year: 'numeric' });
  function show(s) { return fmt.format(parse(s)); }

  // ── Availability data (server: /api/availability.json) ─────────────────
  // FAIL-SAFE: until valid data arrives, or when the server reports 'unavailable', no date is
  // shown as free. Closed ranges are nights: start inclusive, end exclusive (check-out day).
  var av = { status: 'loading', season: null, closed: [] };
  function isBooked(s) { for (var i = 0; i < av.closed.length; i++) if (s >= av.closed[i].start && s < av.closed[i].end) return true; return false; }
  function trusted() { return av.status === 'fresh' || av.status === 'stale'; }
  function inSeason(s) { return trusted() && !!av.season && s >= av.season.start && s <= av.season.end; }
  function rangeHasBooked(a, b) { for (var d = parse(a); iso(d) < b; d = addDays(d, 1)) if (isBooked(iso(d))) return true; return false; }

  // First bookable window (same rule as the production smart redirect): the first
  // run of min_stay free nights inside the open season, from today on.
  function firstWindow() {
    if (!av.season || !trusted()) return null;
    var start = parse(av.season.start), end = parse(av.season.end), now = today();
    var cand = now > start ? now : start;
    for (var guard = 0; guard < 400 && iso(addDays(cand, L.min_stay - 1)) <= iso(end); guard++) {
      var a = iso(cand), b = iso(addDays(cand, L.min_stay));
      if (!rangeHasBooked(a, b)) return { start: a, end: b };
      cand = addDays(cand, 1);
    }
    return null;
  }

  // ── Reservation links ─────────────────────────────────
  var sel = { start: null, end: null };
  var guestsEl = $('#guests');
  function guests() { return guestsEl ? parseInt(guestsEl.value, 10) || L.default_guests : L.default_guests; }

  function updateLinks() {
    var g = guests();
    var dates = sel.start && sel.end ? sel : firstWindow();
    var wa = $('[data-channel="whatsapp"]'), bk = $('[data-channel="booking"]'), ab = $('[data-channel="airbnb"]');
    var msg = sel.start && sel.end
      ? t('availability.wa_message_dates', { start: show(sel.start), end: show(sel.end), guests: g })
      : t('availability.wa_message');
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (wa) wa.href = (isIOS ? 'https://api.whatsapp.com/send?phone=' + L.whatsapp + '&text=' : 'https://wa.me/' + L.whatsapp + '?text=') + encodeURIComponent(msg);
    var bq = ['group_adults=' + g, 'no_rooms=1', 'label=' + encodeURIComponent(L.booking_label)];
    var aq = ['adults=' + g];
    if (dates) {
      bq.unshift('checkin=' + dates.start, 'checkout=' + dates.end);
      aq.unshift('check_in=' + dates.start, 'check_out=' + dates.end);
    }
    if (bk) bk.href = L.booking + '?' + bq.join('&');
    if (ab) ab.href = L.airbnb + '?' + aq.join('&');
  }
  if (guestsEl) guestsEl.addEventListener('change', updateLinks);

  // ── Calendar ──────────────────────────────────────────
  var cal = $('[data-calendar]');
  if (!cal) { updateLinks(); return; }
  var monthsEl = $('[data-cal-months]', cal);
  var statusEl = $('[data-cal-status]');
  var stateEl = $('[data-cal-state]');
  var clearBtn = $('[data-cal-clear]');
  var first = today(); first.setDate(1);
  var view = new Date(first.getTime());
  var MAX_AHEAD = 18;
  var wide = window.matchMedia('(min-width: 700px)');

  var weekdays = (function () {
    var f = new Intl.DateTimeFormat(D.lang, { weekday: 'short' });
    var out = [];
    for (var i = 0; i < 7; i++) out.push(f.format(new Date(2024, 0, 1 + i))); // 2024-01-01 is a Monday
    return out;
  })();

  function dayState(s, now) {
    if (s < now) return 'past';
    if (isBooked(s)) return 'booked';
    return inSeason(s) ? 'free' : 'unknown';
  }

  function renderMonth(y, m) {
    var now = iso(today());
    var html = '<div class="cal-month"><h3>' + fmtMonth.format(new Date(y, m, 1)) + '</h3><table class="cal-table" role="grid"><thead><tr>';
    weekdays.forEach(function (w) { html += '<th scope="col">' + w + '</th>'; });
    html += '</tr></thead><tbody><tr>';
    var lead = (new Date(y, m, 1).getDay() + 6) % 7;
    for (var i = 0; i < lead; i++) html += '<td></td>';
    var days = new Date(y, m + 1, 0).getDate();
    for (var d = 1; d <= days; d++) {
      var s = iso(new Date(y, m, d));
      var st = dayState(s, now);
      var cls = 'day is-' + st;
      if (sel.start && s === sel.start) cls += ' is-start';
      if (sel.end && s === sel.end) cls += ' is-end';
      if (sel.start && sel.end && s > sel.start && s < sel.end) cls += ' in-range';
      var label = show(s) + ' — ' + (st === 'free' ? t('availability.legend_free') : st === 'booked' ? t('availability.legend_booked') : st === 'unknown' ? t('availability.legend_unknown') : '');
      // A booked or unknown day can still be the check-out day of a free range.
      var asEnd = sel.start && !sel.end && s > sel.start && !rangeHasBooked(sel.start, s) && inSeason(iso(addDays(parse(s), -1)));
      var disabled = st === 'past' || (st !== 'free' && !asEnd);
      html += '<td><button type="button" class="' + cls + '" data-date="' + s + '"' + (disabled ? ' disabled' : '') +
        ' aria-label="' + label + '"' + (cls.indexOf('is-start') !== -1 || cls.indexOf('is-end') !== -1 ? ' aria-pressed="true"' : '') + '>' + d + '</button></td>';
      if ((lead + d) % 7 === 0 && d < days) html += '</tr><tr>';
    }
    return html + '</tr></tbody></table></div>';
  }

  function render() {
    if (av.status === 'loading') return;
    var count = wide.matches ? 2 : 1;
    var html = '';
    for (var i = 0; i < count; i++) {
      var d = new Date(view.getFullYear(), view.getMonth() + i, 1);
      html += renderMonth(d.getFullYear(), d.getMonth());
    }
    monthsEl.innerHTML = html;
    cal.setAttribute('aria-busy', 'false');
    var monthsAhead = (view.getFullYear() - first.getFullYear()) * 12 + view.getMonth() - first.getMonth();
    $('[data-cal-prev]', cal).disabled = monthsAhead <= 0;
    $('[data-cal-next]', cal).disabled = monthsAhead >= MAX_AHEAD;
  }

  function nights(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }

  function updateStatus() {
    if (sel.start && sel.end) statusEl.textContent = t('availability.selected', { start: show(sel.start), end: show(sel.end), nights: nights(sel.start, sel.end) });
    else if (sel.start) statusEl.textContent = t('availability.pick_end', { start: show(sel.start) });
    else statusEl.textContent = t('availability.pick_start');
    clearBtn.hidden = !sel.start;
  }

  function showState() {
    var msg = av.status === 'stale' ? t('availability.state_stale') : av.status === 'unavailable' ? t('availability.state_unavailable') : '';
    stateEl.textContent = msg;
    stateEl.hidden = !msg;
    stateEl.classList.toggle('is-warning', av.status === 'unavailable');
  }

  monthsEl.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-date]');
    if (!b || b.disabled) return;
    var s = b.getAttribute('data-date');
    if (!sel.start || sel.end || s <= sel.start || rangeHasBooked(sel.start, s)) {
      sel = { start: dayState(s, iso(today())) === 'free' ? s : null, end: null };
    } else {
      sel.end = s;
      if (window.PalmiyeTrack) window.PalmiyeTrack.track('availability_check', { method: 'calendar_dates', cta_location: 'availability', nights: nights(sel.start, sel.end) });
    }
    render(); updateStatus(); updateLinks();
    var again = monthsEl.querySelector('button[data-date="' + s + '"]');
    if (again) again.focus();
  });

  clearBtn.addEventListener('click', function () { sel = { start: null, end: null }; render(); updateStatus(); updateLinks(); });
  $('[data-cal-prev]', cal).addEventListener('click', function () { view.setMonth(view.getMonth() - 1); render(); });
  $('[data-cal-next]', cal).addEventListener('click', function () { view.setMonth(view.getMonth() + 1); render(); });
  if (wide.addEventListener) wide.addEventListener('change', render);

  function valid(j) {
    if (!j || ['fresh', 'stale', 'unavailable'].indexOf(j.status) === -1 || !Array.isArray(j.closed)) return false;
    if (j.season && !(RX.test(j.season.start) && RX.test(j.season.end))) return false;
    return j.closed.every(function (r) { return r && RX.test(r.start) && RX.test(r.end) && r.start < r.end; });
  }

  function apply(j) {
    av = valid(j) ? { status: j.status, season: j.season, closed: j.closed } : { status: 'unavailable', season: null, closed: [] };
    if (sel.start && (!inSeason(sel.start) || (sel.end && rangeHasBooked(sel.start, sel.end)))) sel = { start: null, end: null };
    showState(); render(); updateStatus(); updateLinks();
  }

  // Load when the section approaches the viewport (or right away without IntersectionObserver).
  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    fetch(D.availability_endpoint, { credentials: 'omit', headers: { Accept: 'application/json' }, signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(timer); apply(j); })
      .catch(function () { clearTimeout(timer); apply(null); });
  }
  updateStatus(); updateLinks();
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '800px 0px' });
    io.observe(cal);
  } else {
    load();
  }
  // Fallback: the JSON is tiny, so fetch it once the page has loaded and the browser is idle
  // even if the section was never scrolled near (background tabs, observers not firing).
  window.addEventListener('load', function () {
    (window.requestIdleCallback || function (f) { setTimeout(f, 1500); })(load, { timeout: 3000 });
  });
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a[href="#availability"]')) load(); });
})();
