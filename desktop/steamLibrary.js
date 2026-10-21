// Discover Steam-installed games on this machine, so we can auto-detect any
// running game (not just ones present in our registry.json).
//
// Pipeline:
//  1. Find Steam install path (registry/defaults)
//  2. Read libraryfolders.vdf to discover all Steam libraries
//  3. Read each library's appmanifest_<appid>.acf to list installed games
//  4. Scan <library>/steamapps/common/<installdir> for plausible .exe files
//  5. Cache the result on disk (TTL = 1h) to avoid repeated file IO

const fs = require('fs');
const path = require('path');
const { getSteamPath } = require('./steamScanner');

let _cache = null;
let _cacheAt = 0;
const TTL = 60 * 60 * 1000; // 1h

// --- Minimal text-VDF parser (handles libraryfolders.vdf + .acf) ---
function parseTextVdf(text) {
  const root = {};
  const stack = [root];
  let i = 0;
  const n = text.length;

  function skipWs() {
    while (i < n) {
      const c = text[i];
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
      if (c === '/' && text[i + 1] === '/') {
        while (i < n && text[i] !== '\n') i++;
        continue;
      }
      return;
    }
  }
  function readQuoted() {
    if (text[i] !== '"') return null;
    i++;
    let start = i;
    let s = '';
    while (i < n && text[i] !== '"') {
      if (text[i] === '\\' && i + 1 < n) {
        s += text.slice(start, i);
        const nxt = text[i + 1];
        s += nxt === 'n' ? '\n' : nxt === 't' ? '\t' : nxt;
        i += 2;
        start = i;
        continue;
      }
      i++;
    }
    s += text.slice(start, i);
    if (text[i] === '"') i++;
    return s;
  }

  while (i < n) {
    skipWs();
    if (i >= n) break;
    if (text[i] === '}') {
      i++;
      stack.pop();
      continue;
    }
    const key = readQuoted();
    if (key === null) { i++; continue; }
    skipWs();
    if (text[i] === '{') {
      i++;
      const obj = {};
      stack[stack.length - 1][key] = obj;
      stack.push(obj);
    } else {
      const val = readQuoted();
      stack[stack.length - 1][key] = val ?? '';
    }
  }
  return root;
}

function getLibraryPaths(steamPath) {
  const libs = new Set([steamPath]);
  const vdfPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf');
  if (!fs.existsSync(vdfPath)) return [...libs];
  try {
    const raw = fs.readFileSync(vdfPath, 'utf8');
    const parsed = parseTextVdf(raw);
    const root = parsed.libraryfolders || parsed.LibraryFolders || {};
    for (const k of Object.keys(root)) {
      const entry = root[k];
      if (entry && typeof entry === 'object' && entry.path) {
        libs.add(entry.path.replace(/\\\\/g, '\\'));
      } else if (typeof entry === 'string' && /^[a-zA-Z]:/.test(entry)) {
        // Old format: numeric key -> path string
        libs.add(entry);
      }
    }
  } catch (e) {
    console.warn('[SteamLibrary] failed to parse libraryfolders.vdf:', e.message);
  }
  return [...libs];
}

function listAppManifests(libraryPath) {
  const dir = path.join(libraryPath, 'steamapps');
  if (!fs.existsSync(dir)) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /^appmanifest_\d+\.acf$/i.test(f))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function readAppManifest(manifestPath) {
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const parsed = parseTextVdf(raw);
    const app = parsed.AppState || parsed.appstate;
    if (!app) return null;
    return {
      appId: Number(app.appid),
      name: app.name || `App ${app.appid}`,
      installDir: app.installdir || '',
    };
  } catch {
    return null;
  }
}

// Heuristic: identify .exe files that look like a real game launcher
const EXE_BLACKLIST = /(unins|crashpad|crash|setup|redist|directx|dxsetup|vcredist|dotnet|eac|easyanticheat|battleye|prereq|launcher|reporter|handler|webview|node)/i;

function scanExes(installRoot, maxDepth = 3) {
  const out = [];
  if (!fs.existsSync(installRoot)) return out;
  const stack = [{ dir: installRoot, depth: 0 }];
  while (stack.length) {
    const { dir, depth } = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.exe')) {
        if (EXE_BLACKLIST.test(e.name)) continue;
        out.push(e.name);
      }
    }
    if (out.length > 50) break; // safety cap
  }
  return [...new Set(out)];
}

async function listInstalledSteamGames({ scanExes: shouldScanExes = true } = {}) {
  if (_cache && Date.now() - _cacheAt < TTL) return _cache;
  const steamPath = await getSteamPath();
  if (!steamPath) {
    _cache = [];
    _cacheAt = Date.now();
    return _cache;
  }
  const libs = getLibraryPaths(steamPath);
  const games = [];
  for (const lib of libs) {
    for (const manifest of listAppManifests(lib)) {
      const m = readAppManifest(manifest);
      if (!m || !m.appId || !m.installDir) continue;
      // Skip Steamworks/redist apps
      if (m.appId < 10) continue;
      const installRoot = path.join(lib, 'steamapps', 'common', m.installDir);
      const exes = shouldScanExes ? scanExes(installRoot) : [];
      games.push({
        appId: m.appId,
        name: m.name,
        installDir: m.installDir,
        installRoot,
        exes,
      });
    }
  }
  _cache = games;
  _cacheAt = Date.now();
  console.log(`[SteamLibrary] indexed ${games.length} installed Steam games`);
  return games;
}

function invalidateCache() {
  _cache = null;
  _cacheAt = 0;
}

module.exports = {
  listInstalledSteamGames,
  invalidateCache,
};
