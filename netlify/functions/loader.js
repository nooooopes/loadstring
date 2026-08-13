// netlify/functions/loader.js
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // service role
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // we'll add this variable
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const ALLOWED_IP = process.env.ALLOWED_IP;

// ---- Supabase request with fallback key ----
async function supabaseRequest(method, endpoint, body = null, useServiceKey = true) {
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !key) {
    throw new Error(`Missing ${useServiceKey ? 'service role' : 'anon'} key`);
  }
  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${key}`,
    'apikey': key,
    'Content-Type': 'application/json'
  };
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status} (${useServiceKey ? 'service' : 'anon'}): ${text}`);
  }
  return res;
}

// ---- YOUR OBFUSCATED SCRIPT ----
const SCRIPT = `
-- PASTE YOUR OBFUSCATED SCRIPT HERE
`;

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

  // ---- Test endpoint (GET ?test=1) ----
  if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.test === '1') {
    try {
      // Try with service key first
      const res = await supabaseRequest('GET', 'keys?limit=1', null, true);
      const data = await res.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, message: 'Service key works!', keys: data })
      };
    } catch (e) {
      // Fallback to anon key
      try {
        const res = await supabaseRequest('GET', 'keys?limit=1', null, false);
        const data = await res.json();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, message: 'Service key failed, but anon key works!', keys: data })
        };
      } catch (e2) {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Both keys failed: ' + e2.message })
        };
      }
    }
  }

  // ---- Admin dashboard ----
  if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.page === 'admin') {
    const clientIP = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (clientIP !== ALLOWED_IP) {
      return { statusCode: 302, headers: { Location: 'https://discord.gg/lol' }, body: '' };
    }
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: adminHtml };
  }

  // ---- GET keys (try service, fallback to anon) ----
  if (event.httpMethod === 'GET') {
    try {
      const res = await supabaseRequest('GET', 'keys?select=*&order=created_at.desc', null, true);
      const keys = await res.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ keys })
      };
    } catch (e) {
      // Fallback to anon key
      try {
        const res = await supabaseRequest('GET', 'keys?select=*&order=created_at.desc', null, false);
        const keys = await res.json();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ keys })
        };
      } catch (e2) {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: e2.message })
        };
      }
    }
  }

  // ---- POST (only service key can write) ----
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
        await supabaseRequest('POST', 'keys', { key_code, key_type, owner, expires_at }, true);
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
        await supabaseRequest('DELETE', `keys?key_code=eq.${encodeURIComponent(key_code)}`, null, true);
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

    // Validate key and return script (uses anon for read, but we'll use service for reliability)
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

      // Try service first, fallback to anon
      let data;
      try {
        const res = await supabaseRequest('GET', `keys?key_code=eq.${encodeURIComponent(providedKey)}&select=*`, null, true);
        data = await res.json();
      } catch (e) {
        // Fallback to anon
        const res = await supabaseRequest('GET', `keys?key_code=eq.${encodeURIComponent(providedKey)}&select=*`, null, false);
        data = await res.json();
      }

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
