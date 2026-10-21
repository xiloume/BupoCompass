// Auto-generate checklist templates from Steam achievement schemas.
// Works for ANY Steam game by:
//   1. Looking up the game's appId (from registry or via Steam search API)
//   2. Fetching the achievement schema (display names + descriptions)
//   3. Grouping achievements into zones via heuristics
//   4. Returning a ready-to-import template

const https = require('https');
const http = require('http');
const zlib = require('zlib');
const { URL } = require('url');
const { fetchGameSchema, fetchPublicAchievements } = require('./steamWebApi');
const { getConfig, getLang } = require('./steamConfig');

function httpsGetJson(url, timeoutMs = 45000, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch (e) { return reject(e); }
    const lib = u.protocol === 'http:' ? http : https;

    const req = lib.get(
      url,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 BupoCompass/1.0',
          'Accept': 'application/json,*/*',
          'Accept-Encoding': 'gzip, deflate',
        },
      },
      (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
          const next = new URL(res.headers.location, url).toString();
          return resolve(httpsGetJson(next, timeoutMs, redirectsLeft - 1));
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} on ${url}`));
        }
        const enc = (res.headers['content-encoding'] || '').toLowerCase();
        let stream = res;
        if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());

        const chunks = [];
        stream.on('data', (c) => chunks.push(c));
        stream.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error('Invalid JSON response: ' + e.message));
          }
        });
        stream.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

// Categorization heuristics. Order matters: first matching wins.
const CATEGORIES = [
  {
    name: 'Histoire principale',
    keywords: ['story', 'chapter', 'act ', 'campaign', 'main quest', 'epilogue', 'prologue', 'ending', 'finale', 'beat the game', 'complete the game', 'finish the game', 'credits', 'histoire', 'chapitre', 'fin du jeu', 'terminer le jeu'],
  },
  {
    name: 'Boss & combats',
    keywords: ['boss', 'defeat', 'kill', 'slay', 'vanquish', 'eliminate', 'destroy', 'duel', 'battle', 'fight', 'tuer', 'vaincre', 'eliminer', 'detruire'],
  },
  {
    name: 'Exploration',
    keywords: ['discover', 'find', 'explore', 'reach', 'visit', 'unlock', 'open', 'enter', 'arrive', 'locate', 'decouvrir', 'trouver', 'explorer', 'atteindre', 'visiter'],
  },
  {
    name: 'Collection',
    keywords: ['collect', 'gather', 'obtain', 'acquire', 'pickup', 'pick up', 'all ', 'every ', 'complete the collection', 'collecter', 'ramasser', 'obtenir', 'acquerir', 'tous les', 'toutes les'],
  },
  {
    name: 'Quêtes secondaires',
    keywords: ['side', 'optional', 'bonus', 'extra', 'sidequest', 'side quest', 'secondaire', 'optionnel'],
  },
  {
    name: 'Craft & construction',
    keywords: ['craft', 'build', 'create', 'forge', 'cook', 'brew', 'smelt', 'construire', 'fabriquer', 'forger', 'cuisiner'],
  },
  {
    name: 'Progression & niveaux',
    keywords: ['level', 'rank', 'experience', 'master', 'expert', 'tier', 'upgrade', 'skill', 'niveau', 'maitre', 'ameliorer'],
  },
  {
    name: 'Multijoueur & social',
    keywords: ['multiplayer', 'coop', 'co-op', 'pvp', 'online', 'friend', 'team', 'multijoueur', 'ami', 'equipe'],
  },
  {
    name: 'Difficulté',
    keywords: ['hard', 'difficult', 'hardcore', 'nightmare', 'permadeath', 'no death', 'ironman', 'without dying', 'sans mourir', 'cauchemar'],
  },
];

function categorizeAchievement(ach) {
  const text = `${ach.display || ''} ${ach.description || ''}`.toLowerCase();
  for (const cat of CATEGORIES) {
    for (const kw of cat.keywords) {
      if (text.includes(kw)) return cat.name;
    }
  }
  return 'Autres';
}

// Build a checklist template from a Steam achievement schema
function buildTemplateFromSchema(schema, options = {}) {
  const { includeHidden = true, maxPerZone = 100 } = options;
  const zones = new Map(); // name -> [items]

  for (const ach of schema) {
    if (!includeHidden && ach.hidden) continue;
    const zoneName = categorizeAchievement(ach);
    if (!zones.has(zoneName)) zones.set(zoneName, []);
    const arr = zones.get(zoneName);
    if (arr.length < maxPerZone) {
      arr.push({
        name: ach.display || ach.key,
        steamKey: ach.key,
        description: ach.description || null,
        hidden: !!ach.hidden,
      });
    }
  }

  // Order zones: histoire first, autres last
  const orderedNames = [
    ...CATEGORIES.map((c) => c.name).filter((n) => zones.has(n)),
    ...(zones.has('Autres') ? ['Autres'] : []),
  ];

  return {
    zones: orderedNames.map((name) => ({ name, items: zones.get(name) })),
    totalAchievements: schema.length,
    generatedAt: new Date().toISOString(),
  };
}

// Build steamAchievementMap from schema (key -> display name)
function buildAchievementMap(schema) {
  const map = {};
  for (const ach of schema) {
    if (ach.key && ach.display) map[ach.key] = ach.display;
  }
  return map;
}

// Build steamAchievementDescriptions from schema (key -> localized description)
function buildDescriptionMap(schema) {
  const map = {};
  for (const ach of schema) {
    if (ach.key && ach.description) map[ach.key] = ach.description;
  }
  return map;
}

// Main entry: generate a full registry entry from a Steam appId.
// Tries the official Web API schema first (requires API key); falls back to the
// public profile XML achievements list (just needs a SteamID + public profile).
async function generateTemplateForAppId(appId, opts = {}) {
  const cfg = getConfig();
  const lang = opts.lang || getLang();
  let schema = null;
  const errors = [];

  if (cfg.apiKey) {
    try {
      schema = await fetchGameSchema(appId, lang);
    } catch (e) {
      errors.push(`API: ${e.message}`);
    }
  }

  if ((!schema || !schema.length) && cfg.steamId) {
    try {
      const r = await fetchPublicAchievements(appId, lang);
      // fetchPublicAchievements returns achievements with key/display/description
      schema = (r.achievements || []).map((a) => ({
        key: a.key,
        display: a.display,
        description: a.description,
        hidden: false,
      }));
    } catch (e) {
      errors.push(`Public: ${e.message}`);
    }
  }

  if (!schema || !schema.length) {
    const reason = errors.length ? errors.join(' | ') : 'aucune source disponible';
    throw new Error(
      `Impossible de recuperer les achievements (${reason}). Configure une cle API Steam ou un SteamID avec profil public.`
    );
  }

  const template = buildTemplateFromSchema(schema, opts);
  const achievementMap = buildAchievementMap(schema);
  return {
    steamAppId: appId,
    lang,
    checklistTemplate: template,
    steamAchievementMap: achievementMap,
    steamAchievementDescriptions: buildDescriptionMap(schema),
    achievementCount: schema.length,
  };
}

// Search Steam games via the official Steam Community live search endpoint.
// No API key, no huge app-list download, fuzzy matching done server-side.
async function searchSteamGames(query, limit = 20) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const url = `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(q)}`;
  try {
    const data = await httpsGetJson(url, 10000);
    // Response shape: [{ appid: "123", name: "..", icon: "..", logo: ".." }, ...]
    const arr = Array.isArray(data) ? data : [];
    const seen = new Set();
    const out = [];
    for (const r of arr) {
      const appId = Number(r.appid);
      const name = r.name;
      if (!appId || !name) continue;
      if (seen.has(appId)) continue;
      seen.add(appId);
      // Filter common non-game noise (still keep DLCs if user wants)
      if (/(soundtrack|server|dedicated|sdk|trailer)/i.test(name)) continue;
      out.push({ appId, name, logo: r.logo || null });
      if (out.length >= limit) break;
    }
    return out;
  } catch (e) {
    console.warn('[templates] SearchApps failed:', e.message);
    throw e;
  }
}

module.exports = {
  buildTemplateFromSchema,
  buildAchievementMap,
  buildDescriptionMap,
  generateTemplateForAppId,
  searchSteamGames,
  categorizeAchievement,
};
