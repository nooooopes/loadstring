// netlify/functions/loader.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ---- YOUR OBFUSCATED LUA SCRIPT ----
// Paste the ENTIRE obfuscated output from WeAreDevs between the backticks below.
// IMPORTANT: If your script contains backticks, escape them as \`
const SCRIPT = `
-- PASTE YOUR OBFUSCATED LUA SCRIPT HERE
`;

function isExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

exports.handler = async (event) => {
  // Handle CORS preflight
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

  // ---- GET: list all keys (for the dashboard) ----
  if (event.httpMethod === 'GET') {
    try {
      const { data: keys, error } = await supabase
        .from('keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ keys })
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Database error' })
      };
    }
  }

  // ---- POST: handle save, delete, and validation ----
  if (event.httpMethod === 'POST') {
    const path = event.path;

    // ---- Save a new key ----
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
        const { error } = await supabase.from('keys').insert([{ key_code, key_type, owner, expires_at }]);
        if (error) throw error;
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, key: key_code })
        };
      } catch (e) {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: e.message })
        };
      }
    }

    // ---- Delete a key ----
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
        const { error } = await supabase.from('keys').delete().eq('key_code', key_code);
        if (error) throw error;
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

    // ---- Validate key and return the script ----
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

      // Check if the key exists in Supabase
      const { data: keyData, error } = await supabase
        .from('keys')
        .select('*')
        .eq('key_code', providedKey)
        .single();

      if (error || !keyData) {
        return {
          statusCode: 401,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Invalid key' })
        };
      }

      // Check if the key has expired
      if (isExpired(keyData.expires_at)) {
        return {
          statusCode: 401,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            error: 'Key expired',
            expiry: keyData.expires_at,
            type: keyData.key_type
          })
        };
      }

      // Return the obfuscated script
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
          'X-Key-Type': keyData.key_type,
          'X-Key-Expiry': keyData.expires_at
        },
        body: SCRIPT
      };
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid request' })
      };
    }
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
