const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Locate the Steam install directory
function findSteamPath() {
  // 1. Common defaults
  const defaults = [
    'C:/Program Files (x86)/Steam',
    'C:/Program Files/Steam',
    process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Steam'),
    process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Steam'),
  ].filter(Boolean);
  for (const p of defaults) {
    if (fs.existsSync(path.join(p, 'steam.exe'))) return p;
  }
  // 2. Registry
  return null;
}

// Async: query the Windows registry for the Steam path
function findSteamPathFromRegistry() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve(null);
    execFile(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { timeout: 3000 },
      (err, stdout) => {
        if (err) return resolve(null);
        const m = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/);
        resolve(m ? m[1].trim() : null);
      }
    );
  });
}

async function getSteamPath() {
  return findSteamPath() || (await findSteamPathFromRegistry());
}

// List all user IDs in Steam/userdata
function listSteamUsers(steamPath) {
  const userdata = path.join(steamPath, 'userdata');
  if (!fs.existsSync(userdata)) return [];
  return fs
    .readdirSync(userdata)
    .filter((d) => /^\d+$/.test(d))
    .map((d) => path.join(userdata, d));
}

// --- Valve KeyValues Binary parser ---
// Format: type byte + null-terminated key + value (based on type)
// Types: 0=section, 1=string, 2=int32, 3=float, 4=ptr, 5=wstring, 6=color, 7=uint64, 8=end
function parseVdfBinary(buf) {
  let pos = 0;
  let depth = 0;
  let iterations = 0;
  const MAX_DEPTH = 32;
  const MAX_ITER = 200000;
  const root = {};

  function readCString() {
    const start = pos;
    let scanned = 0;
    while (pos < buf.length && buf[pos] !== 0) {
      pos++;
      if (++scanned > 4096) return null; // sanity cap
    }
    if (pos >= buf.length) return null;
    let s;
    try {
      s = buf.slice(start, pos).toString('utf8');
    } catch {
      s = '';
    }
    pos++; // skip null
    return s;
  }

  function parseObject(target) {
    if (depth++ > MAX_DEPTH) { depth--; return; }
    while (pos < buf.length) {
      if (++iterations > MAX_ITER) { depth--; return; }
      if (pos >= buf.length) break;
      const type = buf[pos++];
      if (type === 0x08 || type === 0x0b) {
        depth--;
        return;
      }
      const key = readCString();
      if (key === null) { depth--; return; }

      if (type === 0x00) {
        // Nested object
        const child = {};
        target[key] = child;
        parseObject(child);
      } else if (type === 0x01) {
        // String
        target[key] = readCString() ?? '';
      } else if (type === 0x02) {
        // Int32
        if (pos + 4 > buf.length) return;
        target[key] = buf.readInt32LE(pos);
        pos += 4;
      } else if (type === 0x03) {
        // Float
        if (pos + 4 > buf.length) return;
        target[key] = buf.readFloatLE(pos);
        pos += 4;
      } else if (type === 0x04 || type === 0x06) {
        // Pointer / Color (4 bytes)
        pos += 4;
      } else if (type === 0x07) {
        // UInt64
        if (pos + 8 > buf.length) return;
        target[key] = buf.readBigUInt64LE(pos).toString();
        pos += 8;
      } else if (type === 0x05) {
        // WString (null-terminated UTF-16)
        const start = pos;
        while (pos + 1 < buf.length && !(buf[pos] === 0 && buf[pos + 1] === 0)) pos += 2;
        target[key] = buf.slice(start, pos).toString('utf16le');
        pos += 2;
      } else {
        // Unknown type, abort safely
        depth--;
        return;
      }
    }
    depth--;
  }

  try {
    parseObject(root);
  } catch (e) {
    console.error('[VDF] parse error:', e.message);
  }
  return root;
}

// Walk a parsed VDF object and extract achievement-like entries
// Schema typically has: { "<appid>": { "stats": { "<id>": { "type": "ACHIEVEMENTS", "bits": { "<bit>": { "name": "ACH_KEY", ... } } } } } }
// User data typically has: { "<appid>": { "stats": { "<statname>": <int> } } } and unlocks are stored as "<bit>" = 1
function extractAchievementsFromVdf(obj, isSchema = false, knownKeys = null) {
  const schemaMap = new Map();
  const unlocked = new Map();
  // Also collect flat key->value pairs to check against known achievement keys
  const flatValues = new Map();
  const MAX_DEPTH = 30;
  const MAX_NODES = 50000;
  let nodes = 0;

  function walk(o, depth) {
    if (depth > MAX_DEPTH) return;
    if (++nodes > MAX_NODES) return;
    if (!o || typeof o !== 'object') return;
    let entries;
    try {
      entries = Object.entries(o);
    } catch { return; }
    for (const [k, v] of entries) {
      try {
        // Schema: achievement definitions (nested objects with name field)
        if (typeof v === 'object' && v !== null) {
          if (v.name && (v.display || v.displayName || v.progress !== undefined || v.bit !== undefined || v.permission !== undefined)) {
            const key = String(v.name);
            let display = null;
            let description = null;
            if (v.display && typeof v.display === 'object') {
              display = typeof v.display.name === 'string' ? v.display.name : null;
              description = typeof v.display.desc === 'string' ? v.display.desc : null;
            }
            if (!display && typeof v.displayName === 'string') display = v.displayName;
            if (!description && typeof v.description === 'string') description = v.description;
            schemaMap.set(key, { key, display, description });
          }
          // User stats with explicit bAchieved structure
          if (v.bAchieved === 1 || v.bAchieved === '1') {
            const key = String(v.name || k);
            const time = Number(v.rtUnlocked || v.UnlockTime || 0) || 0;
            unlocked.set(key, { key, unlocked: true, unlockTime: time });
          }
          walk(v, depth + 1);
        } else if (typeof v === 'number' || typeof v === 'string') {
          // Flat scalar value - store for later cross-reference with known achievement keys
          const numVal = Number(v);
          if (!Number.isNaN(numVal)) {
            flatValues.set(String(k), numVal);
          }
        }
      } catch {}
    }
  }
  try { walk(obj, 0); } catch (e) { console.error('[VDF walk] error:', e.message); }

  // Cross-reference flat values with known achievement keys (from a previously parsed schema)
  if (knownKeys && knownKeys.size > 0) {
    for (const key of knownKeys) {
      const val = flatValues.get(key);
      if (val !== undefined && val >= 1) {
        unlocked.set(key, { key, unlocked: true, unlockTime: 0 });
      }
    }
  }

  return { schemaMap, unlocked, flatValues };
}

// Parse text-format VDF (Valve KeyValues)
function parseVdfText(text) {
  const root = {};
  const stack = [root];
  // Tokenize and parse: "key" "value"  OR  "key" { ... }
  const tokenRe = /"((?:\\.|[^"\\])*)"|(\{|\})/g;
  let m;
  let pendingKey = null;
  let depth = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (depth++ > 100000) break;
    if (m[2] === '{') {
      const child = {};
      if (pendingKey !== null) {
        stack[stack.length - 1][pendingKey] = child;
        stack.push(child);
        pendingKey = null;
      }
    } else if (m[2] === '}') {
      stack.pop();
    } else {
      const tok = m[1];
      if (pendingKey === null) {
        pendingKey = tok;
      } else {
        stack[stack.length - 1][pendingKey] = tok;
        pendingKey = null;
      }
    }
  }
  return root;
}

// Try to detect file format and parse accordingly
function parseUserGameStatsBin(filePath) {
  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    return null;
  }
  const isSchema = /Schema/i.test(filePath);

  // Detect text vs binary: check first bytes for VDF text marker
  const head = buf.slice(0, 64).toString('utf8');
  const looksText = /^[\s"]*"\w+"\s*\{/.test(head);

  let parsed;
  if (looksText) {
    try { parsed = parseVdfText(buf.toString('utf8')); } catch { parsed = {}; }
  } else {
    parsed = parseVdfBinary(buf);
  }
  return { parsed, isSchema, filePath, format: looksText ? 'text-vdf' : 'binary-vdf' };
}

// Recursively find files matching a predicate under a root
function findFilesRecursive(root, predicate, depth = 0, out = []) {
  if (depth > 4 || out.length > 200) return out;
  let entries;
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(root, e.name);
    try {
      if (e.isDirectory()) findFilesRecursive(full, predicate, depth + 1, out);
      else if (predicate(full, e.name)) out.push(full);
    } catch {}
  }
  return out;
}

// Find unlocked achievements for a given Steam appId
async function getAchievementsForApp(appId) {
  const steamPath = await getSteamPath();
  if (!steamPath) return { error: 'Steam introuvable', steamPath: null, unlocked: [] };

  const users = listSteamUsers(steamPath);
  if (!users.length) return { error: 'Aucun utilisateur Steam', steamPath, unlocked: [] };

  const diagnostic = {
    steamPath,
    users: users.map((u) => path.basename(u)),
    searchedPaths: [],
    appFolders: [],
  };

  const allFiles = [];
  const appIdStr = String(appId);

  // 1. Standard path: userdata/<user>/<appid>/
  diagnostic.allFilesPerAppFolder = {};
  for (const userDir of users) {
    const appDir = path.join(userDir, appIdStr);
    diagnostic.searchedPaths.push(appDir);
    if (!fs.existsSync(appDir)) continue;
    diagnostic.appFolders.push(appDir);
    // List ALL files for diagnostic
    const allFound = findFilesRecursive(appDir, () => true);
    diagnostic.allFilesPerAppFolder[appDir] = allFound.map((f) => path.relative(appDir, f));
    // Parse all files small enough (any extension)
    const found = allFound.filter((f) => {
      try {
        const st = fs.statSync(f);
        return st.size > 0 && st.size < 5 * 1024 * 1024;
      } catch { return false; }
    });
    allFiles.push(...found);
  }

  // 2. Schema/cache path: appcache/stats/UserGameStatsSchema_<appid>.bin
  const schemaPath = path.join(steamPath, 'appcache', 'stats', `UserGameStatsSchema_${appIdStr}.bin`);
  diagnostic.searchedPaths.push(schemaPath);
  if (fs.existsSync(schemaPath)) {
    allFiles.push(schemaPath);
    diagnostic.hasSchema = true;
  }

  // 3. Legacy stats path: Steam/userdata/<user>/<appid>/remote, /local, etc.
  // already covered by recursive search above

  if (!allFiles.length) {
    return {
      error: `Aucun stats pour l'app ${appId}. V\u00e9rifie : (1) jeu lanc\u00e9 au moins une fois via Steam, (2) connexion online, (3) achievements activ\u00e9s.`,
      diagnostic,
      unlocked: [],
    };
  }

  // Pass 1: parse schema to collect achievement keys
  const schemaMap = new Map();
  const schemaFiles = allFiles.filter((f) => /Schema/i.test(f));
  const userFiles = allFiles.filter((f) => !/Schema/i.test(f));

  for (const file of schemaFiles) {
    const r = parseUserGameStatsBin(file);
    if (!r) continue;
    const { schemaMap: sm } = extractAchievementsFromVdf(r.parsed, true);
    for (const [k, v] of sm) schemaMap.set(k, v);
  }

  // Pass 2: parse user stats, cross-reference flat values with schema keys
  const knownKeys = new Set(schemaMap.keys());
  const unlockedByKey = new Map();

  diagnostic.userFlatKeysSample = [];
  for (const file of userFiles) {
    const r = parseUserGameStatsBin(file);
    if (!r) continue;
    const { unlocked, flatValues } = extractAchievementsFromVdf(r.parsed, false, knownKeys);
    for (const [k, u] of unlocked) {
      const prev = unlockedByKey.get(k);
      if (!prev || u.unlockTime > prev.unlockTime) {
        unlockedByKey.set(k, u);
      }
    }
    diagnostic.userFlatKeys = (diagnostic.userFlatKeys || 0) + flatValues.size;
    // Sample first 30 flat key=value pairs for debugging
    let i = 0;
    for (const [k, v] of flatValues) {
      if (i++ >= 30) break;
      diagnostic.userFlatKeysSample.push(`${k}=${v}`);
    }
  }
  diagnostic.userFiles = userFiles;
  diagnostic.schemaFiles = schemaFiles;

  // Build final list
  const allByKey = new Map();
  for (const [key, def] of schemaMap) {
    const u = unlockedByKey.get(key);
    allByKey.set(key, {
      key,
      display: def.display,
      description: def.description,
      unlocked: !!u,
      unlockTime: u?.unlockTime || 0,
    });
  }
  // Include unlocks that weren't in schema (rare)
  for (const [key, u] of unlockedByKey) {
    if (!allByKey.has(key)) {
      allByKey.set(key, { key, unlocked: true, unlockTime: u.unlockTime });
    }
  }

  return {
    steamPath,
    files: allFiles,
    diagnostic,
    unlocked: [...unlockedByKey.values()],
    allAchievements: [...allByKey.values()].slice(0, 500),
  };
}

module.exports = {
  getSteamPath,
  listSteamUsers,
  parseUserGameStatsBin,
  getAchievementsForApp,
};
