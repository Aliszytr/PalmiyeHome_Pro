import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore("bookings");
  let data;

  try {
    data = await store.get("calendar", { type: "json" });
  } catch (e) {
    // silent
  }

  const raw = data || {};

  const result = {
    bookedRanges: Array.isArray(raw.bookedRanges) ? raw.bookedRanges : [],
    lastUpdated: raw.lastUpdated || null,
  };

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
};
