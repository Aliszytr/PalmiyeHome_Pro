/**
 * Palmiye Home — Google Ads Conversion Tracking
 * ================================================
 * WhatsApp, Booking.com ve Airbnb link tıklamalarını
 * Google Ads'e conversion olarak gönderir.
 *
 * ÖN KOŞUL: Global Google Ads tag <head> içine eklenmiş olmalı:
 *   <script async src="https://www.googletagmanager.com/gtag/js?id=AW-17307806485"></script>
 *   <script>
 *     window.dataLayer = window.dataLayer || [];
 *     function gtag(){dataLayer.push(arguments);}
 *     gtag('js', new Date());
 *     gtag('config', 'AW-17307806485');
 *   </script>
 *
 * CONSENT (Consent Mode v2):
 *   Bu dosya consent check'i YAPMAZ. Bunun nedeni:
 *   - <head> içindeki gtag('consent', 'default', {...denied}) zaten KVKK/GDPR
 *     uyumlu varsayılan davranışı sağlar.
 *   - 'denied' durumunda Google cookie YAZMAZ, kişisel veri toplamaz; sadece
 *     anonim "conversion oldu" pingi toplayıp Modeled Conversion oluşturur.
 *   - Kullanıcı cookie banner'da 'Accept'e basınca consent 'granted'a döner ve
 *     tam attribution (cross-device, audience, remarketing) aktifleşir.
 *   - Burada manuel checkConsent() yapmak modeled conversion'ı KAYBETTİRİR.
 *     (Önceki sürümde 0 dönüşüm görünmesinin asıl sebebi buydu.)
 *
 * YAKALANAN LİNKLER:
 *   - WhatsApp : wa.me, whatsapp.com, api.whatsapp.com
 *   - Booking  : booking.com (herhangi bir alt yol)
 *   - Airbnb   : airbnb.com, airbnb.com.tr (herhangi bir alt yol)
 *
 * ÇAKIŞMA YOK:
 *   - booking-redirect.js: e.preventDefault() + window.open() yapıyor
 *   - analytics.js: GA4 event'i gönderiyor (ayrı destination)
 *   - Bu dosya: sadece Google Ads (AW-) conversion gönderir, üçü paralel çalışır
 *
 * DEBUG:
 *   window.PALMIYE_ADS_CONV.test()     → 3 conversion'ı test amaçlı fire eder
 *   window.PALMIYE_ADS_CONV.config     → aktif label konfigürasyonu
 *
 * @version 2.0.0
 */
(function () {
  'use strict';

  var PREFIX = '[AdsConv]';
  var ADS_ID = 'AW-17307806485';

  // ════════════════════════════════════════════════════════════
  //  CONFIG — Her dönüşüm için Google Ads label'ı
  //  Label'lar Google Ads panelinden alınarak buraya girilecek.
  //  Format: 'AbCdEfGhIjK1LmNoPq'  (sadece label kısmı)
  //  null = henüz yapılandırılmamış → conversion fire edilmez
  // ════════════════════════════════════════════════════════════
var CONVERSIONS = {
    whatsapp: 'vc01CNXHidYcEJXWgL1A',
    booking:  'pkzoCNjHidYcEJXWgL1A',
    airbnb:   'WFLICNvHidYcEJXWgL1A'
}

  // ════════════════════════════════════════════════════════════
  //  CONSENT — Burada manuel kontrol YOK (bilinçli).
  //  Google Consent Mode v2 (head'deki gtag('consent', 'default', {...}))
  //  arka planda yönetir: denied → anonim ping (modeled conversion),
  //  granted → tam ölçüm. Manuel block yapmak modeled conversion'ı kaybeder.
  // ════════════════════════════════════════════════════════════

  // ════════════════════════════════════════════════════════════
  //  CORE — Conversion event fire
  // ════════════════════════════════════════════════════════════
  function fireConversion(key) {
    // gtag yüklendi mi?
    if (typeof window.gtag !== 'function') {
      console.warn(PREFIX, 'gtag global bulunamadı — <head> içindeki Google Ads tag\'i eksik olabilir.');
      return false;
    }

    var label = CONVERSIONS[key];

    // Label null ise fire etme
    if (!label) {
      console.warn(PREFIX, 'Label henüz yapılandırılmamış:', key,
        '\ntracking.js CONVERSIONS objesinde label\'ı güncelle.');
      return false;
    }

    var sendTo = ADS_ID + '/' + label;

    try {
      window.gtag('event', 'conversion', { send_to: sendTo });
      console.log(PREFIX, '✅ Conversion fired →', key, '(' + sendTo + ')');
      return true;
    } catch (err) {
      console.error(PREFIX, 'Conversion fire hatası:', err);
      return false;
    }
  }

  // ════════════════════════════════════════════════════════════
  //  LINK CLASSIFIER — href → conversion key
  // ════════════════════════════════════════════════════════════
  function classifyLink(anchor) {
    if (!anchor || typeof anchor.href !== 'string') return null;
    var href = anchor.href.toLowerCase();

    // WhatsApp — wa.me/..., api.whatsapp.com/send, whatsapp.com
    if (href.indexOf('wa.me') !== -1 ||
        href.indexOf('api.whatsapp.com') !== -1 ||
        href.indexOf('whatsapp.com') !== -1) {
      return 'whatsapp';
    }

    // Booking.com — herhangi bir booking.com alt sayfası
    if (href.indexOf('booking.com') !== -1) {
      return 'booking';
    }

    // Airbnb — airbnb.com, airbnb.com.tr ve diğer TLD'ler
    if (href.indexOf('airbnb.com') !== -1 ||
        href.indexOf('airbnb.') !== -1) {
      return 'airbnb';
    }

    return null;
  }

  // ════════════════════════════════════════════════════════════
  //  CLICK HANDLER — Document-level delegation (capture phase)
  //  Capture phase seçildi ki booking-redirect.js'den önce çalışsın
  //  (window.open yeni sekmede açıldığı için navigation zaten kesmez,
  //  ama güvenli tarafta kalıyoruz)
  // ════════════════════════════════════════════════════════════
  function handleClick(e) {
    var anchor = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!anchor) return;

    var kind = classifyLink(anchor);
    if (!kind) return;

    fireConversion(kind);
    // preventDefault ASLA yapılmaz — link normal davranışını sürdürmeli
  }

  // ════════════════════════════════════════════════════════════
  //  INIT
  // ════════════════════════════════════════════════════════════
  function init() {
    document.addEventListener('click', handleClick, true); // capture phase
    console.log(PREFIX, 'Ready — WhatsApp / Booking / Airbnb Ads conversion tracking active');

    // Yapılandırma sağlık kontrolü
    var configured = 0, pending = 0;
    Object.keys(CONVERSIONS).forEach(function (k) {
      if (CONVERSIONS[k]) configured++; else pending++;
    });
    if (pending > 0) {
      console.warn(PREFIX, 'Yapılandırma: ' + configured + ' hazır, ' + pending + ' label eksik (null).');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ════════════════════════════════════════════════════════════
  //  PUBLIC API — Debug & manuel tetikleme için
  // ════════════════════════════════════════════════════════════
  window.PALMIYE_ADS_CONV = {
    fire: fireConversion,
    config: CONVERSIONS,
    classify: classifyLink,
    // Konsola yazdığında 3 conversion'ı test amaçlı fire eder
    test: function () {
      console.log(PREFIX, '🧪 Test: 3 conversion fire ediliyor...');
      ['whatsapp', 'booking', 'airbnb'].forEach(fireConversion);
    }
  };
})();
