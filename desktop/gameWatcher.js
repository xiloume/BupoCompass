const fs = require('fs');
const path = require('path');
const { resolveEnvPath } = require('./gameDetector');
const { scanGame } = require('./gameScanner');
const { getAchievementsForApp } = require('./steamScanner');

// Map<gameId, { timers, lastScan, watchers }>
const activeWatches = new Map();

function listSaveFiles(game) {
  const files = [];
  for (const loc of game.saveLocations || []) {
    const root = resolveEnvPath(loc);
    if (!root || !fs.existsSync(root)) continue;
    walkCollect(root, files, 0);
  }
  return files;
}

function walkCollect(dir, out, depth) {
  if (depth > 6 || out.length > 1000) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    try {
      if (e.isDirectory()) walkCollect(full, out, depth + 1);
      else out.push(full);
    } catch {}
  }
}

// Diff two scan results (items by category+name)
function diffScans(prev, next) {
  const changes = { added: [], incremented: [], unchanged: 0 };
  if (!prev) return { added: next.aggregated.items, incremented: [], unchanged: 0 };

  const prevMap = new Map();
  prev.aggregated.items.forEach((it) => {
    const key = `${it.category || ''}|${it.name}`;
    prevMap.set(key, it.current || 0);
  });

  next.aggregated.items.forEach((it) => {
    const key = `${it.category || ''}|${it.name}`;
    const before = prevMap.get(key);
    const after = it.current || 0;
    if (before === undefined) {
      changes.added.push(it);
    } else if (after > before) {
      changes.incremented.push({ ...it, delta: after - before, before, after });
    } else {
      changes.unchanged++;
    }
  });

  return changes;
}

// Start watching a game's save locations; emits via callback
function startWatching(game, onChange, opts = {}) {
  stopWatching(game.id);

  const debounceMs = opts.debounceMs || 1500;
  const pollMs = opts.pollMs || 5000;
  const state = {
    gameId: game.id,
    lastScan: null,
    lastFileSizes: new Map(),
    timers: { debounce: null, poll: null },
    watchers: [],
  };

  // Initial scan
  scanGame(game).then((result) => {
    state.lastScan = result;
    listSaveFiles(game).forEach((f) => {
      try { state.lastFileSizes.set(f, fs.statSync(f).size); } catch {}
    });
  });

  const triggerCheck = () => {
    if (state.timers.debounce) clearTimeout(state.timers.debounce);
    state.timers.debounce = setTimeout(async () => {
      try {
        const result = await scanGame(game);
        const diff = diffScans(state.lastScan, result);
        const fileChanges = detectFileChanges(state, game);

        // Also pull Steam achievements if available
        let steam = null;
        if (game.steamAppId) {
          try {
            steam = await getAchievementsForApp(game.steamAppId);
            steam.map = game.steamAchievementMap || {};
          } catch (e) {
            console.error('[GameWatcher] steam scan failed:', e.message);
          }
        }

        if (diff.added.length || diff.incremented.length || fileChanges.length || steam) {
          onChange({
            gameId: game.id,
            gameName: game.name,
            timestamp: Date.now(),
            diff,
            fileChanges,
            scan: result,
            steam,
          });
        }
        state.lastScan = result;
      } catch (e) {
        console.error('[GameWatcher] scan failed:', e.message);
      }
    }, debounceMs);
  };

  // Native fs.watch on each save location
  for (const loc of game.saveLocations || []) {
    const root = resolveEnvPath(loc);
    if (!root || !fs.existsSync(root)) continue;
    try {
      const watcher = fs.watch(root, { recursive: true }, () => triggerCheck());
      watcher.on('error', () => {});
      state.watchers.push(watcher);
    } catch {
      // recursive may fail on Linux; fall back to polling only
    }
  }

  // Polling fallback (also catches missed events)
  state.timers.poll = setInterval(() => {
    const changed = listSaveFiles(game).some((f) => {
      try {
        const size = fs.statSync(f).size;
        const prev = state.lastFileSizes.get(f);
        if (prev !== size) {
          state.lastFileSizes.set(f, size);
          return true;
        }
      } catch {}
      return false;
    });
    if (changed) triggerCheck();
  }, pollMs);

  activeWatches.set(game.id, state);
  console.log(`[GameWatcher] watching ${game.name}`);
  return state;
}

function detectFileChanges(state, game) {
  const changes = [];
  for (const f of listSaveFiles(game)) {
    try {
      const stats = fs.statSync(f);
      const prev = state.lastFileSizes.get(f);
      if (prev === undefined) {
        changes.push({ path: f, type: 'created', size: stats.size });
      } else if (prev !== stats.size) {
        changes.push({ path: f, type: 'modified', size: stats.size, sizeDelta: stats.size - prev });
      }
      state.lastFileSizes.set(f, stats.size);
    } catch {}
  }
  return changes;
}

function stopWatching(gameId) {
  const state = activeWatches.get(gameId);
  if (!state) return;
  if (state.timers.debounce) clearTimeout(state.timers.debounce);
  if (state.timers.poll) clearInterval(state.timers.poll);
  state.watchers.forEach((w) => { try { w.close(); } catch {} });
  activeWatches.delete(gameId);
  console.log(`[GameWatcher] stopped ${gameId}`);
}

function stopAll() {
  for (const id of activeWatches.keys()) stopWatching(id);
}

module.exports = {
  startWatching,
  stopWatching,
  stopAll,
  diffScans,
};
