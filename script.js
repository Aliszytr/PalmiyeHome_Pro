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
  try { notifyVisitor(); } catch(e) { console.log('Notify skipped'); }
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

    if (
      data.season &&
      typeof data.season === "object" &&
      typeof data.season.start === "string" &&
      typeof data.season.end === "string"
    ) {
      SEASON = data.season;
    }
    if (data.lastUpdated) {
      lastUpdated = data.lastUpdated;
    }

    // Booking data loaded successfully
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

  // Re-render when API delivers fresh data (fixes race if API > 500ms)
  window.addEventListener('palmiye-bookings-loaded', () => {
    loadBookings().then(() => {
      render();
      // Also update urgency badge if it exists
      if (typeof initUrgencyBadge === 'function') {
        try { initUrgencyBadge(); } catch(_) {}
      }
    });
  });

  // Re-render when language changes
  window._calendarRender = render;
}

/* ---- i18n — ENGLISH DEFAULT with Inline Fallback ---- */
let translations = {};
// English strings used for keys a language has not translated yet
let fallbackTranslations = null;

const INLINE_LANGS = {
  "en": {"meta":{"title":"Palmiye Home — Pool Apartment in Kemer Göynük, Antalya","description":"Fully equipped 1+1 apartment with shared pool in Kemer Göynük, Antalya. Mountain views, free Wi-Fi, parking. 9.4 on Booking.com. Send your dates and guest count on WhatsApp.","og_title":"Palmiye Home — Pool Apartment in Kemer, Antalya","og_description":"Fully equipped 1+1 apartment with shared pool in Kemer Göynük. 9.4 on Booking.com. Check availability via WhatsApp, Booking.com or Airbnb.","keywords":"kemer apartment rental, göynük holiday, pool apartment antalya, turkey vacation rental, palmiye home, whatsapp booking, kemer konaklama"},"nav":{"apartment":"Our Apartment","gallery":"Gallery","location":"Location","trust":"Reviews","booking":"Book Now","contact":"Contact","whatsapp":"WhatsApp","attractions":"Places to Visit","availability":"Availability"},"hero":{"trust_pill":"9.4 on Booking.com","title":"Wake Up to Silence, <span>Start Your Day by the Mountain View Pool</span>","subtitle":"Kemer Göynük · Fully Equipped Apartment · Pool · Antalya","bullet1":"Shared Pool & Garden","bullet2":"Free Wi-Fi & Parking","bullet3":"Direct Contact — Fast Response","cta_whatsapp":"Check Availability on WhatsApp","cta_booking":"View on Booking.com","cta_airbnb":"View on Airbnb"},"calendar":{"title":"Availability Calendar","subtitle":"Check available dates and plan your stay. Green dates are available!","available":"Available","booked":"Booked","past":"Past","cta_text":"Found your dates? Send them to check availability.","cta_btn":"Check via WhatsApp","whatsapp_message":"Hello! I'd like to book Palmiye Home from {start} to {end}. Is it available?"},"trust":{"pool":"Shared Pool","pool_desc":"Adult & Kids pool","capacity":"Up to 4 Guests","capacity_desc":"Comfortable stay","wifi":"High-Speed Wi-Fi","wifi_desc":"Fiber internet","location":"Göynük Center","location_desc":"Central location","direct":"Direct Contact","direct_desc":"WhatsApp"},"booking_trust":{"title":"9.4 on Booking.com","desc":"Rated 9.4 on Booking.com. Guests especially love the cleanliness, peaceful atmosphere, pool area and responsive hosting.","h1":"Verified Property","h2":"Secure Payment","h3":"Real Guest Reviews","cta":"Check Availability on Booking.com"},"cp1":{"title":"Check Availability — Book with Confidence","subtitle":"Message us with your dates and guest count.","cta":"Check Availability on WhatsApp"},"apartment":{"title":"Our Apartment","desc":"Close to the center, quiet, surrounded by nature — a fully equipped 1+1 apartment. Every detail designed for comfort.","capacity":"Max. 4 guests","checkin":"Check-in: 14:00–23:00","checkout":"Check-out: 11:00"},"feature":{"ac":"Air Conditioning","wifi":"High-Speed Wi-Fi","tv":"Smart TV (Netflix)","kitchen":"Equipped Kitchen","laundry":"Washing Machine","hairdryer":"Hair Dryer","baby":"Crib & High Chair","parking":"Free Parking","security":"Exterior security cameras (entrance &amp; common areas)"},"cp2":{"title":"Like What You See?","subtitle":"Contact us for availability and reservation details.","cta":"Check Availability on WhatsApp"},"gallery":{"title":"Gallery","subtitle":"Explore our apartment and surroundings with real photos.","all":"All","pool":"Pool","garden":"Garden","living":"Living Room","bedroom":"Bedroom","kitchen":"Kitchen / Bath","property":"Property"},"cp3":{"title":"Ready to Book Your Stay?","subtitle":"Contact us for availability and reservation details.","cta":"Message Us on WhatsApp"},"location":{"title":"Location","subtitle":"Close to center, quiet, in the heart of nature.","center":"Göynük Center","center_desc":"Walking distance to shops and markets","beach":"Beach","beach_desc":"~15-20 min walk (~2 km)","canyon":"Göynük Canyon","canyon_desc":"~5 min by car","kemer":"Kemer Center","kemer_desc":"~10 min by car","airport":"Antalya Airport","airport_desc":"~50 min by car"},"faq":{"title":"Frequently Asked Questions","q1":"What are the check-in and check-out times?","a1":"Check-in is from 14:00 to 23:00, and check-out is by 11:00 at the latest. You can contact us in advance for flexible times.","q2":"When is the pool open?","a2":"The property has a seasonal shared pool with an adult and a children's pool.","q3":"Is there parking?","a3":"Yes, free open-air parking is available within the property.","q4":"Is there a crib or high chair?","a4":"Yes, a baby crib and high chair are provided free of charge upon request.","q6":"How do I get to the beach?","a6":"The beach is approximately a 15-20 minute walk (~2 km). You can reach Kemer beach in about 10 minutes by car.","q8":"Is airport transfer available?","a8":"Can be arranged upon request. Contact us via WhatsApp."},"booking":{"title":"Book Your Stay","subtitle":"Choose the way that works best for you.","wa_title":"Message Us on WhatsApp","wa_desc":"Fast response via WhatsApp","booking_title":"View on Booking.com","booking_desc":"Secure payment","airbnb_title":"Also on Airbnb","airbnb_desc":"Reviews and secure payment"},"contact":{"title":"Contact","email":"Email","address":"Address","address_text":"Göynük Mah. 3270. Sok. B Blok No:1, Kemer / Antalya, Turkey","wa_btn":"Message Us on WhatsApp"},"footer":{"desc":"A peaceful and comfortable accommodation experience in the heart of nature, in Kemer – Göynük.","quick_links":"Quick Links","platforms":"Book With Us","rights":"All rights reserved.","privacy":"Privacy Policy","terms":"Terms & Conditions"},"reviews":{"title":"What Our Guests Say","subtitle":"⭐ 9.4 on Booking.com"},"attractions":{"title":"Places to Visit","subtitle":"Discover the natural and historical beauties just minutes away from Palmiye Home.","read_more":"Tap for details →","show_more":"Show More Places","show_less":"Show Less","canyon":"Göynük Canyon","canyon_short":"A natural wonder with waterfalls and pine forests","canyon_desc":"One of Kemer's most popular attractions, Göynük Canyon is located on the Lycian Way within the Beydağları Coastal National Park. This natural wonder features stunning scenery, rich vegetation, and waterfalls. The area also contains artificial ponds, streams, and natural pools. Ranked among the world's top 10 trekking routes, it's an essential destination for nature lovers. You can swim in its ice-blue waters, enjoy camping facilities, and create an unforgettable holiday itinerary.","phaselis":"Phaselis Ancient City","phaselis_short":"Ancient port city where you can swim among ruins","phaselis_desc":"Founded by Rhodians in the 7th century BC, this city sits on a peninsula extending into the Mediterranean. For years it served as one of the most important ports on Lycia's eastern coast, boasting four harbors. The surviving ruins mostly date from Roman and Byzantine periods, including a main avenue connecting north and south harbors, a square, theater, temple remnants, and three agoras.","olympos":"Olympos Ancient City","olympos_short":"Ancient ruins, forest trails and a stunning beach","olympos_desc":"Another renowned port city after Phaselis, Olympos features ruins from the Roman, Byzantine, and Hellenistic periods. The city stretches east-west, situated at the river mouth and connected by a bridge — one pillar still stands today. Follow the stream path through the ancient city to reach the beautiful Olympos Beach on foot.","tahtali":"Tahtalı Mountain Cable Car","tahtali_short":"Ride up to 2,365m for breathtaking panoramic views","tahtali_desc":"Standing at 2,365 meters, Tahtalı is one of the tallest mountains in the region. The summit is accessible by cable car from Olympos, offering spectacular nature views along the way. This cable car holds the title of Europe's longest and the world's second longest.","cirali":"Çıralı – Yanartaş (Chimera)","cirali_short":"Eternal flames burning for 2,500 years","cirali_desc":"Known as the \"Eternal Flame of Olympos,\" this remarkable site features naturally burning rocks fueled by methane gas seeping from the earth. Referenced in Homer's texts and mythologized over centuries, the fires have been considered sacred. These stones have been burning continuously for over 2,500 years.","adrasan":"Adrasan Bay","adrasan_short":"Crystal-clear shallow waters, fine sand beach","adrasan_desc":"One of the most popular beaches in the area with pristine waters, Adrasan Bay is about an hour from Kemer. With a 4,000-year history, this location is surrounded by orange and pine trees. The bay's most distinctive feature is its shallow, stone-free, fine-sand beach with calm waters.","paris2":"Paris II Shipwreck","paris2_short":"One of the world's top 100 diving spots","paris2_desc":"Listed among the world's 100 most remarkable diving spots, Paris II is a French ship that sank in Kemer waters during World War I. Resting 33 meters offshore, the wreck still contains six anti-aircraft guns and two torpedo tubes, making it a fascinating underwater museum.","alacasu":"Alacasu Paradise Cove","alacasu_short":"A hidden paradise with turquoise waters","alacasu_desc":"Considered one of Kemer's hidden gems, this cove is about 90 minutes from the center. With its 175-meter beach, trekking trails, crystal-blue swimming waters, and camping and picnic areas, it's an ideal escape from the city.","beldibi":"Beldibi Cave","beldibi_short":"Prehistoric cave art dating back millennia","beldibi_desc":"Located about 20 kilometers from Kemer, this cave sits where the sea meets the rocks. Its walls feature animal and human figures. Research has uncovered artifacts from the Neolithic, Paleolithic, and Mesolithic eras.","idyros":"Idyros Ancient City","idyros_short":"Byzantine-era geometric mosaics in Kemer center","idyros_desc":"Uncovered during excavations in 1976, this ancient city harbors artifacts from the Byzantine period. The most distinctive find is a geometric-patterned mosaic floor. Located right in Kemer's town center."},"featured_reviews":{"review1_text":"We recently spent a week at this apartment, and our experience was nothing short of delightful. The apartment was modern, stylish and comfortable, with a fully functional kitchen including stove, oven and dishwasher. The Wi-Fi was reliable and fast. Just an 8-minute walk from Migros and Bim shops. A special mention goes to Meltem, who truly made our stay exceptional — incredibly responsive and kind. Highly recommend!","review1_author":"Roman","review1_meta":"🇷🇸 Serbia · August 2024","review2_text":"Ruhige Gegend und alles Neubau. Küchengeräte alles Neue, wir haben das Gefühl gehabt das wir dieses Apartment als erste nutzen. Pool Neu und Top sauber. Das war unser bester Unterkunft seit 15 Jahren, und wir machen jährlich Urlaub. Können wir nur empfehlen :-)","review2_author":"Dudojc","review2_meta":"🇩🇪 Germany · August 2024","verified_badge":"✓ Verified on Booking.com","see_all_link":"See all reviews on Booking.com"},"comparison":{"title":"Reservation Channels","subtitle":"Choose the channel you prefer and confirm availability for your dates.","channel_label":"Channel","detail_label":"What to expect","action_label":"Action","whatsapp_channel":"WhatsApp","whatsapp_detail":"Fast response from the host","whatsapp_action":"Send dates and guest count","booking_channel":"Booking.com","booking_detail":"Verified listing and guest reviews","booking_action":"View listing details","airbnb_channel":"Airbnb","airbnb_detail":"Additional platform option","airbnb_action":"View listing details","cta":"Check Availability on WhatsApp"},"trust_badges":{"fast_response":"Fast WhatsApp Response","verified_channels":"Verified Booking Channels"},"reservation":{"title":"Reservation Options","subtitle":"Check availability and choose the booking channel that suits you best.","option_whatsapp":"WhatsApp for fast availability replies","option_booking":"Booking.com listing with verified guest feedback","option_airbnb":"Airbnb listing for another trusted channel","cta_wa":"Check Availability on WhatsApp","cta_booking":"View on Booking.com","cta_airbnb":"View on Airbnb","footer":"Availability and reservation details are confirmed through your chosen booking channel."}},
  "tr": {"meta":{"title":"Palmiye Home Kemer | Havuzlu Kiralık Daire Göynük – Booking.com 9.4 Puan","description":"Kemer Göynük'te havuzlu, tam donanımlı 1+1 kiralık tatil dairesi. Booking.com'da 9.4 puan. Ücretsiz Wi-Fi, otopark, dağ manzarası. WhatsApp ile hızlı rezervasyon.","og_title":"Palmiye Home | Kemer Göynük Havuzlu Kiralık Daire","og_description":"Booking.com'da 9.4 puanlı, havuzlu 1+1 tatil dairesi. Kemer Göynük'te doğa içinde huzur.","keywords":"kemer kiralık daire, göynük tatil evi, havuzlu kiralık daire antalya, kemer apart, göynük apartment rental, kemer holiday home pool, palmiye home kemer"},"nav":{"apartment":"Dairemiz","gallery":"Galeri","location":"Konum","trust":"Değerlendirmeler","booking":"Rezervasyon","contact":"İletişim","whatsapp":"WhatsApp","attractions":"Gezilecek Yerler","availability":"Müsaitlik"},"hero":{"trust_pill":"Booking.com'da 9,4","title":"Sessiz Bir Sabaha Uyan, <span>Dağ Manzaralı Havuzda Güne Başla</span>","subtitle":"Kemer Göynük · Donanımlı Apart · Havuz · Antalya","bullet1":"Ortak Havuz & Bahçe","bullet2":"Ücretsiz Wi-Fi & Otopark","bullet3":"Doğrudan Rezervasyon","cta_whatsapp":"WhatsApp ile Müsaitlik Sorun","cta_booking":"Booking.com'da İnceleyin"},"calendar":{"title":"Müsaitlik Takvimi","subtitle":"Uygun tarihleri kontrol edin ve konaklamanızı planlayın. Yeşil tarihler müsait!","available":"Müsait","booked":"Dolu","past":"Geçmiş","cta_text":"Tarihinizi buldunuz mu? Doğrudan rezervasyon yapın!","cta_btn":"WhatsApp ile Rezervasyon","whatsapp_message":"Merhaba! Palmiye Home'u {start} - {end} tarihleri arasında kiralamak istiyorum. Müsait mi?"},"trust":{"pool":"Ortak Havuz","pool_desc":"Yetişkin & Çocuk havuzu","capacity":"4 Kişiye Kadar","capacity_desc":"Rahat konaklama","wifi":"Yüksek Hız Wi-Fi","wifi_desc":"Fiber internet","location":"Göynük Merkez","location_desc":"Merkezi konum","direct":"Doğrudan İletişim","direct_desc":"WhatsApp"},"booking_trust":{"title":"Booking.com'da 9,4 Puan","desc":"Booking.com üzerinde 9,4 puana sahibiz. Misafirler özellikle temizlik, huzurlu ortam, havuz alanı ve hızlı iletişimi çok beğeniyor.","h1":"Doğrulanmış Mülk","h2":"Güvenli Ödeme","h3":"Gerçek Misafir Yorumları","cta":"Booking.com'da müsaitliği kontrol et"},"cp1":{"title":"Doğrudan Rezervasyon","subtitle":"Müsaitlik ve rezervasyon için WhatsApp'tan yazın.","cta":"WhatsApp ile Müsaitlik Sorun"},"apartment":{"title":"Dairemiz","desc":"Merkeze yakın, sessiz, doğa içinde tam donanımlı 1+1 apart daire. Her şey düşünülmüş konfor.","capacity":"Maks. 4 kişi","checkin":"Giriş: 14:00–23:00","checkout":"Çıkış: 11:00"},"feature":{"ac":"Klima","wifi":"Yüksek Hız Wi-Fi","tv":"Smart TV (Netflix)","kitchen":"Donanımlı Mutfak","laundry":"Çamaşır Makinesi","hairdryer":"Saç Kurutma","baby":"Beşik & Mama Sand.","parking":"Ücretsiz Otopark","security":"Dış mekân güvenlik kameraları (giriş ve ortak alanlar)"},"cp2":{"title":"Beğendiniz mi?","subtitle":"Müsaitlik ve rezervasyon için hemen ulaşın.","cta":"WhatsApp ile Müsaitlik Sorun"},"gallery":{"title":"Galeri","subtitle":"Gerçek fotoğraflarla dairemizi ve çevresini keşfedin.","all":"Tümü","pool":"Havuz","garden":"Bahçe","living":"Salon","bedroom":"Yatak Odası","kitchen":"Mutfak / Banyo","property":"Tesis"},"cp3":{"title":"Tatil Planınız Hazır mı?","subtitle":"Müsaitlik ve rezervasyon için hemen ulaşın.","cta":"WhatsApp ile Yazın"},"location":{"title":"Konum","subtitle":"Merkeze yakın, sessiz, doğanın içinde.","center":"Göynük Merkez","center_desc":"Market ve mağazalara yürüme mesafesi","beach":"Deniz","beach_desc":"~15-20 dk yürüyüş (~2 km)","canyon":"Göynük Kanyonu","canyon_desc":"~5 dk araç mesafesi","kemer":"Kemer Merkez","kemer_desc":"~10 dk araç mesafesi","airport":"Antalya Havalimanı","airport_desc":"~50 dk araç mesafesi"},"faq":{"title":"Sık Sorulan Sorular","q1":"Check-in ve check-out saatleri nedir?","a1":"Giriş (check-in) saat 14:00–23:00 arasında, çıkış (check-out) en geç saat 11:00'e kadardır. Esnek saatler için önceden iletişime geçebilirsiniz.","q2":"Havuz ne zaman açık?","a2":"Sitede sezonluk ortak havuz bulunmaktadır; yetişkin ve çocuk havuzu mevcuttur.","q3":"Otopark var mı?","a3":"Evet, site içinde ücretsiz açık otopark mevcuttur.","q4":"Çocuklar için beşik veya mama sandalyesi var mı?","a4":"Evet, talep üzerine bebek beşiği ve mama sandalyesi ücretsiz olarak sağlanmaktadır.","q6":"Denize nasıl ulaşılır?","a6":"Deniz yaklaşık 15-20 dakika yürüme mesafesindedir (~2 km). Kemer sahiline araçla yaklaşık 10 dakikada ulaşabilirsiniz.","q8":"Havalimanı transferi var mı?","a8":"Havalimanı transfer hizmeti talep üzerine organize edilebilir. Detaylar için WhatsApp üzerinden bilgi alabilirsiniz."},"booking":{"title":"Rezervasyon","subtitle":"Size en uygun yoldan ulaşın.","wa_title":"WhatsApp ile Yazın","wa_desc":"Doğrudan rezervasyon","booking_title":"Booking.com'da İnceleyin","booking_desc":"Güvenli ödeme","airbnb_title":"Airbnb'de de Varız","airbnb_desc":"Değerlendirmeler ve güvenli ödeme"},"contact":{"title":"İletişim","email":"E-posta","address":"Adres","address_text":"Göynük Mah. 3270. Sok. B Blok No:1, Kemer / Antalya","wa_btn":"WhatsApp ile Yazın"},"footer":{"desc":"Doğanın kalbinde, Kemer – Göynük'te huzurlu ve konforlu bir tatil deneyimi.","quick_links":"Hızlı Linkler","platforms":"Rezervasyon Yap","rights":"Tüm hakları saklıdır.","privacy":"Gizlilik Politikası","terms":"Kullanım Koşulları"},"reviews":{"title":"Misafirlerimiz Ne Diyor?","subtitle":"⭐ Booking.com'da 9,4"},"attractions":{"title":"Gezilecek Yerler","subtitle":"Palmiye Home yakınındaki en güzel doğal ve tarihi noktaları keşfedin.","read_more":"Detaylar için dokunun →","show_more":"Daha Fazla Yer Göster","show_less":"Daha Az Göster","canyon":"Göynük Kanyonu","canyon_short":"Şelaleler ve çam ormanlarıyla doğal bir harika","canyon_desc":"Kemer'in en popüler doğa noktalarından biri olan Göynük Kanyonu, Beydağları Sahil Milli Parkı sınırları içinde Likya Yolu üzerinde yer alır. Zengin bitki örtüsü, şelaleleri ve muhteşem manzaralarıyla doğal bir harikadır. Yapay göletler, akarsular ve doğal havuzlar barındırır. Dünyanın en iyi 10 trekking rotası arasında gösterilen kanyon, doğaseverler için vazgeçilmez bir destinasyondur.","phaselis":"Phaselis Antik Kenti","phaselis_short":"Antik kalıntıların arasında yüzeceğiniz liman şehri","phaselis_desc":"MÖ 7. yüzyılda Rodoslular tarafından kurulan bu şehir, Akdeniz'e uzanan bir yarımada üzerinde yer alır. Likya'nın doğu kıyısındaki en önemli limanlardan biri olarak dört limana sahipti. Günümüze ulaşan kalıntılar Roma ve Bizans dönemlerine aittir.","olympos":"Olympos Antik Kenti","olympos_short":"Antik kalıntılar, orman yolları ve muhteşem plaj","olympos_desc":"Phaselis'ten sonra bir diğer ünlü liman kenti olan Olympos, Roma, Bizans ve Helenistik dönemlere ait kalıntılara sahiptir. Antik kentin içinden akan dere yolunu takip ederek yürüyerek güzel Olympos Plajı'na ulaşabilirsiniz.","tahtali":"Tahtalı Dağı Teleferik","tahtali_short":"2.365 metreye yükselip nefes kesen panoramik manzara","tahtali_desc":"2.365 metre yüksekliğiyle bölgenin en yüksek dağlarından biri olan Tahtalı'nın zirvesine teleferikle ulaşılabilir. Avrupa'nın en uzun, dünyanın ikinci en uzun teleferiği unvanını taşır.","cirali":"Çıralı – Yanartaş (Kimera)","cirali_short":"2.500 yıldır yanan sönmeyen ateşler","cirali_desc":"\"Olympos'un Sönmeyen Ateşi\" olarak bilinen bu olağanüstü alan, yerden sızan metan gazıyla doğal olarak yanan kayalara sahiptir. Homeros'un metinlerinde de geçen bu ateşler 2.500 yıldan fazla süredir kesintisiz yanmaktadır.","adrasan":"Adrasan Koyu","adrasan_short":"Berrak sığ sular, ince kum plaj","adrasan_desc":"Bölgenin en popüler plajlarından biri olan Adrasan Koyu, Kemer'e yaklaşık bir saat mesafededir. 4.000 yıllık tarihiyle portakal ve çam ağaçlarıyla çevrili koyu, sığ, taşsız, ince kumlu plajıyla öne çıkar.","paris2":"Paris II Batığı","paris2_short":"Dünyanın en iyi 100 dalış noktasından biri","paris2_desc":"Dünyanın en dikkat çekici 100 dalış noktası arasında yer alan Paris II, I. Dünya Savaşı sırasında Kemer sularında batan bir Fransız gemisidir. 33 metre derinlikte yatan batık, dünya çapındaki dalış meraklıları için büyüleyici bir su altı müzesidir.","alacasu":"Alacasu Cennet Koyu","alacasu_short":"Turkuaz sularla gizli cennet","alacasu_desc":"Kemer'in gizli kalmış güzelliklerinden biri olan bu koy, merkezden yaklaşık 90 dakika uzaklıktadır. 175 metrelik plajı, trekking parkurları ve kristal mavisi yüzme sularıyla şehir kaoasundan kaçmak isteyenler için ideal bir kaçamaktır.","beldibi":"Beldibi Mağarası","beldibi_short":"Bin yıllık tarih öncesi mağara sanatı","beldibi_desc":"Kemer'e yaklaşık 20 kilometre mesafede bulunan bu mağara, denizin kayalıklarla buluştuğu noktada yer alır. Duvarlarında dağ keçisi, geyik ve insan figürleri bulunmaktadır. Neolitik, Paleolitik ve Mezolitik dönemlere ait eserler keşfedilmiştir.","idyros":"Idyros Antik Kenti","idyros_short":"Kemer merkezinde Bizans dönemi geometrik mozaikler","idyros_desc":"1976 yılındaki kazılarda ortaya çıkarılan bu antik kent, Bizans dönemine ait eserlere sahiptir. En dikkat çekici buluntu, dönemin sanatsal ustalığını sergileyen geometrik desenli mozaik zemindir. Kemer'in tam merkezindeki konumuyla kolayca ziyaret edilebilir."},"featured_reviews":{"review1_text":"We recently spent a week at this apartment, and our experience was nothing short of delightful. The apartment was modern, stylish and comfortable, with a fully functional kitchen including stove, oven and dishwasher. The Wi-Fi was reliable and fast. Just an 8-minute walk from Migros and Bim shops. A special mention goes to Meltem, who truly made our stay exceptional — incredibly responsive and kind. Highly recommend!","review1_author":"Roman","review1_meta":"🇷🇸 Sırbistan · Ağustos 2024","review2_text":"Ruhige Gegend und alles Neubau. Küchengeräte alles Neue, wir haben das Gefühl gehabt das wir dieses Apartment als erste nutzen. Pool Neu und Top sauber. Das war unser bester Unterkunft seit 15 Jahren, und wir machen jährlich Urlaub. Können wir nur empfehlen :-)","review2_author":"Dudojc","review2_meta":"🇩🇪 Almanya · Ağustos 2024","verified_badge":"✓ Booking.com'da Doğrulanmış","see_all_link":"Booking.com'da tüm yorumları gör"},"comparison":{"cta":"WhatsApp ile Doğrudan Rezervasyon"}},
  "de": {"meta":{"title":"Ferienwohnung mit Pool in Kemer Göynük, Antalya | Palmiye Home — Direkt buchen","description":"Voll ausgestattete 1+1 Ferienwohnung mit Gemeinschaftspool, Bergblick und kostenlosem Parkplatz in Kemer-Göynük, Antalya. 9,4 auf Booking.com. Direkt buchen via WhatsApp für Verfügbarkeit.","og_title":"Palmiye Home — Ferienwohnung mit Pool in Kemer, Antalya","og_description":"Komplett ausgestattete 1+1 Ferienwohnung mit Pool im Herzen von Göynük. 9,4 auf Booking.com. Direktbuchung über WhatsApp für Verfügbarkeit.","keywords":"ferienwohnung kemer, pool ferienwohnung antalya, göynük urlaub, kemer mieten, türkei ferienwohnung, palmiye home, antalya apartment"},"nav":{"apartment":"Apartment","gallery":"Galerie","location":"Lage","trust":"Bewertungen","booking":"Buchen","contact":"Kontakt","whatsapp":"WhatsApp","attractions":"Sehenswürdigkeiten","availability":"Verfügbarkeit"},"hero":{"trust_pill":"9,4 auf Booking.com","title":"Erwachen Sie in Stille – <span>Ihr Rückzugsort mit Bergblick und Pool</span>","subtitle":"Kemer Göynük · Voll ausgestattete Ferienwohnung · Pool · Antalya","bullet1":"Gemeinschaftspool & Garten","bullet2":"Kostenloses WLAN & Parken","bullet3":"Direktbuchung","cta_whatsapp":"Verfügbarkeit auf WhatsApp prüfen","cta_booking":"Auf Booking.com ansehen","cta_airbnb":"Auf Airbnb ansehen"},"calendar":{"title":"Verfügbarkeitskalender","subtitle":"Prüfen Sie verfügbare Termine und planen Sie Ihren Aufenthalt. Grüne Daten sind verfügbar!","available":"Verfügbar","booked":"Gebucht","past":"Vergangen","cta_text":"Ihre Daten gefunden? Buchen Sie direkt bei uns!","cta_btn":"Über WhatsApp buchen","whatsapp_message":"Hallo! Ich möchte Palmiye Home vom {start} bis {end} buchen. Ist es verfügbar?"},"trust":{"pool":"Gemeinschaftspool","pool_desc":"Erwachsenen- & Kinderpool","capacity":"Bis zu 4 Gäste","capacity_desc":"Komfortabler Aufenthalt","wifi":"Highspeed-WLAN","wifi_desc":"Glasfaser-Internet","location":"Göynük Zentrum","location_desc":"Zentrale Lage","direct":"Direkter Kontakt","direct_desc":"WhatsApp"},"booking_trust":{"title":"9,4 auf Booking.com","desc":"Mit 9,4 auf Booking.com bewertet. Gäste schätzen besonders die Sauberkeit, ruhige Atmosphäre, den Poolbereich und die schnelle Kommunikation.","h1":"Verifiziertes Objekt","h2":"Sichere Zahlung","h3":"Echte Gästebewertungen","cta":"Verfügbarkeit auf Booking.com prüfen"},"cp1":{"title":"Direkt buchen","subtitle":"Schreiben Sie uns auf WhatsApp für Verfügbarkeit.","cta":"Verfügbarkeit auf WhatsApp prüfen"},"apartment":{"title":"Unser Apartment","desc":"Zentrumsnah, ruhig, mitten in der Natur — ein voll ausgestattetes 1+1 Apartment. Jedes Detail für Ihren Komfort gestaltet.","capacity":"Max. 4 Gäste","checkin":"Check-in: 14:00–23:00","checkout":"Check-out: 11:00"},"feature":{"ac":"Klimaanlage","wifi":"Highspeed-WLAN","tv":"Smart TV (Netflix)","kitchen":"Ausgestattete Küche","laundry":"Waschmaschine","hairdryer":"Haartrockner","baby":"Kinderbett & Hochstuhl","parking":"Kostenloser Parkplatz","security":"Sicherheitskameras im Außenbereich (Eingang &amp; Gemeinschaftsflächen)"},"cp2":{"title":"Gefällt es Ihnen?","subtitle":"Kontaktieren Sie uns für Verfügbarkeit und Reservierungen.","cta":"Verfügbarkeit auf WhatsApp prüfen"},"gallery":{"title":"Galerie","subtitle":"Entdecken Sie unser Apartment und die Umgebung mit echten Fotos.","all":"Alle","pool":"Pool","garden":"Garten","living":"Wohnzimmer","bedroom":"Schlafzimmer","kitchen":"Küche / Bad","property":"Anlage"},"cp3":{"title":"Bereit zu buchen?","subtitle":"Kontaktieren Sie uns für Verfügbarkeit und Reservierungen.","cta":"Nachricht auf WhatsApp"},"location":{"title":"Lage","subtitle":"Zentrumsnah, ruhig, im Herzen der Natur.","center":"Göynük Zentrum","center_desc":"Geschäfte und Märkte in Gehweite","beach":"Strand","beach_desc":"~15-20 Min. zu Fuß (~2 km)","canyon":"Göynük Canyon","canyon_desc":"~5 Min. mit dem Auto","kemer":"Kemer Zentrum","kemer_desc":"~10 Min. mit dem Auto","airport":"Flughafen Antalya","airport_desc":"~50 Min. mit dem Auto"},"faq":{"title":"Häufig gestellte Fragen","q1":"Wie sind die Check-in und Check-out Zeiten?","a1":"Check-in von 14:00 bis 23:00 Uhr, Check-out bis spätestens 11:00 Uhr.","q2":"Wann ist der Pool geöffnet?","a2":"Die Anlage verfügt über einen saisonalen Gemeinschaftspool mit Erwachsenen- und Kinderbecken.","q3":"Gibt es einen Parkplatz?","a3":"Ja, kostenloser Freiluftparkplatz auf dem Gelände.","q4":"Gibt es ein Kinderbett oder einen Hochstuhl?","a4":"Ja, kostenlos auf Anfrage verfügbar.","q6":"Wie komme ich zum Strand?","a6":"~15-20 Min. zu Fuß (~2 km). Kemer Strand ~10 Min. mit dem Auto.","q8":"Gibt es einen Flughafentransfer?","a8":"Kann auf Anfrage organisiert werden. Kontaktieren Sie uns über WhatsApp."},"booking":{"title":"Jetzt buchen","subtitle":"Wählen Sie den besten Weg für Sie.","wa_title":"Nachricht auf WhatsApp","wa_desc":"Direkt buchen","booking_title":"Auf Booking.com ansehen","booking_desc":"Sichere Zahlung","airbnb_title":"Auch auf Airbnb","airbnb_desc":"Bewertungen und sichere Zahlung"},"contact":{"title":"Kontakt","email":"E-Mail","address":"Adresse","address_text":"Göynük Mah. 3270. Sok. B Blok No:1, Kemer / Antalya, Türkei","wa_btn":"Nachricht auf WhatsApp"},"footer":{"desc":"Ein ruhiges und komfortables Unterkunftserlebnis im Herzen der Natur, in Kemer – Göynük.","quick_links":"Schnelllinks","platforms":"Buchen bei","rights":"Alle Rechte vorbehalten.","privacy":"Datenschutz","terms":"Nutzungsbedingungen"},"reviews":{"title":"Was unsere Gäste sagen","subtitle":"⭐ 9,4 auf Booking.com"},"attractions":{"title":"Sehenswürdigkeiten","subtitle":"Entdecken Sie die Natur- und Geschichtsschönheiten nur wenige Minuten von Palmiye Home entfernt.","read_more":"Tippen für Details →","show_more":"Mehr Orte anzeigen","show_less":"Weniger anzeigen","canyon":"Göynük-Schlucht","canyon_short":"Naturwunder mit Wasserfällen und Kiefernwäldern","canyon_desc":"Eine der beliebtesten Naturattraktionen von Kemer, die Göynük-Schlucht liegt am Lykischen Weg im Beydağları Küsten-Nationalpark. Mit atemberaubender Landschaft, reicher Vegetation und Wasserfällen. Gilt als eine der 10 besten Trekkingr outen der Welt.","phaselis":"Antike Stadt Phaselis","phaselis_short":"Antike Hafenstadt, in der Sie zwischen Ruinen schwimmen","phaselis_desc":"Im 7. Jahrhundert v. Chr. von Rhodiern gegründet, liegt diese Stadt auf einer Halbinsel im Mittelmeer. Die erhaltenen Ruinen stammen aus römischer und byzantinischer Zeit.","olympos":"Antike Stadt Olympos","olympos_short":"Antike Ruinen, Waldwege und ein atemberaubender Strand","olympos_desc":"Eine weitere berühmte Hafenstadt nach Phaselis, mit Ruinen aus römischer, byzantinischer und hellenistischer Zeit. Folgen Sie dem Bachweg durch die antike Stadt zum wunderschönen Olympos-Strand.","tahtali":"Tahtalı-Seilbahn","tahtali_short":"Fahrt auf 2.365 m mit atemberaubendem Panoramablick","tahtali_desc":"Mit 2.365 Metern einer der höchsten Berge der Region. Der Gipfel ist per Seilbahn erreichbar — die längste Europas und zweitlängste der Welt.","cirali":"Çıralı – Yanartaş (Chimäre)","cirali_short":"Ewige Flammen, die seit 2.500 Jahren brennen","cirali_desc":"Bekannt als 'Ewige Flamme von Olympos', brennen hier natürlich Felsen, gespeist von Methangas aus der Erde. Diese Feuer brennen seit über 2.500 Jahren ununterbrochen.","adrasan":"Bucht von Adrasan","adrasan_short":"Kristallklares seichtes Wasser, feiner Sandstrand","adrasan_desc":"Einer der beliebtesten Strände der Region, etwa eine Stunde von Kemer. Mit 4.000 Jahren Geschichte, umgeben von Orangen- und Kiefernbäumen, zeichnet sich die Bucht durch ihren flachen, steinfreien Feinsandstrand aus.","paris2":"Schiffswrack Paris II","paris2_short":"Einer der Top 100 Tauchplätze der Welt","paris2_desc":"Unter den 100 bemerkenswertesten Tauchplätzen der Welt gelistet. Paris II ist ein französisches Schiff, das im Ersten Weltkrieg vor Kemer sank. In 33 Metern Tiefe beherbergt das Wrack sechs Flugabwehrkanonen.","alacasu":"Alacasu Paradiesbucht","alacasu_short":"Ein verstecktes Paradies mit türkisfarbenem Wasser","alacasu_desc":"Ein verborgenes Juwel Kemers, etwa 90 Minuten vom Zentrum entfernt. Mit 175 Meter Strand, Wanderwegen und kristallklarem Wasser — ideal für Ruhe und Natur.","beldibi":"Beldibi-Höhle","beldibi_short":"Prähistorische Höhlenkunst aus Jahrtausenden","beldibi_desc":"Etwa 20 Kilometer von Kemer entfernt, dort wo das Meer auf die Felsen trifft. Die Wände zeigen Tier- und Menschenfiguren. Funde aus Neolithikum, Paläolithikum und Mesolithikum.","idyros":"Antike Stadt Idyros","idyros_short":"Byzantinische geometrische Mosaike im Zentrum von Kemer","idyros_desc":"Bei Ausgrabungen 1976 entdeckt, beherbergt diese antike Stadt byzantinische Artefakte. Der bemerkenswerteste Fund ist ein geometrisch gemusterter Mosaikboden. Direkt im Zentrum von Kemer gelegen."},"featured_reviews":{"review1_text":"We recently spent a week at this apartment, and our experience was nothing short of delightful. The apartment was modern, stylish and comfortable, with a fully functional kitchen including stove, oven and dishwasher. The Wi-Fi was reliable and fast. Just an 8-minute walk from Migros and Bim shops. A special mention goes to Meltem, who truly made our stay exceptional — incredibly responsive and kind. Highly recommend!","review1_author":"Roman","review1_meta":"🇷🇸 Serbien · August 2024","review2_text":"Ruhige Gegend und alles Neubau. Küchengeräte alles Neue, wir haben das Gefühl gehabt das wir dieses Apartment als erste nutzen. Pool Neu und Top sauber. Das war unser bester Unterkunft seit 15 Jahren, und wir machen jährlich Urlaub. Können wir nur empfehlen :-)","review2_author":"Dudojc","review2_meta":"🇩🇪 Deutschland · August 2024","verified_badge":"✓ Auf Booking.com verifiziert","see_all_link":"Alle Bewertungen auf Booking.com ansehen"},"comparison":{"cta":"Direkt über WhatsApp buchen"}},
  "ru": {"meta":{"title":"Palmiye Home — апартаменты с бассейном в Кемер Гёйнюк, Анталья","description":"Полностью оборудованная квартира 1+1 с общим бассейном в Кемер Гёйнюк, Анталья. Вид на горы, бесплатный Wi-Fi, парковка. 9.4 на Booking.com. Отправьте даты и количество гостей в WhatsApp.","og_title":"Palmiye Home — апартаменты с бассейном в Кемере, Анталья","og_description":"Полностью оборудованная квартира 1+1 с общим бассейном в Кемер Гёйнюк. 9.4 на Booking.com. Проверьте наличие через WhatsApp, Booking.com или Airbnb.","keywords":"аренда квартир кемер, квартира с бассейном анталья, гёйнюк аренда, кемер отдых, апартаменты турция, palmiye home, кемер жилье"},"nav":{"apartment":"Квартира","gallery":"Галерея","location":"Расположение","trust":"Отзывы","booking":"Бронирование","contact":"Контакты","whatsapp":"WhatsApp","attractions":"Что посетить","availability":"Наличие"},"hero":{"trust_pill":"9.4 на Booking.com","title":"Просыпайтесь в тишине: <span>начните день у бассейна с видом на горы</span>","subtitle":"Кемер Гёйнюк · Полностью оборудованная квартира · Бассейн · Анталья","bullet1":"Общий бассейн и сад","bullet2":"Бесплатный Wi-Fi и парковка","bullet3":"Прямой контакт — быстрый ответ","cta_whatsapp":"Узнать наличие в WhatsApp","cta_booking":"Смотреть на Booking.com"},"calendar":{"title":"Календарь доступности","subtitle":"Проверьте доступные даты и спланируйте отдых. Зелёные даты свободны!","available":"Свободно","booked":"Занято","past":"Прошло","cta_text":"Нашли свои даты? Отправьте их, чтобы проверить наличие.","cta_btn":"Узнать наличие в WhatsApp","whatsapp_message":"Здравствуйте! Хочу забронировать Palmiye Home с {start} по {end}. Свободно?"},"trust":{"pool":"Общий бассейн","pool_desc":"Взрослый и детский","capacity":"До 4 гостей","capacity_desc":"Комфортное проживание","wifi":"Скоростной Wi-Fi","wifi_desc":"Оптоволокно","location":"Центр Гёйнюк","location_desc":"Центральное расположение","direct":"Прямая связь","direct_desc":"WhatsApp"},"booking_trust":{"title":"Оценка 9.4 на Booking.com","desc":"На Booking.com у нас оценка 9.4. Гостям особенно нравятся чистота, спокойная атмосфера, зона бассейна и быстрая связь.","h1":"Проверенный объект","h2":"Безопасная оплата","h3":"Реальные отзывы гостей","cta":"Проверить наличие на Booking.com"},"cp1":{"title":"Проверьте наличие — бронируйте уверенно","subtitle":"Напишите нам даты и количество гостей.","cta":"Узнать наличие в WhatsApp"},"apartment":{"title":"Наша квартира","desc":"Рядом с центром, тихо, на природе — полностью оборудованная квартира 1+1. Всё продумано для комфорта.","capacity":"Макс. 4 гостя","checkin":"Заезд: 14:00–23:00","checkout":"Выезд: 11:00"},"feature":{"ac":"Кондиционер","wifi":"Скоростной Wi-Fi","tv":"Smart TV (Netflix)","kitchen":"Оборудованная кухня","laundry":"Стиральная машина","hairdryer":"Фен","baby":"Кроватка и стульчик","parking":"Бесплатная парковка","security":"Камеры безопасности снаружи (вход и общие зоны)"},"cp2":{"title":"Понравилось?","subtitle":"Свяжитесь с нами, чтобы уточнить наличие и детали бронирования.","cta":"Узнать наличие в WhatsApp"},"gallery":{"title":"Галерея","subtitle":"Познакомьтесь с квартирой и окрестностями на реальных фото.","all":"Все","pool":"Бассейн","garden":"Сад","living":"Гостиная","bedroom":"Спальня","kitchen":"Кухня / Ванная","property":"Территория"},"cp3":{"title":"Готовы забронировать?","subtitle":"Свяжитесь с нами, чтобы уточнить наличие и детали бронирования.","cta":"Написать в WhatsApp"},"location":{"title":"Расположение","subtitle":"Рядом с центром, тихо, в сердце природы.","center":"Центр Гёйнюк","center_desc":"Магазины в пешей доступности","beach":"Пляж","beach_desc":"~15-20 мин пешком (~2 км)","canyon":"Каньон Гёйнюк","canyon_desc":"~5 мин на авто","kemer":"Центр Кемера","kemer_desc":"~10 мин на авто","airport":"Аэропорт Анталии","airport_desc":"~50 мин на авто"},"faq":{"title":"Часто задаваемые вопросы","q1":"Какое время заезда и выезда?","a1":"Заезд с 14:00 до 23:00, выезд до 11:00. Для гибкого времени свяжитесь заранее.","q2":"Когда открыт бассейн?","a2":"На территории есть сезонный общий бассейн: взрослый и детский.","q3":"Есть ли парковка?","a3":"Да, бесплатная открытая парковка на территории.","q4":"Есть ли кроватка или стульчик для детей?","a4":"Да, детская кроватка и стульчик предоставляются бесплатно по запросу.","q6":"Как добраться до пляжа?","a6":"Пляж примерно в 15-20 минутах ходьбы (~2 км). До пляжа Кемера ~10 минут на авто.","q8":"Есть ли трансфер из аэропорта?","a8":"Можно организовать по запросу. Свяжитесь с нами через WhatsApp."},"booking":{"title":"Забронировать","subtitle":"Выберите удобный для вас способ.","wa_title":"Написать в WhatsApp","wa_desc":"Быстрый ответ через WhatsApp","booking_title":"Смотреть на Booking.com","booking_desc":"Безопасная оплата","airbnb_title":"Также на Airbnb","airbnb_desc":"Отзывы и безопасная оплата"},"contact":{"title":"Контакты","email":"Эл. почта","address":"Адрес","address_text":"Göynük Mah. 3270. Sok. B Blok No:1, Кемер / Анталия, Турция","wa_btn":"Написать в WhatsApp"},"footer":{"desc":"Спокойный и комфортный отдых в сердце природы, в Кемер – Гёйнюк.","quick_links":"Быстрые ссылки","platforms":"Забронировать","rights":"Все права защищены.","privacy":"Политика конфиденциальности","terms":"Условия использования"},"reviews":{"title":"Что говорят наши гости","subtitle":"⭐ 9.4 на Booking.com"},"attractions":{"title":"Что посетить рядом","subtitle":"Откройте для себя самые красивые природные и исторические места рядом с Palmiye Home.","read_more":"Нажмите для подробностей →","show_more":"Показать больше мест","show_less":"Показать меньше","canyon":"Каньон Гёйнюк","canyon_short":"Природное чудо с водопадами и сосновыми лесами","canyon_desc":"Одна из самых популярных природных достопримечательностей Кемера, каньон Гёйнюк расположен на Ликийской тропе в Национальном парке Бейдаглары. Здесь вы найдёте живописные пейзажи, богатую растительность и водопады. В каньоне есть искусственные пруды, ручьи и природные бассейны. Входит в десятку лучших треккинговых маршрутов мира.","phaselis":"Античный город Фазелис","phaselis_short":"Античный портовый город, где можно купаться среди руин","phaselis_desc":"Основанный родосцами в VII веке до н.э., город расположен на полуострове, выступающем в Средиземное море. Долгие годы он служил одним из важнейших портов восточного побережья Ликии и имел четыре гавани. Сохранившиеся руины относятся к римскому и византийскому периодам.","olympos":"Античный город Олимпос","olympos_short":"Античные руины, лесные тропы и прекрасный пляж","olympos_desc":"Ещё один известный портовый город после Фазелиса, Олимпос хранит руины римского, византийского и эллинистического периодов. Пройдя по тропе вдоль ручья через античный город, вы пешком дойдёте до прекрасного пляжа Олимпос.","tahtali":"Канатная дорога на Тахталы","tahtali_short":"Подъём на 2365 м с захватывающим панорамным видом","tahtali_desc":"Высотой 2365 метров, Тахталы — одна из самых высоких гор региона. На вершину можно подняться по канатной дороге, которая считается самой длинной в Европе и второй в мире.","cirali":"Чиралы – Янарташ (Химера)","cirali_short":"Вечные огни, горящие более 2500 лет","cirali_desc":"Известное как «Вечный огонь Олимпоса», это удивительное место с естественно горящими скалами, питаемыми метаном из-под земли. Упоминаемые в текстах Гомера, эти огни горят непрерывно более 2500 лет.","adrasan":"Бухта Адрасан","adrasan_short":"Кристально чистые мелкие воды, мелкий песчаный пляж","adrasan_desc":"Один из самых популярных пляжей региона, бухта Адрасан находится примерно в часе езды от Кемера. С 4000-летней историей, это место окружено апельсиновыми и сосновыми деревьями. Главная особенность — мелкий пляж с чистой, спокойной водой.","paris2":"Затонувший корабль Париж II","paris2_short":"Одно из 100 лучших мест для дайвинга в мире","paris2_desc":"Входящий в список 100 самых замечательных мест для дайвинга в мире, Париж II — французский корабль, затонувший в водах Кемера во время Первой мировой войны. На глубине 33 метров затонувший корабль хранит шесть зенитных орудий и две торпедные установки.","alacasu":"Бухта Алакасу (Райская бухта)","alacasu_short":"Скрытый рай с бирюзовыми водами","alacasu_desc":"Считающаяся одной из скрытых жемчужин Кемера, эта бухта находится примерно в 90 минутах от центра. С 175-метровым пляжем, тропами для треккинга и кристально чистыми водами — идеальное место для уединения.","beldibi":"Пещера Бельдиби","beldibi_short":"Доисторическое наскальное искусство возрастом тысячи лет","beldibi_desc":"Расположенная примерно в 20 км от Кемера, эта пещера находится на стыке моря и скал. На стенах — фигуры горных козлов, оленей и людей. Обнаружены артефакты неолита, палеолита и мезолита.","idyros":"Античный город Идирос","idyros_short":"Византийские геометрические мозаики в центре Кемера","idyros_desc":"Обнаруженный при раскопках 1976 года, этот античный город хранит артефакты византийского периода. Самая примечательная находка — мозаичный пол с геометрическим узором. Расположен прямо в центре Кемера."},"featured_reviews":{"review1_text":"We recently spent a week at this apartment, and our experience was nothing short of delightful. The apartment was modern, stylish and comfortable, with a fully functional kitchen including stove, oven and dishwasher. The Wi-Fi was reliable and fast. Just an 8-minute walk from Migros and Bim shops. A special mention goes to Meltem, who truly made our stay exceptional — incredibly responsive and kind. Highly recommend!","review1_author":"Roman","review1_meta":"🇷🇸 Сербия · Август 2024","review2_text":"Ruhige Gegend und alles Neubau. Küchengeräte alles Neue, wir haben das Gefühl gehabt das wir dieses Apartment als erste nutzen. Pool Neu und Top sauber. Das war unser bester Unterkunft seit 15 Jahren, und wir machen jährlich Urlaub. Können wir nur empfehlen :-)","review2_author":"Dudojc","review2_meta":"🇩🇪 Германия · Август 2024","verified_badge":"✓ Проверено на Booking.com","see_all_link":"Все отзывы на Booking.com"},"comparison":{"title":"Каналы бронирования","subtitle":"Выберите удобный канал и подтвердите наличие на ваши даты.","channel_label":"Канал","detail_label":"Что ожидать","action_label":"Действие","whatsapp_channel":"WhatsApp","whatsapp_detail":"Быстрый ответ от хозяина","whatsapp_action":"Отправьте даты и количество гостей","booking_channel":"Booking.com","booking_detail":"Проверенное объявление и отзывы гостей","booking_action":"Посмотреть детали объявления","airbnb_channel":"Airbnb","airbnb_detail":"Дополнительный вариант платформы","airbnb_action":"Посмотреть детали объявления","cta":"Узнать наличие в WhatsApp"},"trust_badges":{"fast_response":"Быстрый ответ в WhatsApp","verified_channels":"Проверенные каналы бронирования"},"reservation":{"title":"Варианты бронирования","subtitle":"Проверьте наличие и выберите удобный канал бронирования.","option_whatsapp":"WhatsApp для быстрого ответа по наличию","option_booking":"Объявление Booking.com с проверенными отзывами гостей","option_airbnb":"Airbnb как дополнительный надежный канал","cta_wa":"Узнать наличие в WhatsApp","cta_booking":"Смотреть на Booking.com","cta_airbnb":"Смотреть на Airbnb","footer":"Наличие и детали бронирования подтверждаются через выбранный вами канал."}}
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

  // Load English once so an untranslated key never keeps the previously
  // selected language's text after switching languages.
  if (lang !== 'en' && !fallbackTranslations) {
    try {
      const resEn = await fetch('lang/en.json');
      if (!resEn.ok) throw new Error('File not found');
      fallbackTranslations = await resEn.json();
    } catch (e) {
      fallbackTranslations = INLINE_LANGS.en || {};
    }
  }

  // Store the language before translating: applyTranslations() re-renders the
  // calendar, which reads palmiye_lang for month and weekday names.
  document.documentElement.lang = lang;
  localStorage.setItem('palmiye_lang', lang);
  applyTranslations();

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
  // ─ Meta tags (SEO — dil başına title/description/og) ─
  // lang JSON'da meta bölümü varsa document head'deki ilgili etiketleri güncelle
  applyMetaTranslations();

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = getNestedValue(translations, key) || getNestedValue(fallbackTranslations || {}, key);
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

// ────────────────────────────────────────────────────────────
//  Meta Tag Güncelleme (SEO multi-language)
//  lang JSON'daki `meta` bölümünden title/description/og/twitter
//  etiketlerini runtime'da günceller. Defensive — meta bloku
//  yoksa hiçbir şey yapmaz (çalışan kodu bozmaz).
// ────────────────────────────────────────────────────────────
function applyMetaTranslations() {
  if (!translations || !translations.meta) return;
  const m = translations.meta;

  const setAttr = (selector, attr, value) => {
    if (!value) return;
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };

  if (m.title) document.title = m.title;
  setAttr('meta[name="description"]',      'content', m.description);
  setAttr('meta[name="keywords"]',         'content', m.keywords);
  setAttr('meta[property="og:title"]',     'content', m.og_title || m.title);
  setAttr('meta[property="og:description"]', 'content', m.og_description || m.description);
  setAttr('meta[name="twitter:title"]',    'content', m.og_title || m.title);
  setAttr('meta[name="twitter:description"]', 'content', m.og_description || m.description);
}

function initI18n() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      loadLanguage(btn.dataset.lang);
    });
  });

  // URL ?lang= parameter support (SEO hreflang compliance)
  const urlLang = new URLSearchParams(window.location.search).get('lang');
  const validLangs = ['en', 'tr', 'ru', 'de'];
  const saved = (urlLang && validLangs.includes(urlLang)) ? urlLang : getCurrentLang();
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

      // SSOT: pull message template from lang file, fill placeholders
      const template = getNestedValue(translations, 'calendar.whatsapp_message')
        || `Hello! I'd like to book Palmiye Home from {start} to {end}. Is it available?`;
      const msgText = template
        .replace('{start}', formatDisplay(start))
        .replace('{end}', formatDisplay(end));
      const msg = encodeURIComponent(msgText);

      // iOS Safari fallback
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      waLink.href = isIOS
        ? `https://api.whatsapp.com/send?phone=905327786732&text=${msg}`
        : `https://wa.me/905327786732?text=${msg}`;

      // GA4: select_dates event
      if (typeof window.trackEvent === 'function') {
        window.trackEvent('select_dates', {
          event_category: 'engagement',
          checkin: start,
          checkout: end
        });
      }

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

/* ---- COOKIE NOTICE ---- */
function initCookieNotice() {
  const notice = document.getElementById('cookie-notice');
  if (!notice) return;

  // Check if user already made a choice
  const consent = localStorage.getItem('palmiye_cookies');
  if (consent === 'accepted' || consent === 'declined') {
    notice.remove();
    return;
  }

  // Show the notice
  setTimeout(() => notice.classList.add('visible'), 1000);

  const acceptBtn = notice.querySelector('.cookie-accept');
  const declineBtn = notice.querySelector('.cookie-decline');

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('palmiye_cookies', 'accepted');
      // GA4'ü anında başlat
      if (typeof window.initGA === 'function') window.initGA();
      // Google Consent Mode v2 — Ads + Analytics için izin ver
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          'ad_storage': 'granted',
          'ad_user_data': 'granted',
          'ad_personalization': 'granted',
          'analytics_storage': 'granted'
        });
      }
      notice.classList.remove('visible');
      setTimeout(() => notice.remove(), 400);
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener('click', () => {
      localStorage.setItem('palmiye_cookies', 'declined');
      // Consent Mode v2 — default 'denied' zaten aktif; yine de açıkça bildir
      if (typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          'ad_storage': 'denied',
          'ad_user_data': 'denied',
          'ad_personalization': 'denied',
          'analytics_storage': 'denied'
        });
      }
      notice.classList.remove('visible');
      setTimeout(() => notice.remove(), 400);
    });
  }
}

// ===== TELEGRAM VISITOR NOTIFICATION =====
function notifyVisitor() {
  // Aynı oturumda tekrar bildirim gönderme (sayfa içi gezinmede)
  if (sessionStorage.getItem('palmiye_notified')) return;
  sessionStorage.setItem('palmiye_notified', 'true');

  // Bot/crawler kontrolü — bildirim gönderme
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider') || ua.includes('lighthouse')) return;

  // Bildirim verisini hazırla — yalnızca kaba, kişisel olmayan bilgiler:
  // dil kodu, cihaz sınıfı, sayfa yolu ve yönlendiren alan adı.
  // Ekran çözünürlüğü ve istemci saati gönderilmez (sunucu kendi saatini kullanır).
  let referrerHost = '';
  try { referrerHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch (_) {}
  const width = screen.width || 0;
  const data = {
    language: new URLSearchParams(location.search).get('lang') || getCurrentLang(),
    device: width && width <= 480 ? 'mobile' : (width && width <= 1024 ? 'tablet' : 'desktop'),
    page: location.pathname,
    referrer: referrerHost
  };

  // GoDaddy PHP endpoint'e gönder (fire-and-forget, hata olursa sessizce geç)
  fetch('/api/telegram-notify.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(() => {});
}

