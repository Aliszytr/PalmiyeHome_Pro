import { getStore } from "@netlify/blobs";

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

// ── AUTH HELPER ──
function getUserFromRequest(req, context) {
  // 1) Try Netlify's automatic clientContext (v1 compat)
  const ctxUser = (context?.clientContext || {}).user;
  if (ctxUser) return ctxUser;

  // 2) Fallback: decode JWT from Authorization header
  const auth = req.headers.get("authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;

  try {
    const token = auth.split(" ")[1];
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → Base64 → JSON
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (!payload.sub && !payload.email) return null;
    return { email: payload.email || payload.sub };
  } catch (e) {
    return null;
  }
}

// ── HANDLER ──
export default async (req, context) => {
  const user = getUserFromRequest(req, context);

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
