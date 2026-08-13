// netlify/functions/loader.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ---- YOUR OBFUSCATED LUA SCRIPT ----
// Paste the ENTIRE output from WeAreDevs between the backticks.
const SCRIPT = `
-- PASTE YOUR OBFUSCATED LUA SCRIPT HERE
`;

// ---- YOUR ALLOWED IP (set as environment variable ALLOWED_IP) ----
// Find your IP by visiting https://whatismyip.com
// Then set it in Netlify environment variables.

// ---- DASHBOARD HTML (embedded) ----
// This is the full HTML for the key management dashboard.
// It's only served if your IP matches.
const DASHBOARD_HTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Key System Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #0a0a0a;
            color: #e0e0e0;
            padding: 20px;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 {
            color: #fff;
            font-size: 28px;
            margin-bottom: 10px;
            border-bottom: 2px solid #333;
            padding-bottom: 15px;
        }
        .subtitle { color: #888; margin-bottom: 30px; }
        .card {
            background: #1a1a1a;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            border: 1px solid #2a2a2a;
        }
        .card h2 { color: #fff; font-size: 18px; margin-bottom: 15px; }
        .row {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            align-items: center;
        }
        input, select, button {
            padding: 10px 16px;
            border-radius: 8px;
            border: 1px solid #333;
            background: #0d0d0d;
            color: #fff;
            font-size: 14px;
        }
        input:focus, select:focus {
            outline: none;
            border-color: #4a9eff;
        }
        button {
            background: #4a9eff;
            border: none;
            cursor: pointer;
            font-weight: 600;
            transition: background 0.2s;
        }
        button:hover { background: #6aafff; }
        button.danger { background: #ff4444; }
        button.danger:hover { background: #ff6666; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #2a2a2a;
        }
        th { color: #aaa; font-weight: 600; font-size: 12px; text-transform: uppercase; }
        td { font-size: 14px; }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }
        .badge-day { background: #ff6b35; color: #fff; }
        .badge-week { background: #ffb347; color: #fff; }
        .badge-month { background: #4a9eff; color: #fff; }
        .badge-lifetime { background: #28c840; color: #fff; }
        .badge-expired { background: #ff4444; color: #fff; }
        .copy-btn {
            background: transparent;
            border: 1px solid #444;
            padding: 4px 10px;
            font-size: 12px;
            border-radius: 4px;
            cursor: pointer;
            color: #aaa;
        }
        .copy-btn:hover { background: #333; color: #fff; }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 10px;
        }
        .stat {
            background: #0d0d0d;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
        }
        .stat .number { font-size: 28px; font-weight: 700; color: #fff; }
        .stat .label { font-size: 12px; color: #888; margin-top: 5px; }
        .footer {
            margin-top: 40px;
            color: #555;
            font-size: 13px;
            text-align: center;
            border-top: 1px solid #1a1a1a;
            padding-top: 20px;
        }
        .toast {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #1a1a1a;
            border: 1px solid #333;
            padding: 15px 25px;
            border-radius: 10px;
            color: #fff;
            z-index: 999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .hidden { display: none; }
        .loading { text-align: center; color: #666; padding: 20px; }
        .delete-btn {
            background: transparent;
            border: none;
            color: #ff4444;
            cursor: pointer;
            font-size: 16px;
        }
        .delete-btn:hover { color: #ff6666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔑 Key System Dashboard</h1>
        <p class="subtitle">Live keys stored in Supabase — generate, delete, and manage instantly.</p>

        <div class="card">
            <h2>📊 Stats</h2>
            <div class="stats" id="stats">
                <div class="stat"><div class="number" id="totalKeys">0</div><div class="label">Total Keys</div></div>
                <div class="stat"><div class="number" id="activeKeys">0</div><div class="label">Active</div></div>
                <div class="stat"><div class="number" id="expiredKeys">0</div><div class="label">Expired</div></div>
            </div>
        </div>

        <div class="card">
            <h2>🔧 Generate New Key</h2>
            <div class="row">
                <select id="keyType">
                    <option value="day">Day (24 hours)</option>
                    <option value="week">Week (7 days)</option>
                    <option value="month">Month (30 days)</option>
                    <option value="lifetime">Lifetime</option>
                </select>
                <input type="text" id="keyOwner" placeholder="Owner name/email (optional)" style="flex:1; min-width:150px;">
                <button onclick="generateKey()">Generate & Save</button>
            </div>
            <div id="newKeyResult" style="margin-top:15px; padding:10px; background:#0d0d0d; border-radius:8px; display:none;">
                <span style="color:#888;">New key saved:</span>
                <code id="newKeyDisplay" style="color:#4a9eff; font-size:16px;"></code>
                <button class="copy-btn" onclick="copyNewKey()">📋 Copy</button>
                <span id="newKeyType" style="margin-left:10px;"></span>
            </div>
        </div>

        <div class="card">
            <h2>📋 All Keys</h2>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Key</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Expires</th>
                            <th>Owner</th>
                            <th>Created</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody id="keyTableBody">
                        <tr><td colspan="7" class="loading">Loading keys...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="footer">
            Keys are stored in Supabase. Changes take effect immediately — no redeploy needed.
        </div>
    </div>

    <div id="toast" class="toast hidden"></div>

    <script>
        const API_URL = '/.netlify/functions/loader';

        async function loadKeys() {
            try {
                const res = await fetch(API_URL);
                const data = await res.json();
                if (data.keys) {
                    renderKeys(data.keys);
                    updateStats(data.keys);
                }
            } catch (e) {
                console.error('Failed to load keys:', e);
                document.getElementById('keyTableBody').innerHTML =
                    '<tr><td colspan="7" style="text-align:center; color:#ff4444;">Failed to load keys</td></tr>';
            }
        }

        function renderKeys(keys) {
            const tbody = document.getElementById('keyTableBody');
            if (!keys || keys.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#666;">No keys found</td></tr>';
                return;
            }
            tbody.innerHTML = keys.map(k => {
                const now = new Date();
                const expiresAt = new Date(k.expires_at);
                const isExpired = now > expiresAt;
                const statusClass = isExpired ? 'badge-expired' : `badge-${k.key_type}`;
                const statusText = isExpired ? 'Expired' : k.key_type.charAt(0).toUpperCase() + k.key_type.slice(1);
                const created = new Date(k.created_at).toLocaleString();
                const expires = expiresAt.toLocaleString();

                return `<tr>
                    <td><code style="color:#4a9eff; font-size:13px;">${k.key_code}</code></td>
                    <td><span class="badge ${statusClass}">${statusText}</span></td>
                    <td>${isExpired ? '❌ Expired' : '✅ Active'}</td>
                    <td>${expires}</td>
                    <td>${k.owner || '—'}</td>
                    <td>${created}</td>
                    <td>
                        <button class="copy-btn" onclick="copyKey('${k.key_code}')">📋 Copy</button>
                        <button class="delete-btn" onclick="deleteKey('${k.key_code}')" title="Delete">🗑️</button>
                    </td>
                </tr>`;
            }).join('');
        }

        function updateStats(keys) {
            const now = new Date();
            const total = keys.length;
            const active = keys.filter(k => new Date(k.expires_at) > now).length;
            const expired = total - active;
            document.getElementById('totalKeys').textContent = total;
            document.getElementById('activeKeys').textContent = active;
            document.getElementById('expiredKeys').textContent = expired;
        }

        async function generateKey() {
            const type = document.getElementById('keyType').value;
            const owner = document.getElementById('keyOwner').value || 'Unknown';

            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let key = '';
            for (let i = 0; i < 12; i++) {
                key += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            const prefix = type.charAt(0).toUpperCase();
            key = prefix + '-' + key;

            const now = new Date();
            let expiresAt = new Date(now);
            switch(type) {
                case 'day': expiresAt.setDate(now.getDate() + 1); break;
                case 'week': expiresAt.setDate(now.getDate() + 7); break;
                case 'month': expiresAt.setDate(now.getDate() + 30); break;
                case 'lifetime': expiresAt.setFullYear(now.getFullYear() + 100); break;
            }

            try {
                const res = await fetch(API_URL + '/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key_code: key,
                        key_type: type,
                        owner: owner,
                        expires_at: expiresAt.toISOString()
                    })
                });

                if (!res.ok) {
                    const error = await res.json();
                    showToast('Failed to save key: ' + (error.error || 'Unknown error'));
                    return;
                }

                document.getElementById('newKeyDisplay').textContent = key;
                document.getElementById('newKeyType').textContent = `(${type} key)`;
                document.getElementById('newKeyResult').style.display = 'block';

                showToast(`✅ Key generated and saved: ${key}`);
                loadKeys();
            } catch (e) {
                showToast('Error saving key: ' + e.message);
            }
        }

        async function deleteKey(key) {
            if (!confirm(`Delete key: ${key}? This cannot be undone.`)) return;

            try {
                const res = await fetch(API_URL + '/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key_code: key })
                });

                if (!res.ok) {
                    const error = await res.json();
                    showToast('Failed to delete key: ' + (error.error || 'Unknown error'));
                    return;
                }

                showToast(`🗑️ Key deleted: ${key}`);
                loadKeys();
            } catch (e) {
                showToast('Error deleting key: ' + e.message);
            }
        }

        function copyKey(key) {
            navigator.clipboard.writeText(key).then(() => {
                showToast('📋 Copied: ' + key);
            }).catch(() => {
                const el = document.createElement('textarea');
                el.value = key;
                document.body.appendChild(el);
                el.select();
                document.execCommand('copy');
                document.body.removeChild(el);
                showToast('📋 Copied: ' + key);
            });
        }

        function copyNewKey() {
            const key = document.getElementById('newKeyDisplay').textContent;
            copyKey(key);
        }

        function showToast(msg) {
            const toast = document.getElementById('toast');
            toast.textContent = msg;
            toast.classList.remove('hidden');
            clearTimeout(toast._timeout);
            toast._timeout = setTimeout(() => {
                toast.classList.add('hidden');
            }, 3000);
        }

        loadKeys();
    </script>
</body>
</html>
`;

// ---- Helper functions ----
function isExpired(expiresAt) {
  return new Date() > new Date(expiresAt);
}

function isAllowedIP(requestIP, allowedIP) {
  // Netlify passes IP in x-forwarded-for header (first in list)
  const ip = requestIP ? requestIP.split(',')[0].trim() : '';
  return ip === allowedIP;
}

// ---- Main handler ----
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

  // ---- ADMIN DASHBOARD (GET /admin) ----
  // We use a rewrite rule in netlify.toml: /admin -> this function with ?page=admin
  if (event.queryStringParameters && event.queryStringParameters.page === 'admin') {
    const clientIP = event.headers['x-forwarded-for'];
    const allowedIP = process.env.ALLOWED_IP;

    // If IP doesn't match, redirect to Discord
    if (!isAllowedIP(clientIP, allowedIP)) {
      return {
        statusCode: 302,
        headers: {
          Location: 'https://discord.gg/lol'  // Change to your invite
        },
        body: ''
      };
    }

    // Return the dashboard HTML
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html',
        'Access-Control-Allow-Origin': '*'
      },
      body: DASHBOARD_HTML
    };
  }

  // ---- GET: list all keys (for dashboard API) ----
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

  // ---- POST: handle save/delete/validate ----
  if (event.httpMethod === 'POST') {
    const path = event.path;

    // ---- Save a new key ----
    if (path.includes('/save')) {
      // Optional: add IP check here too for extra security
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
