/**
 * Palmiye Home — GA4 Event Tracking
 * ====================================
 * GA4 (G-6NK46VG4DY) <head> içinden yüklenir (gtag.js + gtag('config', 'G-6NK46VG4DY')).
 * Bu dosya SADECE özel event'leri (whatsapp_click, booking_click, vb.) gönderir.
 *
 * CONSENT (Consent Mode v2):
 *   - Bu dosya consent check'i YAPMAZ.
 *   - <head>'deki gtag('consent', 'default', {analytics_storage: 'denied'}) varsayılanı,
 *     kullanıcı banner'da onay verene kadar GA4'ün cookie yazmasını engeller.
 *   - 'denied' iken GA4 yine event topluyor ama anonim/cookieless modda
 *     (Google "consent signals" ile modeled metric üretir). KVKK/GDPR uyumludur.
 *   - 'granted' olunca tam ölçüm aktifleşir.
 *
 * @version 3.0.0
 */
(function () {
  'use strict';

  // gtag yüklü değilse sessizce çık (site bozulmasın)
  if (typeof window.gtag !== 'function') {
    console.warn('[Analytics] gtag global bulunamadı — <head> icindeki tag\'leri kontrol et.');
    return;
  }

  // ── Yardımcı: tek satırda event gönderimi ──
  function track(eventName, params) {
    try {
      window.gtag('event', eventName, params || {});
    } catch (err) {
      console.warn('[Analytics] event hatasi:', eventName, err);
    }
  }

  // ── Public API: dışarıdan custom event göndermek için ──
  window.trackEvent = track;

  // ════════════════════════════════════════════════════════════
  //  EVENT LISTENERS
  // ════════════════════════════════════════════════════════════

  function setupTracking() {
    // ── Outbound link click'leri (WhatsApp / Booking / Airbnb / Tel / Mail) ──
    // Tek delegated handler, tüm linkleri yakalar (sonradan DOM'a eklenenler dahil).
    document.addEventListener('click', function (e) {
      var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!anchor) return;

      var href = (anchor.getAttribute('href') || '').toLowerCase();
      if (!href) return;

      var section = anchor.closest('section');
      var sectionId = section && section.id ? section.id : 'unknown';

      if (href.indexOf('wa.me') !== -1 ||
          href.indexOf('api.whatsapp.com') !== -1 ||
          href.indexOf('whatsapp.com') !== -1) {
        track('whatsapp_click', { event_category: 'engagement', event_label: sectionId });
        return;
      }
      if (href.indexOf('booking.com') !== -1) {
        track('booking_click', { event_category: 'engagement', event_label: 'booking_com' });
        return;
      }
      if (href.indexOf('airbnb.') !== -1) {
        track('airbnb_click', { event_category: 'engagement', event_label: 'airbnb' });
        return;
      }
      if (href.indexOf('tel:') === 0) {
        track('phone_click', { event_category: 'engagement', event_label: sectionId });
        return;
      }
      if (href.indexOf('mailto:') === 0) {
        track('email_click', { event_category: 'engagement', event_label: sectionId });
      }
    }, { passive: true, capture: true });

    // ── Dil değişimi ──
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        track('language_change', {
          event_category: 'navigation',
          event_label: btn.dataset.lang || btn.textContent.trim()
        });
      });
    });

    // ── Galeri lightbox açılışı ──
    document.querySelectorAll('.gallery-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var img = item.querySelector('img');
        track('gallery_view', {
          event_category: 'engagement',
          event_label: img ? img.alt : 'unknown'
        });
      });
    });

    // ── Scroll depth (25 / 50 / 75 / 100) ──
    var scrollMilestones = [25, 50, 75, 100];
    var scrollFired = {};

    window.addEventListener('scroll', function () {
      var max = document.body.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      var scrollPercent = Math.round((window.scrollY / max) * 100);
      scrollMilestones.forEach(function (milestone) {
        if (scrollPercent >= milestone && !scrollFired[milestone]) {
          scrollFired[milestone] = true;
          track('scroll_depth', {
            event_category: 'engagement',
            event_label: milestone + '%'
          });
        }
      });
    }, { passive: true });
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTracking);
  } else {
    setupTracking();
  }
})();
