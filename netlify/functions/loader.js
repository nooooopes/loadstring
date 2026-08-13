// netlify/functions/loader.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin password (set in Netlify env)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

// ---- Load admin.html from file system ----
let DASHBOARD_HTML = '';
try {
  const filePath = path.join(__dirname, '../../admin.html');
  DASHBOARD_HTML = fs.readFileSync(filePath, 'utf8');
} catch (e) {
  DASHBOARD_HTML = '<html><body><h1>Dashboard file not found</h1></body></html>';
}

function isExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

// ---- Helper: get script from Supabase ----
async function getScript() {
  const { data, error } = await supabase
    .from('scripts')
    .select('content')
    .eq('id', 1)
    .single();
  if (error || !data) {
    return '-- No script found. Upload one via admin panel.';
  }
  return data.content;
}

// ---- Helper: save script to Supabase ----
async function saveScript(content) {
  const { error } = await supabase
    .from('scripts')
    .upsert({ id: 1, content }, { onConflict: 'id' });
  if (error) throw error;
  return true;
}

exports.handler = async (event) => {
  // CORS preflight
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

  // ---- Admin dashboard (GET ?page=admin) ----
  if (event.httpMethod === 'GET' && event.queryStringParameters && event.queryStringParameters.page === 'admin') {
    const clientIP = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const allowedIP = process.env.ALLOWED_IP;
    if (clientIP !== allowedIP) {
      return {
        statusCode: 302,
        headers: { Location: 'https://discord.gg/lol' },
        body: ''
      };
    }
    // We'll serve the HTML; login is handled client-side via password check
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: DASHBOARD_HTML
    };
  }

  // ---- GET: list keys (for dashboard) ----
  if (event.httpMethod === 'GET') {
    try {
      const { data, error } = await supabase
        .from('keys')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ keys: data })
      };
    } catch (e) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Database error' })
      };
    }
  }

  // ---- POST endpoints ----
  if (event.httpMethod === 'POST') {
    const path = event.path;

    // ---- Save key ----
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
        const { error } = await supabase
          .from('keys')
          .insert([{ key_code, key_type, owner, expires_at }]);
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

    // ---- Delete key ----
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
        const { error } = await supabase
          .from('keys')
          .delete()
          .eq('key_code', key_code);
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

    // ---- Save script (from admin) ----
    if (path.includes('/savescript')) {
      try {
        const body = JSON.parse(event.body);
        const { content } = body;
        if (!content) {
          return {
            statusCode: 400,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ error: 'Missing content' })
          };
        }
        await saveScript(content);
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

    // ---- Get current script (for admin) ----
    if (path.includes('/getscript')) {
      try {
        const script = await getScript();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' },
          body: script
        };
      } catch (e) {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: e.message })
        };
      }
    }

    // ---- Validate key and return script (for loader.lua) ----
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

      if (isExpired(keyData.expires_at)) {
        return {
          statusCode: 401,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Key expired' })
        };
      }

      // Fetch the script from Supabase
      const script = await getScript();

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        },
        body: script
      };
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Invalid request' })
      };
    }
  }

  // ---- Anything else → redirect to Discord ----
  return {
    statusCode: 302,
    headers: { Location: 'https://discord.gg/lol' },
    body: ''
  };
};
