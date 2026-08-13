// netlify/functions/loader.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ---- YOUR OBFUSCATED LUA SCRIPT ----
const SCRIPT = `
-- PASTE YOUR OBFUSCATED SCRIPT HERE
`;

// ---- DASHBOARD HTML (embedded) ----
const DASHBOARD = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Key Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #0a0a0a; color: #e0e0e0; padding: 20px; }
        .container { max-width: 1100px; margin: 0 auto; }
        h1 { color: #fff; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
        .card { background: #1a1a1a; border-radius: 12px; padding: 20px; margin-bottom: 20px; border: 1px solid #2a2a2a; }
        .row { display: flex; gap: 15px; flex-wrap: wrap; align-items: center; }
        input, select, button { padding: 10px 16px; border-radius: 8px; border: 1px solid #333; background: #0d0d0d; color: #fff; font-size: 14px; }
        button { background: #4a9eff; border: none; cursor: pointer; font-weight: 600; }
        button:hover { background: #6aafff; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #2a2a2a; }
        th { color: #aaa; font-weight: 600; text-transform: uppercase; font-size: 12px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .badge-day { background: #ff6b35; color: #fff; }
        .badge-week { background: #ffb347; color: #fff; }
        .badge-month { background: #4a9eff; color: #fff; }
        .badge-lifetime { background: #28c840; color: #fff; }
        .badge-expired { background: #ff4444; color: #fff; }
        .copy-btn { background: transparent; border: 1px solid #444; padding: 4px 10px; border-radius: 4px; cursor: pointer; color: #aaa; }
        .copy-btn:hover { background: #333; color: #fff; }
        .delete-btn { background: transparent; border: none; color: #ff4444; cursor: pointer; font-size: 16px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 15px; }
        .stat { background: #0d0d0d; padding: 15px; border-radius: 8px; text-align: center; }
        .stat .number { font-size: 28px; font-weight: 700; color: #fff; }
        .stat .label { font-size: 12px; color: #888; }
        .toast { position: fixed; bottom: 20px; right: 20px; background: #1a1a1a; border: 1px solid #333; padding: 15px 25px; border-radius: 10px; color: #fff; z-index: 999; }
        .hidden { display: none; }
        .loading { text-align: center; color: #666; padding: 20px; }
    </style>
</head>
<body>
<div class="container">
    <h1>🔑 Key Dashboard</h1>
    <div class="card"><h2>📊 Stats</h2><div class="stats"><div class="stat"><div class="number" id="totalKeys">0</div><div class="label">Total</div></div><div class="stat"><div class="number" id="activeKeys">0</div><div class="label">Active</div></div><div class="stat"><div class="number" id="expiredKeys">0</div><div class="label">Expired</div></div></div></div>
    <div class="card"><h2>🔧 Generate Key</h2><div class="row"><select id="keyType"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="lifetime">Lifetime</option></select><input type="text" id="keyOwner" placeholder="Owner (optional)"><button onclick="generateKey()">Generate & Save</button></div><div id="newKeyResult" style="margin-top:15px; display:none;"><span>New key:</span> <code id="newKeyDisplay"></code> <button class="copy-btn" onclick="copyNewKey()">Copy</button></div></div>
    <div class="card"><h2>📋 All Keys</h2><div style="overflow-x:auto;"><table><thead><tr><th>Key</th><th>Type</th><th>Status</th><th>Expires</th><th>Owner</th><th>Action</th></tr></thead><tbody id="keyTableBody"><tr><td colspan="6" class="loading">Loading...</td></tr></tbody></table></div></div>
</div>
<div id="toast" class="toast hidden"></div>

<script>
const API_URL = '/.netlify/functions/loader';
async function loadKeys() {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (data.keys) { renderKeys(data.keys); updateStats(data.keys); }
}
function renderKeys(keys) {
    const tbody = document.getElementById('keyTableBody');
    if (!keys || keys.length === 0) { tbody.innerHTML = '<tr><td colspan="6">No keys</td></tr>'; return; }
    tbody.innerHTML = keys.map(k => {
        const now = new Date(), expires = new Date(k.expires_at), expired = now > expires;
        const badge = expired ? 'badge-expired' : `badge-${k.key_type}`;
        const status = expired ? 'Expired' : k.key_type.charAt(0).toUpperCase()+k.key_type.slice(1);
        return `<tr><td><code style="color:#4a9eff;">${k.key_code}</code></td><td><span class="badge ${badge}">${status}</span></td><td>${expired ? '❌' : '✅'}</td><td>${expires.toLocaleString()}</td><td>${k.owner || '—'}</td><td><button class="copy-btn" onclick="copyKey('${k.key_code}')">Copy</button> <button class="delete-btn" onclick="deleteKey('${k.key_code}')">🗑️</button></td></tr>`;
    }).join('');
}
function updateStats(keys) { const now = new Date(); const total=keys.length, active=keys.filter(k=>new Date(k.expires_at)>now).length; document.getElementById('totalKeys').textContent=total; document.getElementById('activeKeys').textContent=active; document.getElementById('expiredKeys').textContent=total-active; }
async function generateKey() {
    const type = document.getElementById('keyType').value, owner = document.getElementById('keyOwner').value || 'Unknown';
    let key = '';
    const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for(let i=0;i<12;i++) key += chars[Math.floor(Math.random()*chars.length)];
    key = type.charAt(0).toUpperCase()+'-'+key;
    const now = new Date(), expires = new Date(now);
    if(type==='day') expires.setDate(now.getDate()+1);
    else if(type==='week') expires.setDate(now.getDate()+7);
    else if(type==='month') expires.setDate(now.getDate()+30);
    else expires.setFullYear(now.getFullYear()+100);
    const res = await fetch(API_URL+'/save', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key_code:key,key_type:type,owner,expires_at:expires.toISOString()})});
    if(res.ok) { document.getElementById('newKeyDisplay').textContent=key; document.getElementById('newKeyResult').style.display='block'; showToast('✅ Saved: '+key); loadKeys(); }
    else showToast('Error saving key');
}
async function deleteKey(key) { if(!confirm('Delete '+key+'?')) return; await fetch(API_URL+'/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key_code:key})}); loadKeys(); showToast('🗑️ Deleted'); }
function copyKey(k) { navigator.clipboard.writeText(k).then(()=>showToast('Copied!')); }
function copyNewKey() { copyKey(document.getElementById('newKeyDisplay').textContent); }
function showToast(msg) { const t = document.getElementById('toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(t._timeout); t._timeout=setTimeout(()=>t.classList.add('hidden'),3000); }
loadKeys();
</script>
</body>
</html>`;

function isExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
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

  // ---- Admin dashboard (GET /admin) ----
  if (event.queryStringParameters && event.queryStringParameters.page === 'admin') {
    const clientIP = (event.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const allowedIP = process.env.ALLOWED_IP;
    // If IP doesn't match, redirect to Discord
    if (clientIP !== allowedIP) {
      return {
        statusCode: 302,
        headers: { Location: 'https://discord.gg/lol' },
        body: ''
      };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: DASHBOARD
    };
  }

  // ---- GET keys (for dashboard AJAX) ----
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

      // Return the obfuscated script
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
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
