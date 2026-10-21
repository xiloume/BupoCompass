// Lightweight HTTP client for the BupoCompass community API.
// Falls back to a local cache of community templates if the API is unreachable.

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function loadEnvVar(key) {
  // Priority: process.env -> .env / .env.local in project root
  if (process.env[key]) return process.env[key];
  const root = path.resolve(__dirname, '..');
  for (const file of ['.env.local', '.env']) {
    const p = path.join(root, file);
    if (!fs.existsSync(p)) continue;
    try {
      const txt = fs.readFileSync(p, 'utf8');
      for (const line of txt.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 0) continue;
        const k = t.slice(0, eq).trim();
        if (k !== key) continue;
        let v = t.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return v;
      }
    } catch {}
  }
  return null;
}

const API_BASE = loadEnvVar('BUPO_API_URL') || 'http://51.91.158.224:7000';
console.log('[Community] API base:', API_BASE);

function request(method, pathOrUrl, body = null, headers = {}, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const url = pathOrUrl.startsWith('http')
      ? new URL(pathOrUrl)
      : new URL(pathOrUrl, API_BASE);
    const lib = url.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BupoCompass/1.0',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    };
    const req = lib.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`));
        }
        try { resolve(buf ? JSON.parse(buf) : null); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('community api timeout')));
    if (data) req.write(data);
    req.end();
  });
}

// Browse community templates (public endpoint - no auth)
async function browse(query = '') {
  try {
    const path = `/community/browse${query ? `?q=${encodeURIComponent(query)}` : ''}`;
    return await request('GET', path);
  } catch (e) {
    return { error: e.message, items: [] };
  }
}

async function publish(checklistId, token) {
  return request('POST', `/checklists/${checklistId}/publish`, null, {
    Authorization: `Bearer ${token}`,
  });
}

async function vote(checklistId, value, token) {
  return request('POST', `/checklists/${checklistId}/vote`, { value }, {
    Authorization: `Bearer ${token}`,
  });
}

module.exports = { browse, publish, vote, API_BASE };
