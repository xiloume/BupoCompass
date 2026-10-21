import { useEffect, useState, useCallback, useRef } from 'react';
import useStore from '../store/useStore';

// Normalize a string for fuzzy comparison
function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fuzzyMatch(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Token-based: at least half of tokens match
  const ta = new Set(na.split(' ').filter((t) => t.length > 2));
  const tb = new Set(nb.split(' ').filter((t) => t.length > 2));
  if (!ta.size || !tb.size) return false;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common >= Math.min(ta.size, tb.size) / 2;
}

// localGameId: UUID in the store (used to find checklist items)
// registryGameId: id from desktop/games/registry.json (used by the file watcher)
export function useAutoSync(localGameId, registryGameId) {
  const [enabled, setEnabled] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [autoChecked, setAutoChecked] = useState([]);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const currentGameId = localGameId;

  const { setItemCurrent, setItemSteamKey, syncItemsFromSteam } = useStore();

  // Find checklist items for the current game. Reads the live store state so
  // that updates applied earlier in the same pass are visible.
  const findItemsForGame = useCallback(() => {
    if (!currentGameId) return [];
    const { gamesById: g, zonesById: z, itemsById: i } = useStore.getState();
    const game = g[currentGameId];
    if (!game) return [];
    const items = [];
    for (const zoneId of game.zoneIds) {
      const zone = z[zoneId];
      if (!zone) continue;
      for (const itemId of zone.itemIds) {
        const item = i[itemId];
        if (item) items.push({ ...item, zoneName: zone.name });
      }
    }
    return items;
  }, [currentGameId]);

  // Apply diff: try to fuzzy-match scanned items to checklist items
  const applyDiff = useCallback(
    (diff, steam) => {
      let checklistItems = findItemsForGame();
      const checked = [];

      // An item can only be consumed once per pass, otherwise a single
      // checklist entry gets claimed by several achievements.
      const usedIds = new Set();

      const findBestMatch = (itemName) => {
        const target = normalize(itemName);
        if (!target) return null;
        const available = (it) => !usedIds.has(it.id) && it.current < it.total;
        // 1. Exact normalized match on item name
        let m = checklistItems.find((it) => available(it) && normalize(it.name) === target);
        if (m) return m;
        // 2. Exact normalized match on "zone + item"
        m = checklistItems.find(
          (it) => available(it) && normalize(`${it.zoneName} ${it.name}`) === target
        );
        if (m) return m;
        // 3. Fuzzy fallback - prefer items not yet completed
        m = checklistItems.find(
          (it) =>
            available(it) &&
            (fuzzyMatch(it.name, itemName) || fuzzyMatch(`${it.zoneName} ${it.name}`, itemName))
        );
        return m || null;
      };

      const tryCheck = (itemName) => {
        const match = findBestMatch(itemName);
        if (match) {
          usedIds.add(match.id);
          setItemCurrent(match.id, match.total);
          checked.push({ name: match.name, zone: match.zoneName, value: match.total, source: 'scan' });
          return true;
        }
        return false;
      };

      // 1. Save file diff (parsed items)
      const scanned = [...(diff?.added || []), ...(diff?.incremented || [])];
      for (const scan of scanned) tryCheck(scan.name);

      // Re-align names/descriptions with the configured language before
      // matching, so items imported in another language get translated.
      if (currentGameId && steam?.allAchievements?.length) {
        const map = steam.map || {};
        syncItemsFromSteam(
          currentGameId,
          steam.allAchievements.map((a) => ({
            name: a.display || map[a.key] || a.key,
            steamKey: a.key,
            description: a.description || null,
            aliases: [map[a.key], a.key],
          }))
        );
        // Names and keys just changed: re-read before matching.
        checklistItems = findItemsForGame();
      }

      // 2. Steam achievements. The API key is language-independent, so matching
      //    on it is exact; the name-based match is only a legacy fallback for
      //    items created before steamKey was stored.
      const achievements = steam?.allAchievements?.length
        ? steam.allAchievements
        : steam?.unlocked || [];

      if (achievements.length) {
        const map = steam?.map || {};
        const byKey = new Map();
        for (const it of checklistItems) {
          if (it.steamKey) byKey.set(it.steamKey, it);
        }

        for (const ach of achievements) {
          const exact = ach.key ? byKey.get(ach.key) : null;

          // Exact key match: mirror the profile in both directions.
          if (exact) {
            usedIds.add(exact.id);
            const target = ach.unlocked ? exact.total : 0;
            if (exact.current !== target) {
              setItemCurrent(exact.id, target);
              if (ach.unlocked) {
                checked.push({
                  name: exact.name,
                  zone: exact.zoneName,
                  value: target,
                  source: 'steam',
                  via: ach.key,
                });
              }
            }
            continue;
          }

          // Name-based fallback: only ever ticks items, never unticks, since a
          // wrong fuzzy hit would silently destroy progress.
          if (!ach.unlocked) continue;
          const candidates = [ach.display, map[ach.key], ach.key].filter(Boolean);
          for (const cand of candidates) {
            const match = findBestMatch(cand);
            if (!match) continue;
            usedIds.add(match.id);
            setItemCurrent(match.id, match.total);
            // Remember the key so the next sync is exact instead of fuzzy.
            if (ach.key) setItemSteamKey(match.id, ach.key);
            checked.push({
              name: match.name,
              zone: match.zoneName,
              value: match.total,
              source: 'steam',
              via: cand,
            });
            break;
          }
        }
      }

      return checked;
    },
    [findItemsForGame, setItemCurrent, setItemSteamKey, syncItemsFromSteam, currentGameId]
  );

  // Subscribe to save-changed events from main process
  useEffect(() => {
    if (!window.electronAPI?.onSaveChanged) return;
    const unsub = window.electronAPI.onSaveChanged((event) => {
      if (!enabledRef.current) return;
      console.log('[AutoSync] save changed:', event);
      setLastEvent(event);
      const checked = applyDiff(event.diff || {}, event.steam);
      if (checked.length) {
        setAutoChecked((prev) => [...checked, ...prev].slice(0, 20));
        console.log(`[AutoSync] auto-checked ${checked.length} items`);
      } else {
        console.log('[AutoSync] save changed but no items could be matched (likely encrypted save)');
      }
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [applyDiff]);

  // Manual Steam achievement scan (immediate, no save change required)
  const scanSteamNow = useCallback(async () => {
    if (!window.electronAPI?.scanSteamAchievements || !registryGameId) return null;
    let steam = null;
    try {
      steam = await window.electronAPI.scanSteamAchievements(registryGameId);
      console.log('[AutoSync] Steam scan:', steam);
    } catch (e) {
      console.error('[AutoSync] Steam IPC failed:', e);
      return { steam: { error: `IPC error: ${e.message}` }, checked: [] };
    }
    let checked = [];
    try {
      checked = applyDiff({}, steam) || [];
      if (checked.length) {
        setAutoChecked((prev) => [...checked, ...prev].slice(0, 20));
      }
    } catch (e) {
      console.error('[AutoSync] applyDiff failed:', e);
    }
    return { steam, checked };
  }, [registryGameId, applyDiff]);

  // Start/stop watching when toggled (uses registry id, not store UUID)
  const toggle = useCallback(
    async () => {
      if (!window.electronAPI?.startGameWatch || !registryGameId) return;
      if (enabled) {
        await window.electronAPI.stopGameWatch(registryGameId);
        setEnabled(false);
      } else {
        try {
          await window.electronAPI.startGameWatch(registryGameId);
          setEnabled(true);
          // Immediate Steam scan to apply current achievements
          await scanSteamNow();
        } catch (e) {
          console.error('Failed to start watch:', e);
        }
      }
    },
    [enabled, registryGameId, scanSteamNow]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (enabled && registryGameId && window.electronAPI?.stopGameWatch) {
        window.electronAPI.stopGameWatch(registryGameId);
      }
    };
  }, [enabled, registryGameId]);

  return { enabled, toggle, lastEvent, autoChecked, applyDiff, scanSteamNow };
}
