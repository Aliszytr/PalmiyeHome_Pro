// Palmiye Home — Booking Data Source (GoDaddy Static Version)
// Booking data is loaded from data/bookings.js via script tag.
// Ali edits data/bookings.js directly via cPanel File Manager or FTP.
// No API dependency — pure static file.
(function () {
  'use strict';
  if (window.PALMIYE_BOOKINGS) {
    console.log('[Palmiye] Bookings loaded from static data.');
  } else {
    console.warn('[Palmiye] No booking data found. Ensure data/bookings.js is loaded.');
  }
})();
