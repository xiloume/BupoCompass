const https = require('https');
const { getConfig, getLang } = require('./steamConfig');
const { localizeAchievements } = require('./steamLocalization');

function httpsGet(url, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'BupoCompass/1.0' } }, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return resolve(httpsGet(res.headers.location, timeoutMs));
      }
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        resolve(body);
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Steam timeout'));
    });
  });
}

async function httpsGetJson(url, timeoutMs = 8000) {
  const body = await httpsGet(url, timeoutMs);
  try {
    return JSON.parse(body);
  } catch (e) {
    throw new Error('Invalid JSON: ' + e.message);
  }
}

// Parse Steam community XML achievements page (works for PUBLIC profiles only, no API key required)
function parsePublicAchievementsXml(xml) {
  // Detect privacy / errors first
  if (/<error>/i.test(xml)) {
    const m = xml.match(/<error>([^<]+)<\/error>/i);
    throw new Error(m ? m[1].trim() : 'Profil Steam priv\u00e9 ou inaccessible');
  }

  const achievements = [];
  // Attributes must be matched loosely: Steam may emit extra ones (and in any
  // order) on <achievement>, e.g. closed="1" unlockTimestamp="...".
  const blockRe = /<achievement\b([^>]*)>([\s\S]*?)<\/achievement>/g;
  let m;
  while ((m = blockRe.exec(xml)) !== null) {
    const attrs = m[1] || '';
    const inner = m[2];
    const attr = (name) => {
      const mm = attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, 'i'));
      return mm ? mm[1].trim() : '';
    };
    const get = (tag) => {
      const r = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
      const mm = inner.match(r);
      return mm ? (mm[1] ?? mm[2] ?? '').trim() : '';
    };
    const apiname = get('apiname');
    const display = get('name');
    const description = get('description');
    const ts = parseInt(get('unlockTimestamp') || attr('unlockTimestamp'), 10) || 0;
    const closedAttr = attr('closed');
    // No `closed` attribute at all: fall back to the presence of an unlock date.
    const closed = closedAttr ? closedAttr === '1' : ts > 0;
    if (!apiname && !display) continue;
    achievements.push({
      key: apiname || display,
      display: display || apiname,
      description: description || null,
      unlocked: closed,
      unlockTime: ts,
    });
  }
  return achievements;
}

// Fetch achievements from PUBLIC Steam profile (no API key required)
async function fetchPublicAchievements(appId, lang) {
  lang = lang || getLang();
  const { steamId } = getConfig();
  if (!steamId) throw new Error('SteamID non configur\u00e9');
  const url = `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/stats/${encodeURIComponent(appId)}/achievements/?xml=1`;
  const xml = await httpsGet(url);
  const parsed = parsePublicAchievementsXml(xml);
  // This endpoint ignores `l` and always answers in the game's default
  // language, so the labels have to be translated separately.
  const achievements = await localizeAchievements(appId, parsed, lang, steamId);
  return {
    appId,
    achievements,
    unlocked: achievements.filter((a) => a.unlocked),
    source: 'steam-public-profile',
  };
}

// GET https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/
//   ?key=<apikey>&steamid=<steamid>&appid=<appid>&l=french
async function fetchPlayerAchievements(appId, lang) {
  lang = lang || getLang();
  const { apiKey, steamId } = getConfig();
  if (!apiKey) throw new Error('Steam API key manquante (config dans .env ou settings)');
  if (!steamId) throw new Error('SteamID manquant (config dans .env ou settings)');

  const url =
    `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&steamid=${encodeURIComponent(steamId)}` +
    `&appid=${encodeURIComponent(appId)}` +
    `&l=${encodeURIComponent(lang)}`;

  const data = await httpsGetJson(url);
  if (!data?.playerstats) {
    throw new Error('Reponse Steam invalide');
  }
  if (data.playerstats.success === false) {
    throw new Error(data.playerstats.error || 'Steam API error');
  }
  // achievements: [{ apiname, achieved, unlocktime, name, description }, ...]
  const achievements = (data.playerstats.achievements || []).map((a) => ({
    key: a.apiname,
    display: a.name || null,
    description: a.description || null,
    unlocked: a.achieved === 1,
    unlockTime: a.unlocktime || 0,
  }));
  return {
    gameName: data.playerstats.gameName,
    appId,
    achievements,
    unlocked: achievements.filter((a) => a.unlocked),
    source: 'steam-web-api',
  };
}

// GET schema (display names, descriptions) - useful when user has no unlocks yet
// https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=XXX&appid=YYY
async function fetchGameSchema(appId, lang) {
  lang = lang || getLang();
  const { apiKey } = getConfig();
  if (!apiKey) throw new Error('Steam API key manquante');
  const url =
    `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&appid=${encodeURIComponent(appId)}` +
    `&l=${encodeURIComponent(lang)}`;
  const data = await httpsGetJson(url);
  const list = data?.game?.availableGameStats?.achievements || [];
  return list.map((a) => ({
    key: a.name,
    display: a.displayName,
    description: a.description,
    icon: a.icon,
    iconGray: a.icongray,
    hidden: a.hidden === 1,
  }));
}

module.exports = { fetchPlayerAchievements, fetchGameSchema, fetchPublicAchievements };
