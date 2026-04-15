/**
 * Palmiye Home — Smart Booking & Airbnb Redirect
 * ================================================
 * Problem: Booking.com ve Airbnb, tarih parametresi olmadan açıldığında
 * bugünün tarihini default alır → sezon dışında "Tükendi" görünür.
 *
 * Çözüm: Tıklamayı yakalar, ilk müsait tarih aralığını (first bookable
 * window) hesaplar, doğru check-in/check-out ile platforma yönlendirir.
 *
 * Veri kaynağı: window.PALMIYE_BOOKINGS (data/bookings.js + API)
 * Graceful degradation: JS kapalıysa orijinal href çalışır.
 *
 * Test: Console'da  PALMIYE_SMART_REDIRECT.runTests()
 *
 * @version 1.0.0
 */
(function () {
  'use strict';

  var PREFIX = '[SmartRedirect]';

  // ══════════════════════════════════════════════════════════
  //  CONFIGURATION — Tek merkezi yapılandırma noktası
  // ══════════════════════════════════════════════════════════

  var CONFIG = {
    booking: {
      baseUrl: 'https://www.booking.com/hotel/tr/sakinlik-ve-huzur-palmiye-home.html',
      defaultAdults: 2,
      defaultRooms: 1,
      label: 'palmiye_direct'
    },
    airbnb: {
      baseUrl: 'https://www.airbnb.com.tr/rooms/979475001547790592',
      defaultGuests: 2
    },
    minStay: 3,            // Minimum konaklama gecesi
    maxSearchDays: 400,    // İleri arama limiti (sonsuz döngü koruma)
    defaultSeason: {       // PALMIYE_BOOKINGS.season yoksa kullanılır
      start: '2026-06-01',
      end: '2026-11-30'
    }
  };

  // ══════════════════════════════════════════════════════════
  //  DATE UTILITIES — Timezone-safe tarih operasyonları
  // ══════════════════════════════════════════════════════════

  var DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * YYYY-MM-DD string → local Date (midnight).
   * new Date('2026-06-01') UTC'de parse edilebilir → timezone hatası.
   * Bu fonksiyon local midnight garantili Date üretir.
   */
  function parseDate(str) {
    if (!str || typeof str !== 'string' || !DATE_REGEX.test(str)) return null;
    var p = str.split('-');
    return new Date(
      parseInt(p[0], 10),
      parseInt(p[1], 10) - 1,
      parseInt(p[2], 10)
    );
  }

  /** Date → YYYY-MM-DD string */
  function formatDate(d) {
    if (!d || isNaN(d.getTime())) return null;
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  /** date + n gün → yeni Date (orijinali mutate etmez) */
  function addDays(d, n) {
    var r = new Date(d.getTime());
    r.setDate(r.getDate() + n);
    return r;
  }

  /** Bugünün tarihi (local midnight) */
  function getToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ══════════════════════════════════════════════════════════
  //  DATA ACCESS — PALMIYE_BOOKINGS veri okuma + validasyon
  // ══════════════════════════════════════════════════════════

  /** Season objesi oku ve validate et */
  function getSeason(data) {
    if (
      data && data.season &&
      typeof data.season === 'object' &&
      typeof data.season.start === 'string' &&
      typeof data.season.end === 'string' &&
      DATE_REGEX.test(data.season.start) &&
      DATE_REGEX.test(data.season.end) &&
      data.season.start <= data.season.end
    ) {
      return { start: data.season.start, end: data.season.end };
    }
    return { start: CONFIG.defaultSeason.start, end: CONFIG.defaultSeason.end };
  }

  /** Dolu tarih aralıklarını oku, validate et, sıralı döndür */
  function getBookedRanges(data) {
    if (!data || !Array.isArray(data.bookings)) return [];
    return data.bookings
      .filter(function (b) {
        return b &&
          typeof b.from === 'string' && typeof b.to === 'string' &&
          DATE_REGEX.test(b.from) && DATE_REGEX.test(b.to) &&
          b.from <= b.to;
      })
      .slice()
      .sort(function (a, b) { return a.from.localeCompare(b.from); });
  }

  // ══════════════════════════════════════════════════════════
  //  CORE ENGINE — First Bookable Window Resolver
  //
  //  "İlk boş gün" değil, "ilk [minStay] gecelik müsait
  //  pencere" arar. Dolu range'lerin arasındaki küçük
  //  boşlukları (< minStay) otomatik atlar.
  // ══════════════════════════════════════════════════════════

  /**
   * İlk müsait konaklama penceresini bulur.
   *
   * @param {string} [overrideToday] – Test için bugün tarihi (YYYY-MM-DD)
   * @param {object} [overrideData]  – Test için booking verisi
   * @returns {{checkin: string, checkout: string, source: string}|null}
   */
  function findFirstBookableWindow(overrideToday, overrideData) {
    var data = overrideData !== undefined
      ? overrideData
      : (window.PALMIYE_BOOKINGS || null);

    var season = getSeason(data);
    var bookedRanges = getBookedRanges(data);
    var minStay = CONFIG.minStay;

    var seasonStartDate = parseDate(season.start);
    var seasonEndDate = parseDate(season.end);
    if (!seasonStartDate || !seasonEndDate) {
      console.warn(PREFIX, 'Invalid season dates');
      return null;
    }

    var todayDate = overrideToday ? parseDate(overrideToday) : getToday();
    if (!todayDate) return null;

    // ── Off-season kontrolü ──
    // Sezon sonrası → gelecek yılın sezonuna atla
    if (todayDate > seasonEndDate) {
      seasonStartDate = new Date(seasonStartDate.getTime());
      seasonStartDate.setFullYear(seasonStartDate.getFullYear() + 1);
      seasonEndDate = new Date(seasonEndDate.getTime());
      seasonEndDate.setFullYear(seasonEndDate.getFullYear() + 1);
      // Gelecek yıl için henüz dolu tarih yok
      bookedRanges = [];
    }

    // ── Başlangıç noktası ──
    // Sezon öncesiyse sezon başlangıcına atla
    var startDate = todayDate < seasonStartDate ? seasonStartDate : todayDate;
    var seasonEndStr = formatDate(seasonEndDate);

    var candidate = new Date(startDate.getTime());
    var safetyCounter = 0;

    while (safetyCounter < CONFIG.maxSearchDays) {
      safetyCounter++;

      var checkinStr = formatDate(candidate);
      // Son konaklama gecesi: checkin + (minStay - 1)
      var lastNight = addDays(candidate, minStay - 1);
      var lastNightStr = formatDate(lastNight);

      // ── Season sınırı ──
      // Son gece sezon sonundan sonraysa → pencere sığmıyor
      if (lastNightStr > seasonEndStr) {
        break;
      }

      // ── Dolu tarih çakışma kontrolü ──
      // İki interval overlap eder ⟺ A.start ≤ B.end AND A.end ≥ B.start
      // Pencere: [checkinStr .. lastNightStr]
      // Range:   [from .. to]
      var conflict = null;
      for (var i = 0; i < bookedRanges.length; i++) {
        if (checkinStr <= bookedRanges[i].to && lastNightStr >= bookedRanges[i].from) {
          conflict = bookedRanges[i];
          break;
        }
      }

      if (!conflict) {
        // ✅ İlk müsait pencere bulundu!
        var checkoutDate = addDays(candidate, minStay);
        return {
          checkin: checkinStr,
          checkout: formatDate(checkoutDate),
          source: 'smart'
        };
      }

      // ── Range-skip optimizasyonu ──
      // Çakışan range'in bitişinden sonraki güne atla
      // Gün gün ilerlemek yerine O(bookedRanges) ile çözüm
      var jumpTo = addDays(parseDate(conflict.to), 1);
      candidate = jumpTo > candidate ? jumpTo : addDays(candidate, 1);
    }

    // Hiçbir pencere bulunamadı
    return null;
  }

  // ══════════════════════════════════════════════════════════
  //  URL BUILDERS — Platform-specific URL oluşturma
  // ══════════════════════════════════════════════════════════

  /**
   * Booking.com URL oluştur.
   * Parametreler: checkin, checkout, group_adults, no_rooms, label
   */
  function buildBookingUrl(checkin, checkout) {
    var params = [
      'checkin=' + encodeURIComponent(checkin),
      'checkout=' + encodeURIComponent(checkout),
      'group_adults=' + CONFIG.booking.defaultAdults,
      'no_rooms=' + CONFIG.booking.defaultRooms,
      'label=' + encodeURIComponent(CONFIG.booking.label)
    ];
    return CONFIG.booking.baseUrl + '?' + params.join('&');
  }

  /**
   * Airbnb URL oluştur.
   * Parametreler: check_in, check_out, adults
   */
  function buildAirbnbUrl(checkin, checkout) {
    var params = [
      'check_in=' + encodeURIComponent(checkin),
      'check_out=' + encodeURIComponent(checkout),
      'adults=' + CONFIG.airbnb.defaultGuests
    ];
    return CONFIG.airbnb.baseUrl + '?' + params.join('&');
  }

  // ══════════════════════════════════════════════════════════
  //  CLICK HANDLER — Event delegation ile link yakalama
  //
  //  Akış:
  //  1. analytics.js'nin element-level handler'ı önce çalışır (tracking)
  //  2. Bu document-level handler çalışır (redirect)
  //  3. Smart window bulunursa → preventDefault + window.open
  //  4. Bulunamazsa → hiçbir şey yapma, orijinal href açılsın
  // ══════════════════════════════════════════════════════════

  function handleClick(e) {
    // Guard: closest() desteği kontrolü (çok eski tarayıcılar)
    if (!e.target || typeof e.target.closest !== 'function') return;

    // Tıklanan öğenin en yakın <a> atasını bul
    var link = e.target.closest('a');
    if (!link || !link.href) return;

    // Sadece Booking.com ve Airbnb property linklerini yakala
    var href = link.href;
    var isBooking = href.indexOf('booking.com/hotel') !== -1;
    var isAirbnb = href.indexOf('airbnb.com') !== -1 && href.indexOf('/rooms/') !== -1;
    if (!isBooking && !isAirbnb) return;

    // ── İlk müsait pencereyi hesapla ──
    var bookableWindow = findFirstBookableWindow();

    if (!bookableWindow) {
      // FALLBACK: Uygun tarih bulunamadı → orijinal link açılsın
      // preventDefault YAPILMAZ — kullanıcı orijinal href ile platforma gider
      console.warn(PREFIX, 'No available dates found. Using original link as fallback.');
      return;
    }

    // ── Akıllı yönlendirme ──
    e.preventDefault();

    var platform = isBooking ? 'Booking.com' : 'Airbnb';
    var url;

    if (isBooking) {
      url = buildBookingUrl(bookableWindow.checkin, bookableWindow.checkout);
    } else {
      url = buildAirbnbUrl(bookableWindow.checkin, bookableWindow.checkout);
    }

    console.log(
      PREFIX, '✅', platform, '→',
      'check-in:', bookableWindow.checkin,
      'check-out:', bookableWindow.checkout
    );
    console.log(PREFIX, 'URL:', url);

    // ── GA4 Analytics tracking ──
    // analytics.js'nin booking_click/airbnb_click event'i zaten element-level'da tetiklendi
    // Biz ek olarak smart_redirect event'i gönderiyoruz (dönüşüm ölçümü için)
    if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', 'smart_redirect', {
          event_category: 'conversion',
          event_label: isBooking ? 'booking_com' : 'airbnb',
          checkin: bookableWindow.checkin,
          checkout: bookableWindow.checkout
        });
      } catch (_) {
        // Analytics hatası redirect'i bozmamalı
      }
    }

    // ── Yeni sekmede aç ──
    // Mevcut UX davranışını korumak için (tüm linkler target="_blank")
    window.open(url, '_blank', 'noopener');
  }

  // ══════════════════════════════════════════════════════════
  //  INITIALIZATION
  // ══════════════════════════════════════════════════════════

  function init() {
    // Document-level delegation: her tıklamayı dinle, sadece uygun linklerde işlem yap
    document.addEventListener('click', handleClick, false);
    console.log(PREFIX, 'Initialized — Booking & Airbnb smart redirect active');
  }

  // DOM hazır olduğunda başlat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ══════════════════════════════════════════════════════════
  //  TEST RUNNER — Console'dan çalıştır:
  //
  //      PALMIYE_SMART_REDIRECT.runTests()
  //
  //  Tüm test senaryolarını çalıştırır, sonuçları loglar.
  //  Deterministik: her test kendi verisini ve tarihini kullanır.
  // ══════════════════════════════════════════════════════════

  function runTests() {
    // Standart test verisi (mevcut data/bookings.js ile aynı)
    var testData = {
      bookings: [
        { from: '2026-06-01', to: '2026-06-06' },
        { from: '2026-06-09', to: '2026-06-16' },
        { from: '2026-07-24', to: '2026-07-30' },
        { from: '2026-09-04', to: '2026-09-13' }
      ],
      season: { start: '2026-06-01', end: '2026-10-16' }
    };

    var tests = [
      {
        name: '1. Sezon öncesi (Nisan) → sezon başlangıcındaki ilk müsait pencereye atla',
        today: '2026-04-13',
        data: testData,
        expect: { checkin: '2026-06-17', checkout: '2026-06-20' }
      },
      {
        name: '2. Sezon içi — ilk günler dolu → ilk uygun pencereye atla',
        today: '2026-06-03',
        data: testData,
        expect: { checkin: '2026-06-17', checkout: '2026-06-20' }
      },
      {
        name: '3. Sezon içi — bugün müsait → hemen bugünden başla',
        today: '2026-06-20',
        data: testData,
        expect: { checkin: '2026-06-20', checkout: '2026-06-23' }
      },
      {
        name: '4. Dolu aralık arası — boşluk < minStay → sonraki pencereye atla',
        today: '2026-06-07',
        data: testData,
        expect: { checkin: '2026-06-17', checkout: '2026-06-20' }
      },
      {
        name: '5. Sezon sonuna yakın — pencere sığıyor',
        today: '2026-10-12',
        data: testData,
        expect: { checkin: '2026-10-12', checkout: '2026-10-15' }
      },
      {
        name: '6. minStay sezon dışına taşıyor → fallback (null)',
        today: '2026-10-15',
        data: testData,
        expect: null
      },
      {
        name: '7. Sezon bitti → gelecek yıl sezon başlangıcına atla',
        today: '2026-10-17',
        data: testData,
        expect: { checkin: '2027-06-01', checkout: '2027-06-04' }
      },
      {
        name: '8. Tüm sezon tamamen dolu → fallback (null)',
        today: '2026-06-01',
        data: {
          bookings: [{ from: '2026-06-01', to: '2026-10-16' }],
          season: { start: '2026-06-01', end: '2026-10-16' }
        },
        expect: null
      },
      {
        name: '9. Season bilgisi yok → default season kullan',
        today: '2026-04-01',
        data: { bookings: [] },
        expect: { checkin: '2026-06-01', checkout: '2026-06-04' }
      },
      {
        name: '10. Veri tamamen yok (null) → default season, boş takvim',
        today: '2026-05-01',
        data: null,
        expect: { checkin: '2026-06-01', checkout: '2026-06-04' }
      },
      {
        name: '11. today === seasonEnd → minStay taşar → fallback',
        today: '2026-10-16',
        data: testData,
        expect: null
      },
      {
        name: '12. Overlapping booked ranges → doğru atlama',
        today: '2026-06-01',
        data: {
          bookings: [
            { from: '2026-06-01', to: '2026-06-10' },
            { from: '2026-06-08', to: '2026-06-15' }
          ],
          season: { start: '2026-06-01', end: '2026-10-16' }
        },
        expect: { checkin: '2026-06-16', checkout: '2026-06-19' }
      }
    ];

    console.log('\n' + PREFIX + ' ════════════════════════════════════════════');
    console.log(PREFIX + '  TEST SUITE — ' + tests.length + ' senaryo');
    console.log(PREFIX + '  minStay: ' + CONFIG.minStay + ' gece');
    console.log(PREFIX + ' ════════════════════════════════════════════\n');

    var passed = 0;
    var failed = 0;

    tests.forEach(function (test) {
      var result = findFirstBookableWindow(test.today, test.data);
      var ok;

      if (test.expect === null) {
        ok = result === null;
      } else {
        ok = result !== null &&
             result.checkin === test.expect.checkin &&
             result.checkout === test.expect.checkout;
      }

      if (ok) {
        passed++;
        console.log('  ✅ ' + test.name);
        if (result) {
          console.log('     → checkin: ' + result.checkin + ', checkout: ' + result.checkout);
        } else {
          console.log('     → null (fallback — doğru davranış)');
        }
      } else {
        failed++;
        console.log('  ❌ ' + test.name);
        console.log('     Beklenen:', JSON.stringify(test.expect));
        console.log('     Alınan:  ', JSON.stringify(result));
      }
    });

    // ── URL Builder testleri ──
    console.log('\n  🔗 URL Builder Testleri:');

    var bUrl = buildBookingUrl('2026-06-17', '2026-06-20');
    var bOk = bUrl.indexOf('checkin=2026-06-17') !== -1 &&
              bUrl.indexOf('checkout=2026-06-20') !== -1 &&
              bUrl.indexOf('group_adults=2') !== -1 &&
              bUrl.indexOf('no_rooms=1') !== -1 &&
              bUrl.indexOf('label=palmiye_direct') !== -1;
    console.log('  ' + (bOk ? '✅' : '❌') + ' Booking URL format');
    console.log('     → ' + bUrl);
    if (bOk) passed++; else failed++;

    var aUrl = buildAirbnbUrl('2026-06-17', '2026-06-20');
    var aOk = aUrl.indexOf('check_in=2026-06-17') !== -1 &&
              aUrl.indexOf('check_out=2026-06-20') !== -1 &&
              aUrl.indexOf('adults=2') !== -1;
    console.log('  ' + (aOk ? '✅' : '❌') + ' Airbnb URL format');
    console.log('     → ' + aUrl);
    if (aOk) passed++; else failed++;

    // ── Summary ──
    console.log('\n' + PREFIX + ' ════════════════════════════════════════════');
    console.log(PREFIX + '  Sonuç: ' + passed + '/' + (passed + failed) + ' geçti');
    if (failed > 0) {
      console.log(PREFIX + '  ⚠️  ' + failed + ' test BAŞARISIZ!');
    } else {
      console.log(PREFIX + '  🎉 Tüm testler başarılı!');
    }
    console.log(PREFIX + ' ════════════════════════════════════════════\n');

    return { passed: passed, failed: failed, total: passed + failed };
  }

  // ══════════════════════════════════════════════════════════
  //  PUBLIC API — Debug, test ve konfigürasyon arayüzü
  //
  //  Console'dan erişim:
  //    PALMIYE_SMART_REDIRECT.runTests()
  //    PALMIYE_SMART_REDIRECT.findFirstBookableWindow()
  //    PALMIYE_SMART_REDIRECT.buildBookingUrl('2026-06-17', '2026-06-20')
  //    PALMIYE_SMART_REDIRECT.config
  // ══════════════════════════════════════════════════════════

  window.PALMIYE_SMART_REDIRECT = {
    version: '1.0.0',
    config: CONFIG,
    findFirstBookableWindow: findFirstBookableWindow,
    buildBookingUrl: buildBookingUrl,
    buildAirbnbUrl: buildAirbnbUrl,
    runTests: runTests
  };

})();
