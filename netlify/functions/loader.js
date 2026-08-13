// netlify/functions/loader.js
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const ALLOWED_IP = process.env.ALLOWED_IP;

async function supabaseRequest(method, endpoint, body = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase credentials not set');
  }
  // Ensure we use the correct endpoint with proper schema
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
    console.error('Supabase error:', text);
    throw new Error(`Supabase ${res.status}: ${text}`);
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
      // Try to select from keys table
      const res = await supabaseRequest('GET', 'keys?limit=1');
      const data = await res.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, message: 'Supabase connection works!', keys: data })
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: e.message })
      };
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

  if (event.httpMethod === 'POST') {
    const path = event.path;

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

    // Validate key and return script
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

  return {
    statusCode: 302,
    headers: { Location: 'https://discord.gg/lol' },
    body: ''
  };
};
