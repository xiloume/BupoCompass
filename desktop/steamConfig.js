const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

let cachedConfig = null;

// Langue utilisee pour les noms/descriptions des succes Steam.
const DEFAULT_LANG = 'french';

// Simple .env loader (no external dep)
function loadDotEnv(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function getUserDataConfigPath() {
  return path.join(app.getPath('userData'), 'steam-config.bin');
}

function loadFromDotEnv() {
  // Dev: project root. Packaged: next to the executable (asar is read-only).
  const roots = [path.resolve(__dirname, '..')];
  try {
    if (app?.isPackaged) roots.unshift(path.dirname(app.getPath('exe')));
  } catch {}
  let env = {};
  for (const root of roots) {
    env = {
      ...env,
      ...loadDotEnv(path.join(root, '.env')),
      ...loadDotEnv(path.join(root, '.env.local')),
    };
  }
  return {
    apiKey: env.STEAM_API_KEY || process.env.STEAM_API_KEY || '',
    steamId: env.STEAM_ID || process.env.STEAM_ID || '',
    lang: env.STEAM_LANG || process.env.STEAM_LANG || '',
    source: 'env',
  };
}

function loadFromUserData() {
  try {
    const file = getUserDataConfigPath();
    if (!fs.existsSync(file)) return null;
    if (!safeStorage.isEncryptionAvailable()) {
      // Fallback: plain JSON (less secure but works on systems without keychain)
      const raw = fs.readFileSync(file, 'utf8');
      const parsed = JSON.parse(raw);
      return { ...parsed, source: 'userdata-plain' };
    }
    const encrypted = fs.readFileSync(file);
    const decrypted = safeStorage.decryptString(encrypted);
    const parsed = JSON.parse(decrypted);
    return { ...parsed, source: 'userdata-encrypted' };
  } catch (e) {
    console.error('[steamConfig] failed to load user data:', e.message);
    return null;
  }
}

function getConfig({ refresh = false } = {}) {
  if (cachedConfig && !refresh) return cachedConfig;
  // Priority: .env (dev convenience) > userData (end-user storage)
  const envCfg = loadFromDotEnv();
  const userCfg = loadFromUserData();
  cachedConfig = {
    apiKey: envCfg.apiKey || userCfg?.apiKey || '',
    steamId: envCfg.steamId || userCfg?.steamId || '',
    lang: envCfg.lang || userCfg?.lang || DEFAULT_LANG,
    source: envCfg.apiKey || envCfg.steamId ? 'env' : userCfg?.source || 'empty',
  };
  return cachedConfig;
}

function getLang() {
  return getConfig().lang || DEFAULT_LANG;
}

function setConfig({ apiKey, steamId, lang }) {
  const file = getUserDataConfigPath();
  // Empty fields keep the previously stored value (the UI never pre-fills the
  // API key), so changing only the language doesn't wipe the credentials.
  const previous = loadFromUserData() || {};
  const data = JSON.stringify({
    apiKey: apiKey || previous.apiKey || '',
    steamId: steamId || previous.steamId || '',
    lang: lang || previous.lang || DEFAULT_LANG,
  });
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(data);
      fs.writeFileSync(file, encrypted);
    } else {
      fs.writeFileSync(file, data, 'utf8');
    }
    cachedConfig = null; // invalidate cache
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function getConfigStatus() {
  const cfg = getConfig({ refresh: true });
  return {
    hasApiKey: !!cfg.apiKey,
    hasSteamId: !!cfg.steamId,
    steamId: cfg.steamId, // safe to expose
    lang: cfg.lang || DEFAULT_LANG,
    source: cfg.source,
    apiKeyMasked: cfg.apiKey ? `${cfg.apiKey.slice(0, 4)}...${cfg.apiKey.slice(-4)}` : '',
  };
}

module.exports = { getConfig, setConfig, getConfigStatus, getLang, DEFAULT_LANG };
