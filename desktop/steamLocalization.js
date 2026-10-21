// Localized achievement labels without a Steam API key.
//
// Why this module exists: the per-user endpoint
//   /profiles/<id>/stats/<appid>/achievements/?xml=1&l=<lang>
// silently IGNORES the `l` parameter and always answers in the game's default
// language (usually English). Verified: the french and english responses are
// byte-identical.
//
// The HTML pages however DO honour `l`:
//   /stats/<appid>/achievements/?l=<lang>                    (global)
//   /profiles/<id>/stats/<appid>/achievements/?l=<lang>      (per-user)
// but neither exposes `apiname`. So each page is fetched twice (target language
// + english) and both lists are zipped by index - valid because they come from
// the same endpoint and therefore share the same ordering. That yields
// `english label -> localized label`, which is then applied to the per-user XML
// entries (whose labels are english) to recover `apiname -> localized`.
//
// Both pages are needed: the global one lists every achievement but hides the
// description of HIDDEN ones, while the per-user one reveals the description of
// hidden achievements the player already unlocked.
//
// NB: zipping a page against the per-user XML by index would be WRONG, as the
// XML is ordered by unlock date while the pages are ordered by rarity.

const https = require('https');
const zlib = require('zlib');
const { URL } = require('url');

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const cache = new Map(); // `${appId}:${lang}` -> { at, labels }

function httpsGetText(url, timeoutMs = 15000, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BupoCompass/1.0',
          'Accept-Encoding': 'gzip, deflate',
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
          return httpsGetText(new URL(res.headers.location, url).href, timeoutMs, redirectsLeft - 1)
            .then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const enc = String(res.headers['content-encoding'] || '').toLowerCase();
        let stream = res;
        if (enc === 'gzip') stream = res.pipe(zlib.createGunzip());
        else if (enc === 'deflate') stream = res.pipe(zlib.createInflate());
        let body = '';
        stream.setEncoding('utf8');
        stream.on('data', (d) => (body += d));
        stream.on('end', () => resolve(body));
        stream.on('error', reject);
      }
    );
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('Timeout')));
  });
}

function stripHtml(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ordered list of { name, description } from an achievements page.
// Handles both markups: the global page uses `<div class="achieveRow">` while
// the per-user page prefixes other attributes: `<div data-panel="..."
// role="button" class="achieveRow">`. Headings may carry attributes too
// (`<h3 class="ellipsis">`).
function parseAchievementsPage(html) {
  const out = [];
  const chunks = String(html || '').split(/<div[^>]*class="achieveRow/);
  for (let i = 1; i < chunks.length; i++) {
    const c = chunks[i];
    const name = stripHtml((c.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || '');
    const description = stripHtml((c.match(/<h5[^>]*>([\s\S]*?)<\/h5>/) || [])[1] || '');
    if (!name) continue;
    out.push({ name, description });
  }
  return out;
}

function normalizeKey(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function globalPageUrl(appId, lang) {
  return `https://steamcommunity.com/stats/${encodeURIComponent(appId)}/achievements/?l=${encodeURIComponent(lang)}`;
}

function profilePageUrl(appId, steamId, lang) {
  return `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/stats/${encodeURIComponent(appId)}/achievements/?l=${encodeURIComponent(lang)}`;
}

// Fetch one page in both languages and zip them by index. Safe because both
// responses come from the same endpoint and therefore share the same ordering.
async function buildPairMap(urlFor, lang, label) {
  const [localizedHtml, englishHtml] = await Promise.all([
    httpsGetText(urlFor(lang)),
    httpsGetText(urlFor('english')),
  ]);
  const localized = parseAchievementsPage(localizedHtml);
  const english = parseAchievementsPage(englishHtml);

  if (!localized.length || localized.length !== english.length) {
    throw new Error(
      `${label} mismatch (${lang}=${localized.length}, english=${english.length})`
    );
  }

  const map = new Map();
  for (let i = 0; i < english.length; i++) {
    const k = normalizeKey(english[i].name);
    if (!k || map.has(k)) continue;
    map.set(k, {
      display: localized[i].name,
      description: localized[i].description || null,
    });
  }
  return map;
}

// Map: normalized english label -> { display, description } in `lang`.
//
// Two complementary sources are merged:
//  - the global page covers every achievement, but leaves the description of
//    HIDDEN achievements empty;
//  - the per-user page reveals the description of hidden achievements the
//    player has already unlocked (it also honours `l`), but omits the ones
//    still locked and hidden.
async function fetchLabelMap(appId, lang, steamId) {
  const key = `${appId}:${lang}:${steamId || ''}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.labels;

  const sources = [
    buildPairMap((l) => globalPageUrl(appId, l), lang, 'global page'),
  ];
  if (steamId) {
    sources.push(buildPairMap((l) => profilePageUrl(appId, steamId, l), lang, 'profile page'));
  }

  const results = await Promise.allSettled(sources);
  const maps = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  for (const r of results) {
    if (r.status === 'rejected') console.warn(`[steamLocalization] ${r.reason.message}`);
  }
  if (!maps.length) throw new Error(results[0]?.reason?.message || 'no source available');

  const labels = new Map();
  for (const map of maps) {
    for (const [k, v] of map) {
      const cur = labels.get(k);
      if (!cur) {
        labels.set(k, { ...v });
        continue;
      }
      // Later sources only fill in what is still missing.
      if (!cur.description && v.description) cur.description = v.description;
      if (!cur.display && v.display) cur.display = v.display;
    }
  }

  cache.set(key, { at: Date.now(), labels });
  return labels;
}

// Translate achievements whose `display`/`description` are in english.
// Always resolves: on any failure the input is returned untouched.
async function localizeAchievements(appId, achievements, lang, steamId) {
  if (!Array.isArray(achievements) || !achievements.length) return achievements;
  if (!lang || lang === 'english') return achievements;

  let labels;
  try {
    labels = await fetchLabelMap(appId, lang, steamId);
  } catch (e) {
    console.warn(`[steamLocalization] ${appId} ${lang}: ${e.message}`);
    return achievements;
  }

  let translated = 0;
  let untranslatedDesc = 0;
  const out = achievements.map((a) => {
    const hit = labels.get(normalizeKey(a.display));
    if (!hit || !hit.display) return a;
    translated++;
    // No localized description available (hidden and still locked): keep the
    // original rather than showing nothing.
    if (!hit.description && a.description) untranslatedDesc++;
    return {
      ...a,
      display: hit.display,
      description: hit.description || a.description || null,
    };
  });
  console.log(
    `[steamLocalization] ${appId} -> ${lang}: ${translated}/${achievements.length} labels` +
      (untranslatedDesc ? `, ${untranslatedDesc} description(s) left untranslated` : '')
  );
  return out;
}

module.exports = {
  localizeAchievements,
  parseAchievementsPage,
  fetchLabelMap,
};
