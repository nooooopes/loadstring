// netlify/functions/loader.js
const fs = require('fs');
const path = require('path');

// ---- Environment variables ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const ALLOWED_IP = process.env.ALLOWED_IP;

// ---- Log env status (will show in Netlify logs) ----
console.log('--- Environment check ---');
console.log('SUPABASE_URL exists:', !!SUPABASE_URL);
console.log('SUPABASE_KEY exists:', !!SUPABASE_KEY);
console.log('ALLOWED_IP:', ALLOWED_IP);
console.log('------------------------');

// ---- Supabase request helper ----
async function supabaseRequest(method, endpoint, body = null) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase credentials not configured. Check environment variables.');
  }

  const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  console.log('Request URL:', url);

  const headers = {
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json'
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  console.log('Request method:', method);
  console.log('Request headers:', Object.keys(headers));

  try {
    const res = await fetch(url, options);
    console.log('Response status:', res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error('Response body:', text);
      throw new Error(`Supabase ${res.status}: ${text}`);
    }

    return res;
  } catch (e) {
    console.error('Fetch error:', e.message);
    throw e;
  }
}

// ---- YOUR OBFUSCATED LUA SCRIPT ----
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

  // ---- Test endpoint ----
  if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.test === '1') {
    try {
      const res = await supabaseRequest('GET', 'keys?limit=1');
      const data = await res.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          message: 'Supabase connected!',
          keys: data
        })
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
    console.log('Client IP:', clientIP);
    console.log('Allowed IP:', ALLOWED_IP);

    if (clientIP !== ALLOWED_IP) {
      return {
        statusCode: 302,
        headers: { Location: 'https://discord.gg/lol' },
        body: ''
      };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: adminHtml
    };
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
      console.error('GET keys error:', e.message);
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
    console.log('POST path:', path);

    // Save key
    if (path.includes('/save')) {
      try {
        const body = JSON.parse(event.body);
        const { key_code, key_type, owner, expires_at } = body;
        console.log('Saving key:', key_code);

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
        console.error('Save error:', e.message);
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
        console.log('Deleting key:', key_code);

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
        console.error('Delete error:', e.message);
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
      console.log('Validating key:', providedKey);

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
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        },
        body: SCRIPT
      };
    } catch (e) {
      console.error('Validation error:', e.message);
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: e.message })
      };
    }
  }

  // ---- Fallback: redirect to Discord ----
  return {
    statusCode: 302,
    headers: { Location: 'https://discord.gg/lol' },
    body: ''
  };
};
