import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";

// ── VALIDATION ──
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

function isValidRange(x) {
  return (
    x &&
    typeof x.from === "string" &&
    typeof x.to === "string" &&
    dateRegex.test(x.from) &&
    dateRegex.test(x.to) &&
    x.from <= x.to
  );
}

// ── HANDLER ──
export default async (req, context) => {
  // Auth check — official Netlify Identity server-side verification
  const user = await getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse body
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate structure
  if (!body.bookedRanges || !Array.isArray(body.bookedRanges)) {
    return new Response(JSON.stringify({ error: "Invalid data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate every range
  if (!body.bookedRanges.every(isValidRange)) {
    return new Response(JSON.stringify({ error: "Invalid booking format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Write to Blob
  const store = getStore("bookings");
  const data = {
    bookedRanges: body.bookedRanges,
    lastUpdated: new Date().toISOString(),
    updatedBy: user.email,
  };

  await store.setJSON("calendar", data);

  return new Response(JSON.stringify({ ok: true, saved: data.bookedRanges.length }), {
    headers: { "Content-Type": "application/json" },
  });
};
