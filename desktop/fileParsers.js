const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { tryGunzip } = require('./formatDetector');

// Lazy-load heavy deps so missing packages don't crash the app
function safeRequire(name) {
  try {
    return require(name);
  } catch {
    return null;
  }
}

// =========================================================================
// Generic format parsers
// =========================================================================

function parseJSON(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    // Strip BOM
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return null;
  }
}

function parseXML(filePath) {
  const fxp = safeRequire('fast-xml-parser');
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    if (fxp) {
      const parser = new fxp.XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseAttributeValue: true,
      });
      return parser.parse(text);
    }
    // Fallback: lightweight regex-based extraction
    return parseXMLFallback(text);
  } catch {
    return null;
  }
}

function parseXMLFallback(text) {
  const result = {};
  const tagRe = /<([A-Za-z_][\w-]*)[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    const [, tag, value] = m;
    result[tag] = value.trim();
  }
  return result;
}

function parseYAML(filePath) {
  const yaml = safeRequire('yaml');
  if (!yaml) return null;
  try {
    return yaml.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function parseTOML(filePath) {
  const toml = safeRequire('smol-toml');
  if (!toml) return null;
  try {
    return toml.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function parseINI(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const result = {};
    let section = '_';
    text.split(/\r?\n/).forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith(';') || line.startsWith('#')) return;
      const sec = line.match(/^\[(.+)\]$/);
      if (sec) {
        section = sec[1];
        result[section] = result[section] || {};
        return;
      }
      const kv = line.match(/^([^=]+)=(.*)$/);
      if (kv) {
        if (!result[section]) result[section] = {};
        result[section][kv[1].trim()] = kv[2].trim().replace(/^"|"$/g, '');
      }
    });
    return result;
  } catch {
    return null;
  }
}

function parseCSV(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 1) return null;
    const headers = splitCSVLine(lines[0]);
    return lines.slice(1).map((line) => {
      const cells = splitCSVLine(line);
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = cells[i] ?? '';
      });
      return obj;
    });
  } catch {
    return null;
  }
}

function splitCSVLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

async function parseNBT(filePath) {
  const nbt = safeRequire('prismarine-nbt');
  if (!nbt) return null;
  try {
    let data = fs.readFileSync(filePath);
    // Many NBT files are gzipped
    if (data[0] === 0x1f && data[1] === 0x8b) {
      data = zlib.gunzipSync(data);
    }
    const { parsed } = await nbt.parse(data);
    return nbt.simplify(parsed);
  } catch {
    return null;
  }
}

async function parseZIP(filePath) {
  const yauzl = safeRequire('yauzl');
  if (!yauzl) return null;
  return new Promise((resolve) => {
    yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return resolve(null);
      const entries = [];
      zipfile.on('entry', (entry) => {
        entries.push({
          name: entry.fileName,
          size: entry.uncompressedSize,
          compressed: entry.compressedSize,
        });
        zipfile.readEntry();
      });
      zipfile.on('end', () => resolve({ entries, count: entries.length }));
      zipfile.on('error', () => resolve(null));
      zipfile.readEntry();
    });
  });
}

function parseGZIP(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    const inflated = zlib.gunzipSync(data);
    // Try as text/JSON
    try {
      return JSON.parse(inflated.toString('utf8'));
    } catch {
      return { decompressedSize: inflated.length, sample: inflated.slice(0, 200).toString('utf8') };
    }
  } catch {
    return null;
  }
}

function parseSQLitePresence(filePath) {
  // Just acknowledge SQLite without depending on better-sqlite3
  try {
    const stats = fs.statSync(filePath);
    return {
      file: path.basename(filePath),
      size: stats.size,
      note: 'SQLite database detected (no parsing without better-sqlite3 dep)',
    };
  } catch {
    return null;
  }
}

// =========================================================================
// Game-specific parsers
// =========================================================================

const gameParsers = {
  // ----- Minecraft -----
  minecraftStats: (file) => {
    const data = parseJSON(file);
    if (!data?.stats) return null;
    const items = [];
    for (const [category, entries] of Object.entries(data.stats)) {
      const catName = category.replace('minecraft:', '');
      for (const [key, count] of Object.entries(entries)) {
        items.push({
          category: catName,
          name: key.replace('minecraft:', ''),
          current: count,
          total: count,
        });
      }
    }
    return { summary: { categories: Object.keys(data.stats).length, items: items.length }, items };
  },

  minecraftAdvancements: (file) => {
    const data = parseJSON(file);
    if (!data) return null;
    const items = [];
    for (const [adv, info] of Object.entries(data)) {
      if (typeof info !== 'object' || !info.criteria) continue;
      items.push({
        category: 'Advancement',
        name: adv.replace('minecraft:', ''),
        current: info.done ? 1 : 0,
        total: 1,
      });
    }
    return { summary: { totalAdvancements: items.length }, items };
  },

  minecraftLevel: async (file) => {
    const data = await parseNBT(file);
    if (!data) return null;
    return {
      summary: {
        levelName: data.LevelName || data.Data?.LevelName,
        version: data.Version?.Name || data.Data?.Version?.Name,
        gameTime: data.Time || data.Data?.Time,
        difficulty: data.Difficulty ?? data.Data?.Difficulty,
      },
      items: [],
    };
  },

  // ----- Stardew Valley -----
  stardewSave: (file) => {
    const data = parseXML(file);
    if (!data) return null;
    const root = data.SaveGameInfo || data.Farmer || data;
    return {
      summary: {
        farmer: root.name || 'Unknown',
        farm: root.farmName || '',
        date: root.saveTime || '',
        gold: root.money || 0,
      },
      items: [],
    };
  },

  // ----- RimWorld (XML saves) -----
  rimworldSave: (file) => {
    const data = parseXML(file);
    if (!data?.savegame) return null;
    const game = data.savegame.game || {};
    return {
      summary: {
        version: data.savegame.meta?.gameVersion,
        ticks: game.tickManager?.ticksGame,
        scenario: game.scenario?.name,
      },
      items: [],
    };
  },

  // ----- Factorio (zip with JSON inside) -----
  factorioSave: async (file) => {
    const zip = await parseZIP(file);
    if (!zip) return null;
    return {
      summary: {
        files: zip.count,
        hasLevel: zip.entries.some((e) => e.name.endsWith('level.dat')),
      },
      items: [],
    };
  },

  // ----- Cities: Skylines (gzipped XML) -----
  citiesSkylinesSave: (file) => {
    const data = parseGZIP(file);
    if (!data) return null;
    return { summary: { decompressed: data.decompressedSize || 'unknown' }, items: [] };
  },

  // ----- Don't Starve / Together (Lua-like text) -----
  dontStarveSave: (file) => {
    try {
      const text = fs.readFileSync(file, 'utf8');
      const charMatch = text.match(/character_name\s*=\s*"([^"]+)"/);
      const dayMatch = text.match(/day\s*=\s*(\d+)/);
      return {
        summary: {
          character: charMatch?.[1],
          day: dayMatch?.[1] ? parseInt(dayMatch[1]) : null,
          size: text.length,
        },
        items: [],
      };
    } catch {
      return null;
    }
  },

  // ----- Graveyard Keeper (gzipped JSON) -----
  graveyardKeeperSave: (file) => {
    try {
      let data = fs.readFileSync(file);
      // Try gzip
      if (data[0] === 0x1f && data[1] === 0x8b) {
        try { data = zlib.gunzipSync(data); } catch {}
      }
      let parsed;
      try {
        parsed = JSON.parse(data.toString('utf8'));
      } catch {
        return {
          summary: { file: path.basename(file), size: data.length },
          items: [],
          note: 'Save file is encrypted or in an unknown binary format',
        };
      }

      // Extract collectibles, technologies, quests if present
      const items = [];
      if (Array.isArray(parsed?.tech)) {
        parsed.tech.forEach((t) => {
          items.push({
            category: 'Technology',
            name: t.id || t.name || 'unknown',
            current: t.unlocked || t.learned ? 1 : 0,
            total: 1,
          });
        });
      }
      if (Array.isArray(parsed?.quests)) {
        parsed.quests.forEach((q) => {
          items.push({
            category: 'Quest',
            name: q.id || q.name || 'unknown',
            current: q.completed ? 1 : 0,
            total: 1,
          });
        });
      }
      if (Array.isArray(parsed?.collected_items)) {
        parsed.collected_items.forEach((c) => {
          items.push({
            category: 'Collected',
            name: typeof c === 'string' ? c : c.id || 'unknown',
            current: 1,
            total: 1,
          });
        });
      }
      // Fallback: heuristic walk
      if (items.length === 0) {
        items.push(...extractItemsFromObject(parsed));
      }

      return {
        summary: {
          player: parsed?.player_name || parsed?.name,
          day: parsed?.day || parsed?.game_day,
          money: parsed?.money,
          version: parsed?.version,
        },
        items,
      };
    } catch {
      return null;
    }
  },

  // ----- Steam achievements (UserGameStats) -----
  steamAchievements: (file) => {
    try {
      const text = fs.readFileSync(file, 'utf8');
      const achievements = [];
      const re = /"([^"]+)"\s*\{\s*"HasPrestige"\s*"(\d+)"/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        achievements.push({
          category: 'Achievement',
          name: m[1],
          current: parseInt(m[2]) > 0 ? 1 : 0,
          total: 1,
        });
      }
      return { summary: { count: achievements.length }, items: achievements };
    } catch {
      return null;
    }
  },

  // ----- Skyrim/Fallout 4 SKSE cosaves (binary, just presence) -----
  bethesdaSave: (file) => {
    try {
      const stats = fs.statSync(file);
      return {
        summary: { file: path.basename(file), size: stats.size },
        items: [],
        note: 'Bethesda save format - encrypted, only presence reported',
      };
    } catch {
      return null;
    }
  },

  // ----- Generic by format -----
  genericJSON: (file) => {
    const data = parseJSON(file);
    return data ? { raw: data, items: extractItemsFromObject(data) } : null;
  },

  genericXML: (file) => {
    const data = parseXML(file);
    return data ? { raw: data, items: extractItemsFromObject(data) } : null;
  },

  genericYAML: (file) => {
    const data = parseYAML(file);
    return data ? { raw: data, items: extractItemsFromObject(data) } : null;
  },

  genericTOML: (file) => {
    const data = parseTOML(file);
    return data ? { raw: data, items: extractItemsFromObject(data) } : null;
  },

  genericINI: (file) => {
    const data = parseINI(file);
    return data ? { raw: data, items: [] } : null;
  },

  genericCSV: (file) => {
    const rows = parseCSV(file);
    if (!rows) return null;
    const items = rows
      .filter((r) => r.name || r.Name || r.item)
      .map((r) => ({
        category: r.category || r.Category || 'CSV',
        name: r.name || r.Name || r.item,
        current: parseInt(r.current || r.have || r.collected || 0),
        total: parseInt(r.total || r.max || 1),
      }));
    return { summary: { rows: rows.length }, items };
  },

  genericNBT: async (file) => {
    const data = await parseNBT(file);
    return data ? { raw: data, items: [] } : null;
  },

  genericZIP: async (file) => {
    const data = await parseZIP(file);
    return data ? { summary: { entries: data.count }, items: [] } : null;
  },

  sqlitePresence: parseSQLitePresence,

  // Last resort: just file metadata
  none: (file) => {
    try {
      const stats = fs.statSync(file);
      return {
        summary: {
          file: path.basename(file),
          size: stats.size,
          modified: stats.mtime.toISOString(),
        },
        items: [],
        note: 'Binary/unknown format - only metadata reported',
      };
    } catch {
      return null;
    }
  },
};

// Heuristic: walk an object tree looking for collectible-shaped data
function extractItemsFromObject(obj, items = [], depth = 0, parent = '') {
  if (depth > 4 || !obj) return items;
  if (typeof obj !== 'object') return items;

  if (Array.isArray(obj)) {
    obj.forEach((entry) => {
      if (entry && typeof entry === 'object') {
        const name = entry.name || entry.id || entry.title;
        if (name && typeof name === 'string') {
          items.push({
            category: parent || 'Items',
            name,
            current: entry.collected || entry.unlocked || entry.owned ? 1 : 0,
            total: entry.total || entry.max || 1,
          });
        } else {
          extractItemsFromObject(entry, items, depth + 1, parent);
        }
      }
    });
  } else {
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === 'object') {
        extractItemsFromObject(val, items, depth + 1, key);
      }
    }
  }
  return items;
}

module.exports = {
  // Generic
  parseJSON,
  parseXML,
  parseYAML,
  parseTOML,
  parseINI,
  parseCSV,
  parseNBT,
  parseZIP,
  parseGZIP,
  parseSQLitePresence,
  // Game-specific + named
  gameParsers,
  extractItemsFromObject,
};
