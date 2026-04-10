// Palmiye Home — Booking Data Source
// file:// → window.PALMIYE_BOOKINGS fallback
// http(s):// → fetch /api/bookings
(async function () {
  if (window.location.protocol === "file:") {
    // Local dev — data/bookings.js script tag handles this
    return;
  }

  try {
    const res = await fetch("/api/bookings");
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    window.PALMIYE_BOOKINGS = {
      lastUpdated: data.lastUpdated || null,
      bookings: data.bookedRanges || [],
    };
  } catch (e) {
    // Silent — fallback to script tag data if any
  }
})();
