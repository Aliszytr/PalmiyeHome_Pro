// Palmiye Home — Booking Data Source
// file:// → window.PALMIYE_BOOKINGS fallback (from data/bookings.js)
// http(s):// → fetch /api/bookings with retry
(async function () {
  if (window.location.protocol === "file:") {
    // Local dev — data/bookings.js script tag handles this
    return;
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("/api/bookings", {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid response format");
      }

      window.PALMIYE_BOOKINGS = {
        lastUpdated: data.lastUpdated || null,
        season: data.season || null,
        bookings: data.bookedRanges || data.bookings || [],
      };

      console.log("[Palmiye] Bookings loaded via API (attempt " + attempt + ")");
      return;
    } catch (e) {
      console.warn("[Palmiye] API fetch attempt " + attempt + " failed:", e.message);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * attempt));
      }
    }
  }

  // All retries failed — fallback to script tag data if available
  console.warn("[Palmiye] All API attempts failed. Using fallback data if available.");
})();
