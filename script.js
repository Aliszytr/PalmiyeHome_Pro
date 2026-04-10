/* ================================================
   PALMIYE HOME — Conversion Landing System
   JavaScript — English-First, WhatsApp-Primary
   ================================================ */

document.addEventListener('DOMContentLoaded', () => {
  if (typeof lucide !== 'undefined') lucide.createIcons();

  initNavbar();
  initHeroSlider();
  initSlider();
  initGallery();
  initLightbox();
  initAccordion();
  initScrollAnimations();
  initMobileCTA();
  initSmoothScroll();
  initI18n();
  initFloatingWhatsApp();
  initAttractionToggle();
  initCalendar();

  // New professional features (each in try-catch for safety)
  try { initReviewsCarousel(); } catch(e) { console.warn('[Palmiye] Reviews carousel error:', e); }
  try { initBackToTop(); } catch(e) { console.warn('[Palmiye] Back-to-top error:', e); }
  try { initCookieNotice(); } catch(e) { console.warn('[Palmiye] Cookie notice error:', e); }
  try { initLazyImages(); } catch(e) { console.warn('[Palmiye] Lazy images error:', e); }
  try { initCalendarDateSelection(); } catch(e) { console.warn('[Palmiye] Calendar date selection error:', e); }
  try { initUrgencyBadge(); } catch(e) { console.warn('[Palmiye] Urgency badge error:', e); }
});

/* ---- NAVBAR ---- */
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('mobile-overlay');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });

  function toggleMenu() {
    const isOpen = mobileMenu.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
    hamburger.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  hamburger.addEventListener('click', toggleMenu);
  overlay.addEventListener('click', toggleMenu);

  mobileMenu.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu.classList.contains('open')) toggleMenu();
    });
  });
}


/* ---- HERO SLIDER ---- */
function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  const dots = document.querySelectorAll('.hero-dot');
  if (!slides.length) return;

  let current = 0;
  let interval;

  function goTo(index) {
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
  }

  // Click on dots
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      goTo(i);
      resetInterval();
    });
  });

  function resetInterval() {
    clearInterval(interval);
    interval = setInterval(() => goTo(current + 1), 6000);
  }

  interval = setInterval(() => goTo(current + 1), 6000);
}

/* ---- IMAGE SLIDER ---- */
function initSlider() {
  const track = document.getElementById('apartment-slider');
  if (!track) return;

  const slides = track.querySelectorAll('.slider-slide');
  const dotsContainer = document.getElementById('slider-dots');
  const prevBtn = document.getElementById('slider-prev');
  const nextBtn = document.getElementById('slider-next');
  let current = 0;
  let interval;

  slides.forEach((_, i) => {
    const dot = document.createElement('span');
    dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  function goTo(index) {
    slides[current].classList.remove('active');
    dotsContainer.children[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    dotsContainer.children[current].classList.add('active');
  }

  prevBtn.addEventListener('click', () => { goTo(current - 1); resetAuto(); });
  nextBtn.addEventListener('click', () => { goTo(current + 1); resetAuto(); });

  function resetAuto() {
    clearInterval(interval);
    interval = setInterval(() => goTo(current + 1), 5000);
  }

  interval = setInterval(() => goTo(current + 1), 5000);
}

/* ---- GALLERY FILTER ---- */
function initGallery() {
  const tabs = document.querySelectorAll('.gallery-tab');
  const items = document.querySelectorAll('.gallery-item');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const filter = tab.dataset.filter;
      items.forEach(item => {
        const show = filter === 'all' || item.dataset.category === filter;
        item.classList.toggle('hidden', !show);
      });
    });
  });
}

/* ---- LIGHTBOX ---- */
function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');
  if (!lightbox || !lightboxImg) return;

  let images = [];
  let currentIndex = 0;
  let lastFocused = null;

  function getVisibleImages() {
    return Array.from(document.querySelectorAll('.gallery-item:not(.hidden) img'));
  }

  const galleryGrid = document.getElementById('gallery-grid');
  if (galleryGrid) {
    galleryGrid.addEventListener('click', (e) => {
      const item = e.target.closest('.gallery-item');
      if (!item) return;

      images = getVisibleImages();
      const img = item.querySelector('img');
      currentIndex = images.indexOf(img);

      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt || '';
      lightbox.classList.add('open');
      lightbox.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Focus trap
      lastFocused = document.activeElement;
      if (closeBtn) closeBtn.focus();

      updateCounter();
    });
  }

  function navigate(dir) {
    currentIndex = (currentIndex + dir + images.length) % images.length;
    lightboxImg.src = images[currentIndex].src;
    lightboxImg.alt = images[currentIndex].alt || '';
    updateCounter();
  }

  function updateCounter() {
    let counter = lightbox.querySelector('.lightbox-counter');
    if (!counter) {
      counter = document.createElement('div');
      counter.className = 'lightbox-counter';
      counter.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.6);font-size:0.85rem;font-weight:500;';
      lightbox.appendChild(counter);
    }
    counter.textContent = `${currentIndex + 1} / ${images.length}`;
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused) lastFocused.focus();
  }

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', () => navigate(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigate(1));

  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // Focus trap inside lightbox
  const focusableEls = [closeBtn, prevBtn, nextBtn].filter(Boolean);
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);

    // Tab trap
    if (e.key === 'Tab' && focusableEls.length) {
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
}

/* ---- FAQ ACCORDION ---- */
function initAccordion() {
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
}

/* ---- SCROLL ANIMATIONS ---- */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

/* ---- STICKY MOBILE CTA ---- */
function initMobileCTA() {
  const mobileCta = document.getElementById('mobile-cta');
  const hero = document.getElementById('hero');
  if (!mobileCta || !hero) return;

  const observer = new IntersectionObserver(([entry]) => {
    mobileCta.classList.toggle('visible', !entry.isIntersecting);
  }, { threshold: 0 });

  observer.observe(hero);
}

/* ---- FLOATING WHATSAPP (desktop) ---- */
function initFloatingWhatsApp() {
  const btn = document.getElementById('floating-whatsapp');
  const hero = document.getElementById('hero');
  if (!btn || !hero) return;

  const observer = new IntersectionObserver(([entry]) => {
    btn.style.opacity = entry.isIntersecting ? '0' : '1';
    btn.style.pointerEvents = entry.isIntersecting ? 'none' : 'auto';
  }, { threshold: 0.3 });

  observer.observe(hero);
}

/* ---- SMOOTH SCROLL ---- */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const offset = 70;
      const y = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    });
  });
}

/* ---- ATTRACTIONS SHOW MORE / LESS ---- */
function initAttractionToggle() {
  const toggleBtn = document.getElementById('attraction-toggle');
  if (!toggleBtn) return;

  const hiddenCards = document.querySelectorAll('.attraction-hidden');
  let expanded = false;

  toggleBtn.addEventListener('click', () => {
    expanded = !expanded;
    hiddenCards.forEach(card => {
      card.classList.toggle('attraction-visible', expanded);
    });
    toggleBtn.classList.toggle('expanded', expanded);
    
    // Update button text based on current language
    const lang = getCurrentLang();
    const btnSpan = toggleBtn.querySelector('span');
    if (expanded) {
      const lessText = getNestedValue(translations, 'attractions.show_less');
      btnSpan.textContent = lessText || 'Show Less';
    } else {
      const moreText = getNestedValue(translations, 'attractions.show_more');
      btnSpan.textContent = moreText || 'Show More Places';
    }

    // Re-render lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  });
}

/* ---- AVAILABILITY CALENDAR (External JSON) ---- */
function initCalendar() {
  const month1El = document.getElementById('cal-month-1');
  const month2El = document.getElementById('cal-month-2');
  const title1 = document.getElementById('cal-month-1-title');
  const title2 = document.getElementById('cal-month-2-title');
  const prevBtn = document.getElementById('cal-prev');
  const nextBtn = document.getElementById('cal-next');
  if (!month1El || !month2El) return;

  // ============================================================
  //  Calendar data is loaded from data/bookings.json
  //  Ali edits that file to manage reservations — never this code.
  // ============================================================
  let BOOKED_RANGES = [];
  let SEASON = null;
  let lastUpdated = null;

  // Month & weekday names per language
  const MONTH_NAMES = {
    en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    tr: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
    ru: ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'],
    de: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']
  };
  const WEEKDAY_NAMES = {
    en: ['Mo','Tu','We','Th','Fr','Sa','Su'],
    tr: ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'],
    ru: ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'],
    de: ['Mo','Di','Mi','Do','Fr','Sa','So']
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let currentOffset = 0;

  // Validate a single booking entry
  function isValidBooking(b) {
    if (!b || typeof b.from !== 'string' || typeof b.to !== 'string') return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(b.from) || !dateRegex.test(b.to)) return false;
    return b.from <= b.to; // from must not be after to
  }

  // Check for overlapping bookings (warning only, doesn't break)
  function checkOverlaps(bookings) {
    const sorted = [...bookings].sort((a, b) => a.from.localeCompare(b.from));
    const overlaps = [];
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].from <= sorted[i - 1].to) {
        overlaps.push({ a: sorted[i - 1], b: sorted[i] });
      }
    }
    if (overlaps.length > 0) {
      console.warn('[Palmiye Calendar] Overlapping bookings detected:', overlaps);
    }
    return overlaps;
  }

  // Load bookings from window.PALMIYE_BOOKINGS
  // Set by: bookings-source.js (API) or data/bookings.js (file:// fallback)
  async function loadBookings() {
    // Small delay to let bookings-source.js finish fetching
    if (window.location.protocol !== 'file:' && !window.PALMIYE_BOOKINGS) {
      await new Promise(r => setTimeout(r, 500));
    }

    const data = window.PALMIYE_BOOKINGS;
    if (!data) {
      console.warn('[Palmiye Calendar] No booking data available.');
      return;
    }

    if (data.bookings && Array.isArray(data.bookings)) {
      BOOKED_RANGES = data.bookings.filter(b => {
        if (!isValidBooking(b)) {
          console.warn('[Palmiye Calendar] Invalid booking entry skipped:', b);
          return false;
        }
        return true;
      });
      checkOverlaps(BOOKED_RANGES);
    }

    if (data.season && data.season.start && data.season.end) {
      SEASON = data.season;
    }
    if (data.lastUpdated) {
      lastUpdated = data.lastUpdated;
    }

    console.log(`[Palmiye Calendar] Loaded ${BOOKED_RANGES.length} bookings (updated: ${lastUpdated || 'unknown'})`);
  }

  function isBooked(dateStr) {
    return BOOKED_RANGES.some(r => dateStr >= r.from && dateStr <= r.to);
  }

  function formatDate(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function getLang() {
    return localStorage.getItem('palmiye_lang') || 'en';
  }

  function renderMonth(container, year, month) {
    const lang = getLang();
    const months = MONTH_NAMES[lang] || MONTH_NAMES.en;
    const weekdays = WEEKDAY_NAMES[lang] || WEEKDAY_NAMES.en;

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    let html = `<div class="calendar-month-label">${months[month]} ${year}</div>`;
    html += '<div class="calendar-weekdays">';
    weekdays.forEach(d => { html += `<div class="calendar-weekday">${d}</div>`; });
    html += '</div>';
    html += '<div class="calendar-days">';

    for (let i = 0; i < startDay; i++) {
      html += '<div class="calendar-day empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatDate(year, month, d);
      const dateObj = new Date(year, month, d);
      const isPast = dateObj < today;
      const isToday = dateObj.getTime() === today.getTime();
      const booked = isBooked(dateStr);

      let cls = 'calendar-day';
      if (isPast) cls += ' past';
      else if (booked) cls += ' booked';
      else cls += ' available';
      if (isToday) cls += ' today';

      html += `<div class="${cls}">${d}</div>`;
    }

    html += '</div>';
    container.innerHTML = html;
  }

  function renderLastUpdated() {
    // Insert lastUpdated info below legend
    const existingEl = document.querySelector('.calendar-last-updated');
    if (existingEl) existingEl.remove();

    if (!lastUpdated) return;

    const legend = document.querySelector('.calendar-legend');
    if (!legend) return;

    const lang = getLang();
    const labels = {
      en: 'Last updated',
      tr: 'Son güncelleme',
      ru: 'Обновлено'
    };

    const el = document.createElement('div');
    el.className = 'calendar-last-updated';
    el.innerHTML = `<i data-lucide="clock"></i> ${labels[lang] || labels.en}: ${lastUpdated}`;
    legend.parentNode.insertBefore(el, legend.nextSibling);

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function render() {
    const lang = getLang();
    const months = MONTH_NAMES[lang] || MONTH_NAMES.en;

    const d1 = new Date(today.getFullYear(), today.getMonth() + currentOffset, 1);
    const d2 = new Date(today.getFullYear(), today.getMonth() + currentOffset + 1, 1);

    title1.textContent = `${months[d1.getMonth()]} ${d1.getFullYear()}`;
    title2.textContent = `${months[d2.getMonth()]} ${d2.getFullYear()}`;

    renderMonth(month1El, d1.getFullYear(), d1.getMonth());
    renderMonth(month2El, d2.getFullYear(), d2.getMonth());

    prevBtn.disabled = currentOffset <= 0;
    nextBtn.disabled = currentOffset >= 11;

    renderLastUpdated();
  }

  prevBtn.addEventListener('click', () => { if (currentOffset > 0) { currentOffset--; render(); } });
  nextBtn.addEventListener('click', () => { if (currentOffset < 11) { currentOffset++; render(); } });

  // Load bookings then render
  loadBookings().then(() => {
    render();
  });

  // Re-render when language changes
  window._calendarRender = render;
}

/* ---- i18n — ENGLISH DEFAULT with Inline Fallback ---- */
let translations = {};

const INLINE_LANGS = {
  "en": {"nav":{"apartment":"Our Apartment","gallery":"Gallery","location":"Location","trust":"Reviews","booking":"Book Now","contact":"Contact","whatsapp":"WhatsApp","attractions":"Places to Visit","availability":"Availability"},"hero":{"trust_pill":"Booking.com 9.6 · Exceptional guest rating","title":"Your Private Retreat <span>in Antalya</span>","subtitle":"Fully equipped apartment with pool, mountain views & free parking in Kemer–Göynük","bullet1":"Shared Pool & Garden","bullet2":"Free Wi-Fi & Parking","bullet3":"Direct Booking — Best Price","cta_whatsapp":"Check Availability on WhatsApp","cta_booking":"View on Booking.com","cta_airbnb":"View on Airbnb","response_note":"<i data-lucide=\"zap\"></i> We typically respond within 5 minutes"},"calendar":{"title":"Availability Calendar","subtitle":"Check available dates and plan your stay. Green dates are available!","available":"Available","booked":"Booked","past":"Past","cta_text":"Found your dates? Book directly for the best price!","cta_btn":"Book via WhatsApp"},"trust":{"pool":"Shared Pool","pool_desc":"Adult & Kids pool","capacity":"Up to 4 Guests","capacity_desc":"Comfortable stay","wifi":"High-Speed Wi-Fi","wifi_desc":"Fiber internet","location":"Göynük Center","location_desc":"Central location","direct":"Direct Contact","direct_desc":"24/7 WhatsApp"},"booking_trust":{"score_label":"Exceptional","title":"Exceptional Rating on Booking.com","desc":"Rated 9.6 on Booking.com. Guests especially love the cleanliness, peaceful atmosphere, pool area and responsive hosting.","h1":"Verified Property","h2":"Secure Payment","h3":"Real Guest Reviews","cta":"Check Availability on Booking.com"},"cp1":{"title":"Get the Best Price — Book Directly","subtitle":"Message us on WhatsApp for availability and special rates.","cta":"Check Availability on WhatsApp"},"apartment":{"title":"Our Apartment","desc":"Close to the center, quiet, surrounded by nature — a fully equipped 1+1 apartment. Every detail designed for comfort.","capacity":"Max. 4 guests","checkin":"Check-in: 14:00","checkout":"Check-out: 11:00"},"feature":{"ac":"Air Conditioning","wifi":"High-Speed Wi-Fi","tv":"Smart TV (Netflix)","kitchen":"Equipped Kitchen","laundry":"Washing Machine","hairdryer":"Hair Dryer","baby":"Crib & High Chair","parking":"Free Parking","security":"Security Camera"},"cp2":{"title":"Like What You See?","subtitle":"Contact us for availability and pricing.","cta":"Check Availability on WhatsApp"},"gallery":{"title":"Gallery","subtitle":"Explore our apartment and surroundings with real photos.","all":"All","pool":"Pool","garden":"Garden","living":"Living Room","bedroom":"Bedroom","kitchen":"Kitchen / Bath","property":"Property"},"cp3":{"title":"Ready to Book Your Stay?","subtitle":"Send us a message — we reply within minutes.","cta":"Message Us on WhatsApp"},"location":{"title":"Location","subtitle":"Close to center, quiet, in the heart of nature.","center":"Göynük Center","center_desc":"Walking distance to shops and markets","beach":"Beach","beach_desc":"~15-20 min walk (~2 km)","canyon":"Göynük Canyon","canyon_desc":"~5 min by car","kemer":"Kemer Center","kemer_desc":"~10 min by car","airport":"Antalya Airport","airport_desc":"~50 min by car"},"pricing":{"title":"Stay Options","subtitle":"Flexible accommodation options to plan your vacation.","daily":"Daily","daily_note":"/ night starting from","daily_desc":"Flexible check-in/check-out","popular":"Popular","weekly":"Weekly","weekly_note":"discount","weekly_desc":"Valid for 7+ night stays","monthly":"Monthly","monthly_note":"discount","monthly_desc":"Valid for 30+ night stays","footer":"Message us on WhatsApp for current prices and availability."},"faq":{"title":"Frequently Asked Questions","q1":"What are the check-in and check-out times?","a1":"Check-in is from 14:00 onwards, and check-out is by 11:00 at the latest.","q2":"When is the pool open?","a2":"The property pool is open from June to November.","q3":"Is there parking?","a3":"Yes, free open-air parking is available within the property.","q4":"Is there a crib or high chair?","a4":"Yes, provided free of charge upon request.","q6":"How do I get to the beach?","a6":"~15-20 minute walk (~2 km). Kemer beach ~10 min by car.","q8":"Is airport transfer available?","a8":"Can be arranged upon request. Contact us via WhatsApp."},"booking":{"title":"Book Your Stay","subtitle":"Choose the way that works best for you.","wa_title":"Message Us on WhatsApp","wa_desc":"Instant response — Best price guaranteed","booking_title":"View on Booking.com","booking_desc":"Secure payment and instant confirmation","airbnb_title":"Also on Airbnb","airbnb_desc":"Reviews and secure payment"},"contact":{"title":"Contact","email":"Email","address":"Address","address_text":"Göynük Mah. 3270. Sok. B Blok No:1, Kemer / Antalya, Turkey","wa_btn":"Message Us on WhatsApp"},"footer":{"desc":"A peaceful and comfortable accommodation experience in the heart of nature, in Kemer – Göynük.","quick_links":"Quick Links","platforms":"Book With Us","rights":"All rights reserved."},"attractions":{"title":"Places to Visit","subtitle":"Discover the natural and historical beauties just minutes away from Palmiye Home.","read_more":"Tap for details →","show_more":"Show More Places","show_less":"Show Less","canyon":"Göynük Canyon","canyon_short":"A natural wonder with waterfalls and pine forests","phaselis":"Phaselis Ancient City","phaselis_short":"Ancient port city where you can swim among ruins","olympos":"Olympos Ancient City","olympos_short":"Ancient ruins, forest trails and a stunning beach","tahtali":"Tahtalı Mountain Cable Car","tahtali_short":"Ride up to 2,365m for breathtaking panoramic views","cirali":"Çıralı – Yanartaş (Chimera)","cirali_short":"Eternal flames burning for 2,500 years","adrasan":"Adrasan Bay","adrasan_short":"Crystal-clear shallow waters, fine sand beach","paris2":"Paris II Shipwreck","paris2_short":"One of the world's top 100 diving spots","alacasu":"Alacasu Paradise Cove","alacasu_short":"A hidden paradise with turquoise waters","beldibi":"Beldibi Cave","beldibi_short":"Prehistoric cave art dating back millennia","idyros":"Idyros Ancient City","idyros_short":"Byzantine-era geometric mosaics in Kemer center"}},
  "tr": {"nav":{"apartment":"Dairemiz","gallery":"Galeri","location":"Konum","trust":"Değerlendirmeler","booking":"Rezervasyon","contact":"İletişim","whatsapp":"WhatsApp","attractions":"Gezilecek Yerler","availability":"Müsaitlik"},"hero":{"trust_pill":"Booking.com 9,6 · Olağanüstü misafir puanı","title":"Antalya'da <span>Özel Kaçamağınız</span>","subtitle":"Kemer–Göynük'te havuzlu, dağ manzaralı, ücretsiz otoparkli tam donanımlı daire","bullet1":"Ortak Havuz & Bahçe","bullet2":"Ücretsiz Wi-Fi & Otopark","bullet3":"Doğrudan Rezervasyon — En İyi Fiyat","cta_whatsapp":"WhatsApp ile Müsaitlik Sorun","cta_booking":"Booking.com'da İnceleyin","cta_airbnb":"Airbnb'de İnceleyin","response_note":"<i data-lucide=\"zap\"></i> Genellikle 5 dakika içinde yanıt veriyoruz"},"calendar":{"title":"Müsaitlik Takvimi","subtitle":"Uygun tarihleri kontrol edin ve konaklamanızı planlayın. Yeşil tarihler müsait!","available":"Müsait","booked":"Dolu","past":"Geçmiş","cta_text":"Tarihinizi buldunuz mu? En iyi fiyat için doğrudan rezervasyon yapın!","cta_btn":"WhatsApp ile Rezervasyon"},"trust":{"pool":"Ortak Havuz","pool_desc":"Yetişkin & Çocuk havuzu","capacity":"4 Kişiye Kadar","capacity_desc":"Rahat konaklama","wifi":"Yüksek Hız Wi-Fi","wifi_desc":"Fiber internet","location":"Göynük Merkez","location_desc":"Merkezi konum","direct":"Doğrudan İletişim","direct_desc":"7/24 WhatsApp"},"booking_trust":{"score_label":"Olağanüstü","title":"Booking.com'da 9,6 Olağanüstü Puan","desc":"Booking.com üzerinde 9,6 puana sahibiz.","h1":"Doğrulanmış Mülk","h2":"Güvenli Ödeme","h3":"Gerçek Misafir Yorumları","cta":"Booking.com'da müsaitliği kontrol et"},"cp1":{"title":"En İyi Fiyatı Alın — Doğrudan Rezervasyon","subtitle":"Müsaitlik ve özel fiyatlar için WhatsApp'tan yazın.","cta":"WhatsApp ile Müsaitlik Sorun"},"apartment":{"title":"Dairemiz","desc":"Merkeze yakın, sessiz, doğa içinde tam donanımlı 1+1 apart daire.","capacity":"Maks. 4 kişi","checkin":"Giriş: 14:00","checkout":"Çıkış: 11:00"},"feature":{"ac":"Klima","wifi":"Yüksek Hız Wi-Fi","tv":"Smart TV (Netflix)","kitchen":"Donanımlı Mutfak","laundry":"Çamaşır Makinesi","hairdryer":"Saç Kurutma","baby":"Beşik & Mama Sand.","parking":"Ücretsiz Otopark","security":"Güvenlik Kamerası"},"cp2":{"title":"Beğendiniz mi?","subtitle":"Müsaitlik ve fiyat bilgisi için hemen ulaşın.","cta":"WhatsApp ile Müsaitlik Sorun"},"gallery":{"title":"Galeri","subtitle":"Gerçek fotoğraflarla dairemizi ve çevresini keşfedin.","all":"Tümü","pool":"Havuz","garden":"Bahçe","living":"Salon","bedroom":"Yatak Odası","kitchen":"Mutfak / Banyo","property":"Tesis"},"cp3":{"title":"Tatil Planınız Hazır mı?","subtitle":"Bize mesaj gönderin — dakikalar içinde yanıt veriyoruz.","cta":"WhatsApp ile Yazın"},"location":{"title":"Konum","subtitle":"Merkeze yakın, sessiz, doğanın içinde.","center":"Göynük Merkez","center_desc":"Market ve mağazalara yürüme mesafesi","beach":"Deniz","beach_desc":"~15-20 dk yürüyüş (~2 km)","canyon":"Göynük Kanyonu","canyon_desc":"~5 dk araç mesafesi","kemer":"Kemer Merkez","kemer_desc":"~10 dk araç mesafesi","airport":"Antalya Havalimanı","airport_desc":"~50 dk araç mesafesi"},"pricing":{"title":"Konaklama Seçenekleri","subtitle":"Esnek konaklama seçenekleri ile tatilinizi planlayın.","daily":"Günlük","daily_note":"/ gece'den başlayan","daily_desc":"Esnek giriş-çıkış imkanı","popular":"Popüler","weekly":"Haftalık","weekly_note":"indirimli","weekly_desc":"7+ gece konaklamalarda geçerli","monthly":"Aylık","monthly_note":"indirimli","monthly_desc":"30+ gece konaklamalarda geçerli","footer":"Güncel fiyat ve müsaitlik bilgisi için WhatsApp'tan yazın."},"faq":{"title":"Sık Sorulan Sorular","q1":"Check-in ve check-out saatleri nedir?","a1":"Giriş saat 14:00'ten itibaren, çıkış en geç saat 11:00'e kadardır.","q2":"Havuz ne zaman açık?","a2":"Haziran – Kasım ayları arası kullanıma açıktır.","q3":"Otopark var mı?","a3":"Evet, site içinde ücretsiz açık otopark mevcuttur.","q4":"Beşik veya mama sandalyesi var mı?","a4":"Evet, talep üzerine ücretsiz olarak sağlanmaktadır.","q6":"Denize nasıl ulaşılır?","a6":"~15-20 dk yürüyüş. Kemer sahili ~10 dk araçla.","q8":"Havalimanı transferi var mı?","a8":"Talep üzerine organize edilebilir. WhatsApp ile bilgi alın."},"booking":{"title":"Rezervasyon","subtitle":"Size en uygun yoldan ulaşın.","wa_title":"WhatsApp ile Yazın","wa_desc":"Anında yanıt — En iyi fiyat garantisi","booking_title":"Booking.com'da İnceleyin","booking_desc":"Güvenli ödeme ve anlık onay","airbnb_title":"Airbnb'de de Varız","airbnb_desc":"Değerlendirmeler ve güvenli ödeme"},"contact":{"title":"İletişim","email":"E-posta","address":"Adres","address_text":"Göynük Mah. 3270. Sok. B Blok No:1, Kemer / Antalya","wa_btn":"WhatsApp ile Yazın"},"footer":{"desc":"Kemer – Göynük'te doğanın kalbinde, huzurlu ve konforlu konaklama deneyimi.","quick_links":"Hızlı Bağlantılar","platforms":"Rezervasyon","rights":"Tüm hakları saklıdır."},"attractions":{"title":"Gezilecek Yerler","subtitle":"Palmiye Home yakınındaki en güzel doğal ve tarihi noktaları keşfedin.","read_more":"Detaylar için dokunun →","show_more":"Daha Fazla Yer Göster","show_less":"Daha Az Göster","canyon":"Göynük Kanyonu","canyon_short":"Şelaleler ve çam ormanlarıyla doğal bir harika","phaselis":"Phaselis Antik Kenti","phaselis_short":"Antik kalıntıların arasında yüzeceğiniz liman şehri","olympos":"Olympos Antik Kenti","olympos_short":"Antik kalıntılar, orman yolları ve muhteşem plaj","tahtali":"Tahtalı Dağı Teleferik","tahtali_short":"2.365 metreye yükselip nefes kesen panoramik manzara","cirali":"Çıralı – Yanartaş (Kimera)","cirali_short":"2.500 yıldır yanan sönmeyen ateşler","adrasan":"Adrasan Koyu","adrasan_short":"Berrak sığ sular, ince kum plaj","paris2":"Paris II Batığı","paris2_short":"Dünyanın en iyi 100 dalış noktasından biri","alacasu":"Alacasu Cennet Koyu","alacasu_short":"Turkuaz sularla gizli cennet","beldibi":"Beldibi Mağarası","beldibi_short":"Bin yıllık tarih öncesi mağara sanatı","idyros":"Idyros Antik Kenti","idyros_short":"Kemer merkezinde Bizans dönemi geometrik mozaikler"}},
  "ru": {"nav":{"apartment":"Квартира","gallery":"Галерея","location":"Расположение","trust":"Отзывы","booking":"Бронирование","contact":"Контакты","whatsapp":"WhatsApp","attractions":"Что посетить","availability":"Наличие"},"hero":{"trust_pill":"Booking.com 9.6 · Превосходная оценка гостей","title":"Ваш личный уголок <span>в Анталии</span>","subtitle":"Полностью оборудованная квартира с бассейном, видом на горы и бесплатной парковкой в Кемер–Гёйнюк","bullet1":"Общий бассейн и сад","bullet2":"Бесплатный Wi-Fi и парковка","bullet3":"Прямое бронирование — лучшая цена","cta_whatsapp":"Узнать наличие в WhatsApp","cta_booking":"Смотреть на Booking.com","cta_airbnb":"Смотреть на Airbnb","response_note":"<i data-lucide=\"zap\"></i> Обычно отвечаем в течение 5 минут"},"calendar":{"title":"Календарь доступности","subtitle":"Проверьте доступные даты и спланируйте отдых. Зелёные даты свободны!","available":"Свободно","booked":"Занято","past":"Прошло","cta_text":"Нашли свои даты? Бронируйте напрямую по лучшей цене!","cta_btn":"Забронировать в WhatsApp"},"trust":{"pool":"Общий бассейн","pool_desc":"Взрослый и детский","capacity":"До 4 гостей","capacity_desc":"Комфортное проживание","wifi":"Скоростной Wi-Fi","wifi_desc":"Оптоволокно","location":"Центр Гёйнюк","location_desc":"Центральное расположение","direct":"Прямая связь","direct_desc":"WhatsApp 24/7"},"booking_trust":{"score_label":"Превосходно","title":"Оценка 9.6 на Booking.com","desc":"На Booking.com у нас оценка 9.6.","h1":"Проверенный объект","h2":"Безопасная оплата","h3":"Реальные отзывы гостей","cta":"Проверить наличие на Booking.com"},"cp1":{"title":"Лучшая цена — бронируйте напрямую","subtitle":"Напишите нам в WhatsApp.","cta":"Узнать наличие в WhatsApp"},"apartment":{"title":"Наша квартира","desc":"Рядом с центром, тихо, на природе — полностью оборудованная квартира 1+1.","capacity":"Макс. 4 гостя","checkin":"Заезд: 14:00","checkout":"Выезд: 11:00"},"feature":{"ac":"Кондиционер","wifi":"Скоростной Wi-Fi","tv":"Smart TV (Netflix)","kitchen":"Оборудованная кухня","laundry":"Стиральная машина","hairdryer":"Фен","baby":"Кроватка и стульчик","parking":"Бесплатная парковка","security":"Камеры видеонаблюдения"},"cp2":{"title":"Понравилось?","subtitle":"Свяжитесь с нами.","cta":"Узнать наличие в WhatsApp"},"gallery":{"title":"Галерея","subtitle":"Познакомьтесь с квартирой на реальных фото.","all":"Все","pool":"Бассейн","garden":"Сад","living":"Гостиная","bedroom":"Спальня","kitchen":"Кухня / Ванная","property":"Территория"},"cp3":{"title":"Готовы забронировать?","subtitle":"Напишите нам — ответим за минуты.","cta":"Написать в WhatsApp"},"location":{"title":"Расположение","subtitle":"Рядом с центром, в сердце природы.","center":"Центр Гёйнюк","center_desc":"Магазины в пешей доступности","beach":"Пляж","beach_desc":"~15-20 мин пешком (~2 км)","canyon":"Каньон Гёйнюк","canyon_desc":"~5 мин на авто","kemer":"Центр Кемера","kemer_desc":"~10 мин на авто","airport":"Аэропорт Анталии","airport_desc":"~50 мин на авто"},"pricing":{"title":"Варианты проживания","subtitle":"Гибкие условия для вашего отдыха.","daily":"Посуточно","daily_note":"/ ночь от","daily_desc":"Гибкий заезд/выезд","popular":"Популярный","weekly":"Понедельно","weekly_note":"скидка","weekly_desc":"При бронировании от 7 ночей","monthly":"Помесячно","monthly_note":"скидка","monthly_desc":"При бронировании от 30 ночей","footer":"Напишите в WhatsApp для актуальных цен."},"faq":{"title":"Часто задаваемые вопросы","q1":"Какое время заезда и выезда?","a1":"Заезд с 14:00, выезд до 11:00.","q2":"Когда открыт бассейн?","a2":"Июнь — ноябрь.","q3":"Есть ли парковка?","a3":"Да, бесплатная открытая парковка.","q4":"Есть ли кроватка?","a4":"Да, бесплатно по запросу.","q6":"Как до пляжа?","a6":"~15-20 мин пешком. Кемер ~10 мин на авто.","q8":"Есть ли трансфер?","a8":"По запросу. Свяжитесь через WhatsApp."},"booking":{"title":"Забронировать","subtitle":"Выберите удобный способ.","wa_title":"Написать в WhatsApp","wa_desc":"Мгновенный ответ — лучшая цена","booking_title":"Смотреть на Booking.com","booking_desc":"Безопасная оплата","airbnb_title":"Также на Airbnb","airbnb_desc":"Отзывы и безопасная оплата"},"contact":{"title":"Контакты","email":"Эл. почта","address":"Адрес","address_text":"Göynük Mah. 3270. Sok. B Blok No:1, Кемер / Анталия","wa_btn":"Написать в WhatsApp"},"footer":{"desc":"Спокойный отдых в сердце природы, в Кемер – Гёйнюк.","quick_links":"Быстрые ссылки","platforms":"Забронировать","rights":"Все права защищены."},"attractions":{"title":"Что посетить рядом","subtitle":"Откройте красивые места рядом с Palmiye Home.","read_more":"Нажмите для подробностей →","show_more":"Показать больше мест","show_less":"Показать меньше","canyon":"Каньон Гёйнюк","canyon_short":"Природное чудо с водопадами","phaselis":"Фазелис","phaselis_short":"Античный город среди руин","olympos":"Олимпос","olympos_short":"Античные руины и пляж","tahtali":"Тахталы","tahtali_short":"Подъём на 2365 м","cirali":"Химера","cirali_short":"Вечные огни 2500 лет","adrasan":"Адрасан","adrasan_short":"Кристальные воды","paris2":"Париж II","paris2_short":"Топ-100 дайвинг","alacasu":"Алакасу","alacasu_short":"Скрытый рай","beldibi":"Бельдиби","beldibi_short":"Доисторическое искусство","idyros":"Идирос","idyros_short":"Византийские мозаики"}}
};


function getCurrentLang() {
  return localStorage.getItem('palmiye_lang') || detectBrowserLang() || 'en';
}

function detectBrowserLang() {
  const lang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (lang.startsWith('tr')) return 'tr';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('de')) return 'de';
  return null;
}

async function loadLanguage(lang) {
  try {
    // Try fetch first (works on web servers)
    const res = await fetch(`lang/${lang}.json`);
    if (!res.ok) throw new Error('File not found');
    translations = await res.json();
  } catch (err) {
    // Fallback: try inline data
    if (INLINE_LANGS[lang]) {
      translations = INLINE_LANGS[lang];
    } else {
      // Try to load via script tag as fallback for file:// protocol
      try {
        const response = await loadJsonViaXhr(`lang/${lang}.json`);
        translations = response;
      } catch (e) {
        console.warn(`Language file for "${lang}" not available. Using cached data if exists.`);
        return;
      }
    }
  }

  applyTranslations();
  document.documentElement.lang = lang;
  localStorage.setItem('palmiye_lang', lang);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

// XMLHttpRequest fallback for file:// protocol
function loadJsonViaXhr(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.onload = function() {
      if (xhr.status === 200 || xhr.status === 0) { // status 0 for file://
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          reject(e);
        }
      } else {
        reject(new Error('XHR failed'));
      }
    };
    xhr.onerror = function() { reject(new Error('XHR error')); };
    xhr.send();
  });
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = getNestedValue(translations, key);
    if (val) {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        // skip
      } else {
        el.innerHTML = val;
      }
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const val = getNestedValue(translations, key);
    if (val) el.placeholder = val;
  });

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Re-render calendar with new language month/weekday names
  if (typeof window._calendarRender === 'function') window._calendarRender();
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}

function initI18n() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadLanguage(btn.dataset.lang);
    });
  });

  // Load saved or auto-detected language
  const saved = getCurrentLang();
  // Always load the language file (including English) to ensure switching works
  loadLanguage(saved);
}

/* ---- GUEST REVIEWS CAROUSEL ---- */
function initReviewsCarousel() {
  const carousel = document.getElementById('reviews-carousel');
  if (!carousel) return;

  const cards = carousel.querySelectorAll('.review-card');
  const dots = carousel.querySelectorAll('.review-dot');
  if (!cards.length) return;

  let current = 0;
  let interval;

  function showReview(index) {
    cards[current].style.display = 'none';
    if (dots[current]) dots[current].classList.remove('active');
    current = (index + cards.length) % cards.length;
    cards[current].style.display = 'block';
    if (dots[current]) dots[current].classList.add('active');
  }

  // Hide all except first
  cards.forEach((card, i) => {
    card.style.display = i === 0 ? 'block' : 'none';
  });

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      showReview(i);
      resetInterval();
    });
  });

  function resetInterval() {
    clearInterval(interval);
    interval = setInterval(() => showReview(current + 1), 7000);
  }

  interval = setInterval(() => showReview(current + 1), 7000);
}

/* ---- BACK TO TOP ---- */
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 600);
  }, { passive: true });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* ---- COOKIE NOTICE ---- */
function initCookieNotice() {
  const notice = document.getElementById('cookie-notice');
  if (!notice) return;
  if (localStorage.getItem('palmiye_cookies_accepted')) return;

  setTimeout(() => notice.classList.add('visible'), 2000);

  const acceptBtn = notice.querySelector('.cookie-accept');
  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('palmiye_cookies_accepted', '1');
      notice.classList.remove('visible');
    });
  }
}

/* ---- LAZY IMAGE LOAD ---- */
function initLazyImages() {
  document.querySelectorAll('img[loading="lazy"]').forEach(img => {
    if (img.complete) {
      img.classList.add('loaded');
    } else {
      img.addEventListener('load', () => img.classList.add('loaded'), { once: true });
    }
  });
}

/* ---- CALENDAR DATE SELECTION (WhatsApp pre-fill) ---- */
function initCalendarDateSelection() {
  const calWrapper = document.querySelector('.calendar-wrapper');
  if (!calWrapper) {
    // Calendar not yet rendered, observe for it
    const observer = new MutationObserver(() => {
      const cw = document.querySelector('.calendar-wrapper');
      if (cw) {
        observer.disconnect();
        setupCalendarSelection(cw);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    // Auto-disconnect after 10s
    setTimeout(() => observer.disconnect(), 10000);
  } else {
    setupCalendarSelection(calWrapper);
  }
}

function setupCalendarSelection(calWrapper) {
  let startDate = null;
  let endDate = null;

  // Month name mapping for all supported languages
  const MONTH_MAP = {
    'January': 0, 'February': 1, 'March': 2, 'April': 3, 'May': 4, 'June': 5,
    'July': 6, 'August': 7, 'September': 8, 'October': 9, 'November': 10, 'December': 11,
    'Ocak': 0, 'Şubat': 1, 'Mart': 2, 'Nisan': 3, 'Mayıs': 4, 'Haziran': 5,
    'Temmuz': 6, 'Ağustos': 7, 'Eylül': 8, 'Ekim': 9, 'Kasım': 10, 'Aralık': 11,
    'Январь': 0, 'Февраль': 1, 'Март': 2, 'Апрель': 3, 'Май': 4, 'Июнь': 5,
    'Июль': 6, 'Август': 7, 'Сентябрь': 8, 'Октябрь': 9, 'Ноябрь': 10, 'Декабрь': 11,
    'Januar': 0, 'Februar': 1, 'März': 2, 'April': 3, 'Mai': 4, 'Juni': 5,
    'Juli': 6, 'August': 7, 'September': 8, 'Oktober': 9, 'November': 10, 'Dezember': 11
  };

  calWrapper.addEventListener('click', (e) => {
    const day = e.target.closest('.calendar-day.available');
    if (!day) return;

    const monthContainer = day.closest('.calendar-month');
    if (!monthContainer) return;

    const label = monthContainer.querySelector('.calendar-month-label');
    if (!label) return;

    const dayNum = parseInt(day.textContent);
    if (isNaN(dayNum)) return;

    // Parse month and year from month label
    const labelText = label.textContent.trim();
    let month = -1;
    let year = new Date().getFullYear();

    for (const [name, idx] of Object.entries(MONTH_MAP)) {
      if (labelText.includes(name)) {
        month = idx;
        const yearMatch = labelText.match(/\d{4}/);
        if (yearMatch) year = parseInt(yearMatch[0]);
        break;
      }
    }

    if (month === -1) return;

    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

    if (!startDate || (startDate && endDate)) {
      // First click or reset
      startDate = dateStr;
      endDate = null;
      clearSelection();
      day.classList.add('selected');
    } else {
      // Second click
      if (dateStr < startDate) {
        endDate = startDate;
        startDate = dateStr;
      } else {
        endDate = dateStr;
      }
      clearSelection();
      day.classList.add('selected');
    }

    updateSelectionBar(startDate, endDate);
  });

  function clearSelection() {
    calWrapper.querySelectorAll('.calendar-day.selected').forEach(d => {
      d.classList.remove('selected');
    });
  }

  function updateSelectionBar(start, end) {
    let bar = calWrapper.querySelector('.calendar-selection-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'calendar-selection-bar';
      bar.innerHTML = `
        <span class="selected-dates"></span>
        <a class="btn btn-whatsapp btn-sm" href="#" target="_blank" rel="noopener">
          <i data-lucide="message-circle"></i>
          <span data-i18n="calendar.cta_btn">Book via WhatsApp</span>
        </a>
      `;
      calWrapper.appendChild(bar);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    const datesSpan = bar.querySelector('.selected-dates');
    const waLink = bar.querySelector('a');

    const formatDisplay = (d) => {
      const parts = d.split('-');
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    };

    if (start && end) {
      datesSpan.textContent = `${formatDisplay(start)} → ${formatDisplay(end)}`;

      const lang = getCurrentLang();
      const msgs = {
        en: `Hello! I'd like to book Palmiye Home from ${formatDisplay(start)} to ${formatDisplay(end)}. Is it available?`,
        tr: `Merhaba! Palmiye Home'u ${formatDisplay(start)} - ${formatDisplay(end)} tarihleri arasında kiralamak istiyorum. Müsait mi?`,
        ru: `Здравствуйте! Хочу забронировать Palmiye Home с ${formatDisplay(start)} по ${formatDisplay(end)}. Свободно?`,
        de: `Hallo! Ich möchte Palmiye Home vom ${formatDisplay(start)} bis ${formatDisplay(end)} buchen. Ist es verfügbar?`
      };
      const msg = encodeURIComponent(msgs[lang] || msgs.en);
      waLink.href = `https://wa.me/905327786732?text=${msg}`;

      bar.classList.add('visible');
    } else if (start) {
      const langLabels = {
        en: `Check-in: ${formatDisplay(start)} — tap checkout date`,
        tr: `Giriş: ${formatDisplay(start)} — çıkış tarihine dokunun`,
        ru: `Заезд: ${formatDisplay(start)} — выберите дату выезда`,
        de: `Check-in: ${formatDisplay(start)} — Abreisedatum wählen`
      };
      datesSpan.textContent = langLabels[getCurrentLang()] || langLabels.en;
      bar.classList.add('visible');
    }
  }
}

/* ---- URGENCY BADGE (auto-calculated) ---- */
function initUrgencyBadge() {
  const badge = document.getElementById('urgency-badge');
  if (!badge) return;

  function updateUrgency() {
    const data = window.PALMIYE_BOOKINGS;
    if (!data || !data.bookings) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeMonths = new Date(today);
    threeMonths.setMonth(threeMonths.getMonth() + 3);

    const totalDays = Math.ceil((threeMonths - today) / (1000 * 60 * 60 * 24));
    let bookedDays = 0;

    data.bookings.forEach(b => {
      const from = new Date(b.from + 'T00:00:00');
      const to = new Date(b.to + 'T00:00:00');

      const effectiveFrom = from < today ? today : from;
      const effectiveTo = to > threeMonths ? threeMonths : to;

      if (effectiveFrom < effectiveTo) {
        bookedDays += Math.ceil((effectiveTo - effectiveFrom) / (1000 * 60 * 60 * 24));
      }
    });

    const availableDays = totalDays - bookedDays;
    const availableWeeks = Math.floor(availableDays / 7);

    if (availableWeeks <= 8) {
      const lang = getCurrentLang();
      const msgs = {
        en: `Only ${availableWeeks} weeks available in the next 3 months!`,
        tr: `Önümüzdeki 3 ayda sadece ${availableWeeks} hafta müsait!`,
        ru: `Только ${availableWeeks} недель свободно в ближайшие 3 месяца!`,
        de: `Nur noch ${availableWeeks} Wochen verfügbar in den nächsten 3 Monaten!`
      };
      badge.textContent = msgs[lang] || msgs.en;
      badge.style.display = 'inline-flex';
    }
  }

  // Wait for bookings to load
  const checkInterval = setInterval(() => {
    if (window.PALMIYE_BOOKINGS) {
      clearInterval(checkInterval);
      updateUrgency();
    }
  }, 500);

  // Clear after 10 seconds if no data
  setTimeout(() => clearInterval(checkInterval), 10000);
}
