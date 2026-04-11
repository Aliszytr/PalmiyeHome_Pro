/**
 * Palmiye Home — GA4 Analytics Module
 * ====================================
 * USAGE: Replace 'G-XXXXXXXXXX' with your real GA4 Measurement ID.
 * Then add to index.html:
 *   <script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
 *   <script src="analytics.js"></script>
 * 
 * Cookie Consent: Analytics only fires if user accepted cookies.
 */

(function () {
  'use strict';

  const GA_ID = 'G-XXXXXXXXXX'; // ← REPLACE with your real GA4 Measurement ID

  // Check if user accepted cookies
  function hasConsent() {
    return localStorage.getItem('palmiye_cookies') === 'accepted';
  }

  // Initialize GA4
  function initGA() {
    if (!hasConsent()) return;
    if (GA_ID === 'G-XXXXXXXXXX') return; // Not configured yet

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID, {
      anonymize_ip: true,
      cookie_flags: 'SameSite=None;Secure'
    });
  }

  // Track custom events
  function trackEvent(eventName, params) {
    if (!hasConsent() || !window.gtag) return;
    window.gtag('event', eventName, params);
  }

  // ── Event Listeners ──

  function setupTracking() {
    if (!hasConsent() || !window.gtag) return;

    // WhatsApp clicks
    document.querySelectorAll('a[href*="wa.me"]').forEach(function (link) {
      link.addEventListener('click', function () {
        trackEvent('whatsapp_click', {
          event_category: 'engagement',
          event_label: link.closest('section')?.id || 'unknown'
        });
      });
    });

    // Booking.com clicks
    document.querySelectorAll('a[href*="booking.com"]').forEach(function (link) {
      link.addEventListener('click', function () {
        trackEvent('booking_click', {
          event_category: 'engagement',
          event_label: 'booking_com'
        });
      });
    });

    // Airbnb clicks
    document.querySelectorAll('a[href*="airbnb"]').forEach(function (link) {
      link.addEventListener('click', function () {
        trackEvent('airbnb_click', {
          event_category: 'engagement',
          event_label: 'airbnb'
        });
      });
    });

    // Language switch
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        trackEvent('language_change', {
          event_category: 'navigation',
          event_label: btn.dataset.lang || btn.textContent.trim()
        });
      });
    });

    // Gallery lightbox opens
    document.querySelectorAll('.gallery-item').forEach(function (item) {
      item.addEventListener('click', function () {
        var img = item.querySelector('img');
        trackEvent('gallery_view', {
          event_category: 'engagement',
          event_label: img ? img.alt : 'unknown'
        });
      });
    });

    // Scroll depth tracking
    var scrollMilestones = [25, 50, 75, 100];
    var scrollFired = {};

    window.addEventListener('scroll', function () {
      var scrollPercent = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      scrollMilestones.forEach(function (milestone) {
        if (scrollPercent >= milestone && !scrollFired[milestone]) {
          scrollFired[milestone] = true;
          trackEvent('scroll_depth', {
            event_category: 'engagement',
            event_label: milestone + '%'
          });
        }
      });
    }, { passive: true });
  }

  // ── Initialize ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initGA();
      setupTracking();
    });
  } else {
    initGA();
    setupTracking();
  }
})();
