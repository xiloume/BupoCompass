const fs = require('fs');
const path = require('path');
const { resolveEnvPath } = require('./gameDetector');
const { detectFormat } = require('./formatDetector');
const { gameParsers } = require('./fileParsers');

// Recursively list files matching a glob-like pattern (* and ** supported)
function globSearch(rootDir, pattern, results = [], depth = 0) {
  if (depth > 8) return results; // safety
  if (!fs.existsSync(rootDir)) return results;

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    try {
      if (entry.isDirectory()) {
        globSearch(full, pattern, results, depth + 1);
      } else if (matchesPattern(full, pattern, rootDir)) {
        results.push(full);
      }
    } catch {
      // ignore unreadable entries
    }
  }
  return results;
}

function matchesPattern(filePath, pattern, root) {
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const re = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '.+')
        .replace(/\*/g, '[^/]*') +
      '$'
  );
  return re.test(rel);
}

// Auto-pick a parser based on detected format
function autoParser(format) {
  switch (format) {
    case 'json': return 'genericJSON';
    case 'xml': return 'genericXML';
    case 'yaml': return 'genericYAML';
    case 'toml': return 'genericTOML';
    case 'ini': return 'genericINI';
    case 'csv': return 'genericCSV';
    case 'nbt': return 'genericNBT';
    case 'zip': return 'genericZIP';
    case 'gzip': return 'genericNBT'; // often gzipped NBT
    case 'sqlite': return 'sqlitePresence';
    default: return 'none';
  }
}

const MAX_FILES_PER_TARGET = 200;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

async function runParser(parserName, file) {
  const parser = gameParsers[parserName] || gameParsers.none;
  try {
    const result = parser(file);
    return result instanceof Promise ? await result : result;
  } catch {
    return null;
  }
}

// Run a scan for a detected game
async function scanGame(game) {
  const found = {
    gameId: game.id,
    gameName: game.name,
    files: [],
    aggregated: { items: [] },
  };

  for (const location of game.saveLocations || []) {
    const root = resolveEnvPath(location);
    if (!root || !fs.existsSync(root)) continue;

    for (const target of game.scanTargets || []) {
      const matches = globSearch(root, target.pattern).slice(0, MAX_FILES_PER_TARGET);

      for (const file of matches) {
        let stats;
        try { stats = fs.statSync(file); } catch { continue; }
        if (stats.size > MAX_FILE_SIZE_BYTES) continue;

        // Determine parser: explicit > auto-detected by magic bytes
        let parserName = target.parser;
        let format = target.format;

        if (!parserName || parserName === 'auto') {
          format = detectFormat(file);
          parserName = autoParser(format);
        }

        const parsed = await runParser(parserName, file);
        // Always record file presence, even if parser returned nothing
        const data = parsed || {
          summary: { file: path.basename(file), size: stats.size },
          items: [],
          note: `Parser "${parserName}" could not extract data`,
        };
        found.files.push({
          path: file,
          format,
          parser: parserName,
          data,
        });
        if (Array.isArray(data.items) && data.items.length) {
          found.aggregated.items.push(...data.items);
        }
      }
    }
  }

  return found;
}

// Generic scan: walk a directory, auto-detect every file
async function scanDirectoryAuto(root, opts = {}) {
  const maxFiles = opts.maxFiles || 500;
  const maxDepth = opts.maxDepth || 5;
  const result = { root, files: [], aggregated: { items: [] } };

  function walk(dir, depth) {
    if (depth > maxDepth) return;
    if (result.files.length >= maxFiles) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (result.files.length >= maxFiles) return;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else result.files.push(full);
    }
  }

  if (!fs.existsSync(root)) return result;
  walk(root, 0);

  const detailed = [];
  for (const file of result.files) {
    let stats;
    try { stats = fs.statSync(file); } catch { continue; }
    if (stats.size > MAX_FILE_SIZE_BYTES) continue;

    const format = detectFormat(file);
    const parserName = autoParser(format);
    const parsed = await runParser(parserName, file);
    if (parsed) {
      detailed.push({ path: file, format, parser: parserName, data: parsed });
      if (Array.isArray(parsed.items) && parsed.items.length) {
        result.aggregated.items.push(...parsed.items);
      }
    }
  }

  result.files = detailed;
  return result;
}

module.exports = {
  scanGame,
  scanDirectoryAuto,
  parsers: gameParsers,
  globSearch,
  autoParser,
};
