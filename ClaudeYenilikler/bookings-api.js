// =============================================
//  Palmiye Home — Bookings API (Read)
//  GET /api/bookings
//  Public endpoint — returns booking data
// =============================================

const fs = require('fs');
const path = require('path');

exports.handler = async (event, context) => {
  // Only allow GET
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'public, max-age=300' // 5 min cache
  };

  try {
    // Read from data/bookings.json in the site root
    // In Netlify, the site root is available via process.env
    const dataPath = path.join(__dirname, '..', '..', 'data', 'bookings.json');

    if (!fs.existsSync(dataPath)) {
      // Return empty bookings if file doesn't exist
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          lastUpdated: null,
          season: { start: "2026-06-01", end: "2026-10-16" },
          bookedRanges: []
        })
      };
    }

    const data = fs.readFileSync(dataPath, 'utf8');
    const parsed = JSON.parse(data);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(parsed)
    };
  } catch (error) {
    console.error('[bookings] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
