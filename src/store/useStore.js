import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

// Accent/case-insensitive label key used to match items with Steam achievements
function normalizeLabel(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const useStore = create(
  persist(
    (set, get) => ({
      // UI State
      editorOpen: false,
      compact: false,
      overlayOpacity: 0.85,
      interactive: true,
      soundEnabled: true,
      themeId: 'default',
      isVip: false,

      // Normalized Data
      gameIds: [],
      gamesById: {},
      zonesById: {},
      itemsById: {},

      // Selection
      currentGameId: null,
      currentZoneId: null,

      // UI Actions
      toggleEditor: () => set((s) => ({ editorOpen: !s.editorOpen })),
      setEditorOpen: (open) => set({ editorOpen: open }),
      toggleCompact: () => set((s) => ({ compact: !s.compact })),
      setOverlayOpacity: (opacity) => set({ overlayOpacity: opacity }),
      setInteractive: (interactive) => set({ interactive }),
      toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
      setTheme: (themeId) => set({ themeId }),
      setVip: (isVip) => set({ isVip }),

      // Selectors (helpers)
      getGame: (gameId) => get().gamesById[gameId],
      getZone: (zoneId) => get().zonesById[zoneId],
      getItem: (itemId) => get().itemsById[itemId],
      getGameZones: (gameId) => {
        const game = get().gamesById[gameId];
        if (!game) return [];
        return game.zoneIds.map((id) => get().zonesById[id]).filter(Boolean);
      },
      getZoneItems: (zoneId) => {
        const zone = get().zonesById[zoneId];
        if (!zone) return [];
        return zone.itemIds.map((id) => get().itemsById[id]).filter(Boolean);
      },

      // Game Actions
      addGame: (name) => {
        const id = uuidv4();
        set((s) => ({
          gameIds: [...s.gameIds, id],
          gamesById: { ...s.gamesById, [id]: { id, name, zoneIds: [] } },
          currentGameId: s.currentGameId || id,
        }));
        return id;
      },

      removeGame: (gameId) => set((s) => {
        const game = s.gamesById[gameId];
        if (!game) return s;

        // Collect all zones and items to remove
        const zonesToRemove = game.zoneIds;
        const itemsToRemove = zonesToRemove.flatMap(
          (zId) => s.zonesById[zId]?.itemIds || []
        );

        const newGamesById = { ...s.gamesById };
        delete newGamesById[gameId];

        const newZonesById = { ...s.zonesById };
        zonesToRemove.forEach((zId) => delete newZonesById[zId]);

        const newItemsById = { ...s.itemsById };
        itemsToRemove.forEach((iId) => delete newItemsById[iId]);

        const newGameIds = s.gameIds.filter((id) => id !== gameId);

        return {
          gameIds: newGameIds,
          gamesById: newGamesById,
          zonesById: newZonesById,
          itemsById: newItemsById,
          currentGameId:
            s.currentGameId === gameId ? (newGameIds[0] || null) : s.currentGameId,
          currentZoneId:
            s.currentGameId === gameId ? null : s.currentZoneId,
        };
      }),

      setCurrentGame: (gameId) => {
        const game = get().gamesById[gameId];
        set({
          currentGameId: gameId,
          currentZoneId: game?.zoneIds[0] || null,
        });
      },

      // Zone Actions
      addZone: (gameId, name) => {
        const id = uuidv4();
        set((s) => ({
          gamesById: {
            ...s.gamesById,
            [gameId]: {
              ...s.gamesById[gameId],
              zoneIds: [...s.gamesById[gameId].zoneIds, id],
            },
          },
          zonesById: { ...s.zonesById, [id]: { id, name, gameId, itemIds: [] } },
          currentZoneId: s.currentZoneId || id,
        }));
        return id;
      },

      removeZone: (gameId, zoneId) => set((s) => {
        const zone = s.zonesById[zoneId];
        if (!zone) return s;

        const newItemsById = { ...s.itemsById };
        zone.itemIds.forEach((iId) => delete newItemsById[iId]);

        const newZonesById = { ...s.zonesById };
        delete newZonesById[zoneId];

        return {
          gamesById: {
            ...s.gamesById,
            [gameId]: {
              ...s.gamesById[gameId],
              zoneIds: s.gamesById[gameId].zoneIds.filter((id) => id !== zoneId),
            },
          },
          zonesById: newZonesById,
          itemsById: newItemsById,
          currentZoneId: s.currentZoneId === zoneId ? null : s.currentZoneId,
        };
      }),

      setCurrentZone: (zoneId) => set({ currentZoneId: zoneId }),

      // Item Actions
      // meta: { description, steamKey, hidden }
      addItem: (gameId, zoneId, name, total, meta = {}) => {
        const id = uuidv4();
        set((s) => ({
          zonesById: {
            ...s.zonesById,
            [zoneId]: {
              ...s.zonesById[zoneId],
              itemIds: [...s.zonesById[zoneId].itemIds, id],
            },
          },
          itemsById: {
            ...s.itemsById,
            [id]: {
              id,
              name,
              current: 0,
              total,
              zoneId,
              description: meta.description || null,
              steamKey: meta.steamKey || null,
              hidden: !!meta.hidden,
            },
          },
        }));
        return id;
      },

      setItemDescription: (itemId, description) => set((s) => {
        const item = s.itemsById[itemId];
        if (!item) return s;
        return {
          itemsById: { ...s.itemsById, [itemId]: { ...item, description: description || null } },
        };
      }),

      setItemSteamKey: (itemId, steamKey) => set((s) => {
        const item = s.itemsById[itemId];
        if (!item || !steamKey || item.steamKey === steamKey) return s;
        return { itemsById: { ...s.itemsById, [itemId]: { ...item, steamKey } } };
      }),

      // Re-align existing items with Steam: adopt the localized name, fill in
      // the missing description and remember the achievement key.
      // entries: [{ name, steamKey, description, aliases: [] }]
      syncItemsFromSteam: (gameId, entries) => set((s) => {
        const game = s.gamesById[gameId];
        if (!game || !entries?.length) return s;

        const byKey = new Map();
        const byName = new Map();
        for (const e of entries) {
          if (!e) continue;
          if (e.steamKey) byKey.set(e.steamKey, e);
          // Aliases let an English item name still be recognised once Steam
          // starts answering in French (and the other way around).
          for (const label of [e.name, ...(e.aliases || [])]) {
            const k = normalizeLabel(label);
            if (k && !byName.has(k)) byName.set(k, e);
          }
        }
        if (!byKey.size && !byName.size) return s;

        const newItemsById = { ...s.itemsById };
        let changed = false;
        for (const zoneId of game.zoneIds) {
          const zone = s.zonesById[zoneId];
          if (!zone) continue;
          for (const itemId of zone.itemIds) {
            const item = newItemsById[itemId];
            if (!item) continue;
            const entry =
              (item.steamKey && byKey.get(item.steamKey)) || byName.get(normalizeLabel(item.name));
            if (!entry) continue;

            const next = { ...item };
            if (entry.name) next.name = entry.name;
            if (entry.description) next.description = entry.description;
            if (entry.steamKey) next.steamKey = entry.steamKey;

            if (
              next.name !== item.name ||
              next.description !== item.description ||
              next.steamKey !== item.steamKey
            ) {
              newItemsById[itemId] = next;
              changed = true;
            }
          }
        }
        return changed ? { itemsById: newItemsById } : s;
      }),

      removeItem: (gameId, zoneId, itemId) => set((s) => {
        const newItemsById = { ...s.itemsById };
        delete newItemsById[itemId];

        return {
          zonesById: {
            ...s.zonesById,
            [zoneId]: {
              ...s.zonesById[zoneId],
              itemIds: s.zonesById[zoneId].itemIds.filter((id) => id !== itemId),
            },
          },
          itemsById: newItemsById,
        };
      }),

      incrementItem: (itemId) => {
        const s = get();
        const item = s.itemsById[itemId];
        if (!item || item.current >= item.total) return;
        const newCurrent = item.current + 1;
        set({
          itemsById: {
            ...s.itemsById,
            [itemId]: { ...item, current: newCurrent },
          },
        });
        // Track for sync
        if (window.__syncService) {
          window.__syncService.trackChange(itemId, newCurrent);
        }
      },

      decrementItem: (itemId) => {
        const s = get();
        const item = s.itemsById[itemId];
        if (!item || item.current <= 0) return;
        const newCurrent = item.current - 1;
        set({
          itemsById: {
            ...s.itemsById,
            [itemId]: { ...item, current: newCurrent },
          },
        });
        // Track for sync
        if (window.__syncService) {
          window.__syncService.trackChange(itemId, newCurrent);
        }
      },

      setItemCurrent: (itemId, current) => {
        const s = get();
        const item = s.itemsById[itemId];
        if (!item) return;
        const clamped = Math.max(0, Math.min(item.total, current));
        if (clamped === item.current) return;
        set({
          itemsById: {
            ...s.itemsById,
            [itemId]: { ...item, current: clamped },
          },
        });
        if (window.__syncService) {
          window.__syncService.trackChange(itemId, clamped);
        }
      },

      // Apply changes received from server
      applyRemoteChanges: (changes) => set((s) => {
        const newItemsById = { ...s.itemsById };
        changes.forEach(({ item_id, current }) => {
          if (newItemsById[item_id]) {
            newItemsById[item_id] = { ...newItemsById[item_id], current };
          }
        });
        return { itemsById: newItemsById };
      }),

      // Import/Export (converts to/from legacy nested format for compatibility)
      exportData: () => {
        const { gameIds, gamesById, zonesById, itemsById } = get();
        const games = gameIds.map((gId) => {
          const game = gamesById[gId];
          return {
            id: game.id,
            name: game.name,
            zones: game.zoneIds.map((zId) => {
              const zone = zonesById[zId];
              return {
                id: zone.id,
                name: zone.name,
                items: zone.itemIds.map((iId) => {
                  const item = itemsById[iId];
                  return {
                    id: item.id,
                    name: item.name,
                    current: item.current,
                    total: item.total,
                    description: item.description || null,
                    steamKey: item.steamKey || null,
                    hidden: !!item.hidden,
                  };
                }),
              };
            }),
          };
        });
        return JSON.stringify({ games }, null, 2);
      },

      importData: (jsonString) => {
        try {
          const data = JSON.parse(jsonString);
          if (!data.games) return false;

          const gameIds = [];
          const gamesById = {};
          const zonesById = {};
          const itemsById = {};

          data.games.forEach((game) => {
            const gameId = game.id || uuidv4();
            const zoneIds = [];

            (game.zones || []).forEach((zone) => {
              const zoneId = zone.id || uuidv4();
              const itemIds = [];

              (zone.items || []).forEach((item) => {
                const itemId = item.id || uuidv4();
                itemIds.push(itemId);
                itemsById[itemId] = {
                  id: itemId,
                  name: item.name,
                  current: item.current || 0,
                  total: item.total,
                  zoneId,
                  description: item.description || null,
                  steamKey: item.steamKey || null,
                  hidden: !!item.hidden,
                };
              });

              zoneIds.push(zoneId);
              zonesById[zoneId] = { id: zoneId, name: zone.name, gameId, itemIds };
            });

            gameIds.push(gameId);
            gamesById[gameId] = { id: gameId, name: game.name, zoneIds };
          });

          set({
            gameIds,
            gamesById,
            zonesById,
            itemsById,
            currentGameId: gameIds[0] || null,
            currentZoneId: gamesById[gameIds[0]]?.zoneIds[0] || null,
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'bupo-compass-storage',
      version: 2,
      migrate: (persisted, version) => {
        if (version < 2 && persisted.games) {
          // Migrate from nested v1 to flat v2
          const gameIds = [];
          const gamesById = {};
          const zonesById = {};
          const itemsById = {};

          persisted.games.forEach((game) => {
            const zoneIds = [];
            (game.zones || []).forEach((zone) => {
              const itemIds = [];
              (zone.items || []).forEach((item) => {
                itemIds.push(item.id);
                itemsById[item.id] = { ...item, zoneId: zone.id };
              });
              zoneIds.push(zone.id);
              zonesById[zone.id] = { id: zone.id, name: zone.name, gameId: game.id, itemIds };
            });
            gameIds.push(game.id);
            gamesById[game.id] = { id: game.id, name: game.name, zoneIds };
          });

          return {
            ...persisted,
            gameIds,
            gamesById,
            zonesById,
            itemsById,
            games: undefined,
          };
        }
        return persisted;
      },
    }
  )
);

export default useStore;
