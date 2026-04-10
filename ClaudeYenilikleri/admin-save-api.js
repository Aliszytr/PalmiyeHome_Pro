// =============================================
//  Palmiye Home — Admin Save API
//  POST /api/admin/save
//  Protected endpoint — requires Netlify Identity JWT
// =============================================

const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  // ── Authentication ──
  // Netlify Identity provides user context automatically
  const { user } = context.clientContext || {};
  if (!user) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Unauthorized — login required' })
    };
  }

  // ── Origin check (basic CSRF protection) ──
  const origin = event.headers.origin || event.headers.referer || '';
  const allowedOrigins = [
    'https://palmiyehome.com',
    'https://www.palmiyehome.com',
    'http://localhost'
  ];
  const isAllowed = allowedOrigins.some(o => origin.startsWith(o)) || origin === '';
  if (!isAllowed) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Forbidden — invalid origin' })
    };
  }

  try {
    // ── Parse body ──
    const data = JSON.parse(event.body);

    // ── Validate structure ──
    if (!data.bookedRanges || !Array.isArray(data.bookedRanges)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing or invalid bookedRanges array' })
      };
    }

    // ── Validate each booking ──
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (let i = 0; i < data.bookedRanges.length; i++) {
      const b = data.bookedRanges[i];
      if (!b.from || !b.to) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Booking #${i + 1}: missing from/to dates` })
        };
      }
      if (!dateRegex.test(b.from) || !dateRegex.test(b.to)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Booking #${i + 1}: invalid date format (use YYYY-MM-DD)` })
        };
      }
      if (b.from > b.to) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Booking #${i + 1}: 'from' date is after 'to' date` })
        };
      }
    }

    // ── Sort by from date ──
    data.bookedRanges.sort((a, b) => a.from.localeCompare(b.from));

    // ── Add metadata ──
    data.lastUpdated = new Date().toISOString().split('T')[0];

    // ── Write to file ──
    // Note: In Netlify Functions, file writes are ephemeral (lost on redeploy)
    // For persistent storage, use Netlify Blobs, a database, or Git-based approach
    const dataPath = path.join(__dirname, '..', '..', 'data', 'bookings.json');
    const dataDir = path.dirname(dataPath);

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');

    console.log(`[admin/save] ${user.email} saved ${data.bookedRanges.length} bookings`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        saved: data.bookedRanges.length,
        lastUpdated: data.lastUpdated
      })
    };
  } catch (error) {
    console.error('[admin/save] Error:', error);

    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid JSON in request body' })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
