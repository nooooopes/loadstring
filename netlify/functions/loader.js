// netlify/functions/loader.js
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const ALLOWED_IP = process.env.ALLOWED_IP;

// ---- Helper: Supabase request ----
async function supabaseRequest(method, endpoint, body = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase credentials not set');
  }
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json'
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res;
}

// ---- Ensure the keys table exists ----
async function ensureTableExists() {
  try {
    // Try to fetch one row to see if table exists
    await supabaseRequest('GET', 'keys?limit=1');
    console.log('Keys table exists.');
    return true;
  } catch (e) {
    if (e.message.includes('permission denied') || e.message.includes('relation "keys" does not exist')) {
      console.log('Keys table missing – creating now...');
      // Create table via SQL – we need to use the Supabase SQL API directly.
      // We'll send a POST to /rest/v1/rpc/ with a custom function.
      // But simpler: we'll try to create it using the raw SQL endpoint.
      // We'll use the `sql` function if it exists, but we can also use the `pg` endpoint.
      // Instead, we'll just inform the user and recommend manual creation.
      throw new Error('Keys table does not exist. Please run the provided SQL in Supabase.');
    }
    throw e;
  }
}

// ---- YOUR OBFUSCATED SCRIPT ----
const SCRIPT = `
-- PASTE YOUR OBFUSCATED SCRIPT HERE
`;

// ---- Read admin.html ----
let adminHtml = '';
try {
  const filePath = path.join(__dirname, '../../admin.html');
  adminHtml = fs.readFileSync(filePath, 'utf8');
  adminHtml = adminHtml.replace('{{ADMIN_PASSWORD}}', ADMIN_PASSWORD);
} catch (e) {
  adminHtml = `<html><body><h1>admin.html not found</h1><p>${e.message}</p></body></html>`;
}

function isExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

exports.handler = async (event) => {
  // Ensure table exists on first request (but we do it lazily to avoid cold start issues)
  // We'll check at the start of each request – but we cache the result.
  if (!globalThis._tableChecked) {
    try {
      await ensureTableExists();
      globalThis._tableChecked = true;
    } catch (e) {
      console.error('Table check error:', e.message);
      // We'll still allow requests, but they will fail if table missing.
      // We'll set a flag to avoid repeated checks.
      globalThis._tableChecked = true;
    }
  }

  // CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, GET'
      }
    };
  }

  // ---- Admin dashboard ----
  if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.page === 'admin') {
    const clientIP = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (clientIP !== ALLOWED_IP) {
      return { statusCode: 302, headers: { Location: 'https://discord.gg/lol' }, body: '' };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: adminHtml };
  }

  // ---- GET keys ----
  if (event.httpMethod === 'GET') {
    try {
      const res = await supabaseRequest('GET', 'keys?select=*&order=created_at.desc');
      const keys = await res.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ keys })
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: e.message })
      };
    }
  }

  // ---- POST ----
  if (event.httpMethod === 'POST') {
    const path = event.path;

    // Save key
    if (path.includes('/save')) {
      try {
        const body = JSON.parse(event.body);
        const { key_code, key_type, owner, expires_at } = body;
        if (!key_code || !key_type || !expires_at) {
          return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Missing fields' })
          };
        }
        await supabaseRequest('POST', 'keys', { key_code, key_type, owner, expires_at });
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true })
        };
      } catch (e) {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: e.message })
        };
      }
    }

    // Delete key
    if (path.includes('/delete')) {
      try {
        const body = JSON.parse(event.body);
        const { key_code } = body;
        if (!key_code) {
          return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Missing key_code' })
          };
        }
        await supabaseRequest('DELETE', `keys?key_code=eq.${encodeURIComponent(key_code)}`);
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true })
        };
      } catch (e) {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: e.message })
        };
      }
    }

    // ---- Validate key and return script ----
    try {
      const body = JSON.parse(event.body);
      const providedKey = body.key;
      if (!providedKey) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Missing key' })
        };
      }

      const res = await supabaseRequest('GET', `keys?key_code=eq.${encodeURIComponent(providedKey)}&select=*`);
      const data = await res.json();
      if (!data || data.length === 0) {
        return {
          statusCode: 401,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Invalid key' })
        };
      }
      const keyData = data[0];
      if (isExpired(keyData.expires_at)) {
        return {
          statusCode: 401,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Key expired' })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
        body: SCRIPT
      };
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: e.message })
      };
    }
  }

  // ---- Fallback redirect ----
  return {
    statusCode: 302,
    headers: { Location: 'https://discord.gg/lol' },
    body: ''
  };
};
