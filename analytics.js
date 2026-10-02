/**
 * Palmiye Home — GA4 / GTM Conversion & Engagement Tracking
 * ===========================================================
 * Merkezi event dispatcher: trackPalmiyeEvent(eventName, params)
 *
 * DESTEKLENEN EVENTLER:
 *   click_booking       → Booking.com link tıklaması
 *   click_airbnb        → Airbnb link tıklaması
 *   click_whatsapp      → WhatsApp link tıklaması (PII gönderilmez)
 *   click_phone         → tel: link tıklaması (PII gönderilmez)
 *   click_email         → mailto: link tıklaması (PII gönderilmez)
 *   view_availability   → Site-içi müsaitlik/takvim/rezervasyon alanına tıklama
 *                         (Dış platform linklerinde tetiklenmez — onlar click_booking/airbnb olur)
 *
 * EK EVENTLER (mevcut):
 *   language_change      → Dil değişimi
 *   gallery_view         → Galeri lightbox açılışı
 *   scroll_depth         → Scroll derinliği (25/50/75/100%)
 *
 * GÜVENLİK:
 *   - Telefon numarası, e-posta adresi, WhatsApp numarası gibi PII verileri
 *     event parametresi olarak GÖNDERİLMEZ.
 *   - Sadece link_type, page_path, page_title, language, outbound, section gibi
 *     güvenli parametreler kullanılır.
 *
 * CONSENT (Consent Mode v2):
 *   - Bu dosya consent check'i YAPMAZ.
 *   - <head>'deki gtag('consent', 'default', {analytics_storage: 'denied'}) varsayılanı,
 *     kullanıcı banner'da onay verene kadar GA4'ün cookie yazmasını engeller.
 *   - 'denied' iken GA4 yine event topluyor ama anonim/cookieless modda
 *     (Google "consent signals" ile modeled metric üretir). KVKK/GDPR uyumludur.
 *   - 'granted' olunca tam ölçüm aktifleşir.
 *
 * ÇAKIŞMA YÖNETİMİ:
 *   - tracking.js: Google Ads (AW-) conversion gönderir → ayrı hedef, paralel çalışır
 *   - booking-redirect.js: URL rewrite yapar → bu dosya sadece event gönderir
 *   - Bu dosya: GA4 event + dataLayer push → çift sayım riski yok
 *
 * @version 4.0.0
 */
(function () {
  'use strict';

  var PREFIX = '[PalmiyeAnalytics]';

  // ════════════════════════════════════════════════════════════
  //  DETECTION — gtag ve dataLayer varlık kontrolü
  // ════════════════════════════════════════════════════════════
  var hasGtag = typeof window.gtag === 'function';
  var hasDataLayer = Array.isArray(window.dataLayer);

  if (!hasGtag && !hasDataLayer) {
    console.warn(PREFIX, 'Ne gtag ne de dataLayer bulundu. Event\'ler console\'a loglanacak ancak hiçbir yere gönderilmeyecek.');
  }

  // ════════════════════════════════════════════════════════════
  //  HELPERS — Sayfa ve dil bilgisi
  // ════════════════════════════════════════════════════════════
  function getPagePath() {
    return window.location.pathname + window.location.search;
  }

  function getPageTitle() {
    return document.title || '';
  }

  function getLanguage() {
    // Palmiye Home dil sistemi: html lang attr veya localStorage
    return document.documentElement.lang ||
           localStorage.getItem('palmiye_lang') ||
           'en';
  }

  function getSectionId(element) {
    if (!element) return 'unknown';
    var section = element.closest ? element.closest('section, [id]') : null;
    return section && section.id ? section.id : 'unknown';
  }

  // ════════════════════════════════════════════════════════════
  //  CORE — Merkezi Event Dispatcher
  //  trackPalmiyeEvent(eventName, params)
  //
  //  Her event'e otomatik olarak şunlar eklenir:
  //    event_category, page_path, page_title, language
  //  Ekstra parametreler params ile geçirilir.
  //
  //  Hem gtag (GA4) hem dataLayer (GTM) desteklenir.
  //  Çift sayım riski yok: gtag GA4'e gider, dataLayer GTM'e.
  //  İkisi farklı pipeline'lardır.
  // ════════════════════════════════════════════════════════════
  function trackPalmiyeEvent(eventName, params) {
    var baseParams = {
      event_category: 'engagement',
      page_path: getPagePath(),
      page_title: getPageTitle(),
      language: getLanguage()
    };

    // Merge: caller params override base
    var mergedParams = {};
    var key;
    for (key in baseParams) {
      if (baseParams.hasOwnProperty(key)) {
        mergedParams[key] = baseParams[key];
      }
    }
    if (params) {
      for (key in params) {
        if (params.hasOwnProperty(key)) {
          mergedParams[key] = params[key];
        }
      }
    }

    // ── GA4 (gtag) ──
    if (hasGtag) {
      try {
        window.gtag('event', eventName, mergedParams);
      } catch (err) {
        console.warn(PREFIX, 'gtag event hatası:', eventName, err);
      }
    }

    // ── GTM (dataLayer) ──
    if (hasDataLayer) {
      try {
        var dlPayload = { event: eventName };
        for (key in mergedParams) {
          if (mergedParams.hasOwnProperty(key)) {
            dlPayload[key] = mergedParams[key];
          }
        }
        window.dataLayer.push(dlPayload);
      } catch (err) {
        console.warn(PREFIX, 'dataLayer push hatası:', eventName, err);
      }
    }

    // ── Fallback: Hiçbiri yoksa console log ──
    if (!hasGtag && !hasDataLayer) {
      console.log(PREFIX, '[DRY-RUN]', eventName, mergedParams);
    }
  }

  // Public API — dışarıdan custom event göndermek için
  window.trackPalmiyeEvent = trackPalmiyeEvent;
  // Geriye uyumluluk: eski window.trackEvent'i de koru
  window.trackEvent = function (eventName, params) {
    trackPalmiyeEvent(eventName, params);
  };

  // ════════════════════════════════════════════════════════════
  //  LINK CLASSIFIER — href → event tipi belirleme
  //  PII gönderilmez: telefon, e-posta, WhatsApp numarası parametre olmaz
  // ════════════════════════════════════════════════════════════
  function classifyLink(href) {
    if (!href) return null;
    var h = href.toLowerCase();

    // WhatsApp
    if (h.indexOf('wa.me') !== -1 ||
        h.indexOf('api.whatsapp.com') !== -1 ||
        h.indexOf('whatsapp.com') !== -1) {
      return { event: 'click_whatsapp', link_type: 'whatsapp', outbound: true };
    }

    // Booking.com
    if (h.indexOf('booking.com') !== -1) {
      return { event: 'click_booking', link_type: 'booking', outbound: true };
    }

    // Airbnb
    if (h.indexOf('airbnb.com') !== -1 || h.indexOf('airbnb.') !== -1) {
      return { event: 'click_airbnb', link_type: 'airbnb', outbound: true };
    }

    // Telefon (PII gönderilmez)
    if (h.indexOf('tel:') === 0) {
      return { event: 'click_phone', link_type: 'phone', outbound: false };
    }

    // E-posta (PII gönderilmez)
    if (h.indexOf('mailto:') === 0) {
      return { event: 'click_email', link_type: 'email', outbound: false };
    }

    return null;
  }

  // ════════════════════════════════════════════════════════════
  //  VIEW_AVAILABILITY — Site-içi müsaitlik/takvim butonları
  //  Dış platforma giden linkler (Booking, Airbnb) BURAYI TETİKLEMEZ;
  //  onlar click_booking / click_airbnb eventini alır.
  // ════════════════════════════════════════════════════════════

  /**
   * Bir butonun / linkin "availability" niteliğinde olup olmadığını belirler.
   * Mantık:
   *  - href dış platform ise (booking.com, airbnb) → false (onlar kendi eventini alır)
   *  - data-i18n anahtarı veya metin içeriği availability/rezervasyon/müsaitlik
   *    gibi bir pattern'e uyuyorsa → true
   *  - Element #calendar section'ı içinde ise → true
   *  - Section id'si "reservation" veya "booking" ise → true (ama dış link ise hariç)
   */
  var AVAILABILITY_PATTERNS = /check.?availab|müsaitli|müsaitlik|rezervasyon|reservation|book.?now|hemen.?rezerv|verfügbarkeit|наличие|забронировать|buchen|book.?via|book.?your|book.?direct/i;
  var AVAILABILITY_I18N_KEYS = /cta_wa|cta_btn|cta_booking|cta_airbnb|reservation\.cta|pricing\.cta|cp1\.cta|cp2\.cta|cp3\.cta|hero\.cta/;

  function isAvailabilityElement(element, href) {
    // Dış platform linki ise availability DEĞİL — kendi event'ini alacak
    if (href) {
      var h = href.toLowerCase();
      if (h.indexOf('booking.com') !== -1 ||
          h.indexOf('airbnb.com') !== -1 ||
          h.indexOf('airbnb.') !== -1) {
        return false;
      }
    }

    // data-i18n anahtarı kontrolü
    var i18nKey = element.getAttribute('data-i18n') ||
                  (element.querySelector('[data-i18n]') || {}).getAttribute &&
                  (element.querySelector('[data-i18n]') || { getAttribute: function() { return ''; } }).getAttribute('data-i18n') || '';

    if (i18nKey && AVAILABILITY_I18N_KEYS.test(i18nKey)) {
      return true;
    }

    // Metin içeriği kontrolü
    var text = (element.textContent || element.innerText || '').trim();
    if (text && AVAILABILITY_PATTERNS.test(text)) {
      return true;
    }

    // Calendar section içinde mi?
    var closestSection = element.closest ? element.closest('#calendar, #reservation, #availability') : null;
    if (closestSection) {
      return true;
    }

    return false;
  }

  // ════════════════════════════════════════════════════════════
  //  EVENT LISTENERS
  // ════════════════════════════════════════════════════════════

  function setupTracking() {

    // ── 1. Link tıklama: click_booking, click_airbnb, click_whatsapp,
    //       click_phone, click_email, view_availability ──
    document.addEventListener('click', function (e) {
      var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!anchor) {
        // Anchor değil ama buton olabilir — view_availability için kontrol
        var btn = e.target && e.target.closest ? e.target.closest('button, [role="button"]') : null;
        if (btn && isAvailabilityElement(btn, null)) {
          trackPalmiyeEvent('view_availability', {
            link_type: 'availability',
            outbound: false,
            section: getSectionId(btn)
          });
        }
        return;
      }

      var href = anchor.getAttribute('href') || '';
      var section = getSectionId(anchor);

      // Outbound link sınıflandırması
      var classification = classifyLink(href);

      if (classification) {
        // Dış platform veya iletişim linki
        trackPalmiyeEvent(classification.event, {
          link_type: classification.link_type,
          outbound: classification.outbound,
          section: section
        });
        return; // Tek event — çift sayım yok
      }

      // Outbound değilse: site-içi availability/booking butonu mu?
      if (isAvailabilityElement(anchor, href)) {
        trackPalmiyeEvent('view_availability', {
          link_type: 'availability',
          outbound: false,
          section: section
        });
      }

    }, { passive: true, capture: true });

    // ── 2. Dil değişimi ──
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        trackPalmiyeEvent('language_change', {
          event_category: 'navigation',
          link_type: 'language',
          outbound: false,
          selected_language: btn.dataset.lang || btn.textContent.trim()
        });
      });
    });

    // ── 3. Galeri lightbox açılışı ──
    document.querySelectorAll('.gallery-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var img = item.querySelector('img');
        trackPalmiyeEvent('gallery_view', {
          event_category: 'engagement',
          link_type: 'gallery',
          outbound: false,
          image_alt: img ? img.alt : 'unknown'
        });
      });
    });

    // ── 4. Scroll depth (25 / 50 / 75 / 100%) ──
    var scrollMilestones = [25, 50, 75, 100];
    var scrollFired = {};

    window.addEventListener('scroll', function () {
      var max = document.body.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      var scrollPercent = Math.round((window.scrollY / max) * 100);
      scrollMilestones.forEach(function (milestone) {
        if (scrollPercent >= milestone && !scrollFired[milestone]) {
          scrollFired[milestone] = true;
          trackPalmiyeEvent('scroll_depth', {
            event_category: 'engagement',
            link_type: 'scroll',
            outbound: false,
            depth: milestone + '%'
          });
        }
      });
    }, { passive: true });

    // ── Hazır logu ──
    console.log(PREFIX, '✅ Ready — 6 conversion event + engagement tracking active');
    console.log(PREFIX, 'Events: click_booking, click_airbnb, click_whatsapp, click_phone, click_email, view_availability');
    console.log(PREFIX, 'gtag:', hasGtag ? '✅' : '❌', '| dataLayer:', hasDataLayer ? '✅' : '❌');
  }

  // ── Init ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupTracking);
  } else {
    setupTracking();
  }

  // ════════════════════════════════════════════════════════════
  //  DEBUG API
  //  Konsoldan test etmek için:
  //    PALMIYE_ANALYTICS.test()          → tüm eventleri test fire eder
  //    PALMIYE_ANALYTICS.events          → desteklenen event listesi
  //    trackPalmiyeEvent('custom', {})   → custom event gönder
  // ════════════════════════════════════════════════════════════
  window.PALMIYE_ANALYTICS = {
    track: trackPalmiyeEvent,
    events: ['click_booking', 'click_airbnb', 'click_whatsapp', 'click_phone', 'click_email', 'view_availability', 'language_change', 'gallery_view', 'scroll_depth'],
    test: function () {
      console.log(PREFIX, '🧪 Test: tüm conversion eventleri fire ediliyor...');
      trackPalmiyeEvent('click_booking', { link_type: 'booking', outbound: true, section: 'test' });
      trackPalmiyeEvent('click_airbnb', { link_type: 'airbnb', outbound: true, section: 'test' });
      trackPalmiyeEvent('click_whatsapp', { link_type: 'whatsapp', outbound: true, section: 'test' });
      trackPalmiyeEvent('click_phone', { link_type: 'phone', outbound: false, section: 'test' });
      trackPalmiyeEvent('click_email', { link_type: 'email', outbound: false, section: 'test' });
      trackPalmiyeEvent('view_availability', { link_type: 'availability', outbound: false, section: 'test' });
      console.log(PREFIX, '🧪 Test tamamlandı — GA4 Realtime raporunu kontrol edin.');
    }
  };
})();
