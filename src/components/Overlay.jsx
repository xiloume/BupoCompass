import React, { useEffect } from 'react';
import useStore from '../store/useStore';
import ZoneTracker from './ZoneTracker';

// Approx pixel sizes for compact item rows (must match ItemRow + ZoneTracker padding)
const TITLE_BAR_H = 32;
const COMPACT_ITEM_H = 28; // ItemRow row + 2px gap (space-y-0.5)
const COMPACT_PADDING = 12;
const MAX_AUTOSIZE_H = 700;
const MIN_AUTOSIZE_H = 80;

export default function Overlay() {
  const {
    gameIds, gamesById, zonesById, itemsById,
    currentGameId, currentZoneId,
    setCurrentGame, setCurrentZone, compact,
  } = useStore();

  const currentGame = gamesById[currentGameId];
  const currentZone = zonesById[currentZoneId];

  // Auto-resize window in compact mode to fit the items list
  const compactItemCount = compact && currentZone ? currentZone.itemIds.length : 0;
  useEffect(() => {
    if (!compact) return;
    if (!window.electronAPI?.resizeWindow) return;
    const count = compactItemCount || 1;
    const target = Math.min(
      MAX_AUTOSIZE_H,
      Math.max(MIN_AUTOSIZE_H, TITLE_BAR_H + count * COMPACT_ITEM_H + COMPACT_PADDING)
    );
    window.electronAPI.resizeWindow({ height: target });
  }, [compact, compactItemCount, currentZoneId]);

  const gameProgress = currentGame?.zoneIds.reduce(
    (acc, zId) => {
      const zone = zonesById[zId];
      if (!zone) return acc;
      const total = zone.itemIds.reduce((s, iId) => s + (itemsById[iId]?.total || 0), 0);
      const current = zone.itemIds.reduce((s, iId) => s + (itemsById[iId]?.current || 0), 0);
      return { current: acc.current + current, total: acc.total + total };
    },
    { current: 0, total: 0 }
  );

  if (compact) {
    if (!currentGame) return null;
    if (!currentZone) {
      return (
        <div className="flex-1 flex items-center justify-center p-2">
          <p className="text-white/30 text-xs text-center">Aucune zone s&eacute;lectionn&eacute;e</p>
        </div>
      );
    }
    // Compact = items only. ZoneTracker already shows just items + a tiny
    // header. We pass compact prop to strip extras.
    return (
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        <ZoneTracker zone={currentZone} gameId={currentGameId} compact />
      </div>
    );
  }

  if (!currentGame) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-white/40 text-sm text-center">
          Aucun jeu configur&eacute;.
          <br />
          Cliquez sur &#x2699; pour commencer.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Game selector */}
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-white/5">
        {gameIds.length > 1 ? (
          <select
            value={currentGameId || ''}
            onChange={(e) => setCurrentGame(e.target.value)}
            className="bg-white/5 text-white/80 text-xs rounded px-2 py-1 border border-white/10 outline-none flex-1 min-w-0"
          >
            {gameIds.map((gId) => (
              <option key={gId} value={gId}>
                {gamesById[gId]?.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-white/60 text-xs truncate">{currentGame.name}</span>
        )}
      </div>

      {/* Zone tabs */}
      {currentGame.zoneIds.length > 0 && (
        <div className="px-3 pt-1.5 flex gap-1 overflow-x-auto flex-shrink-0">
          {currentGame.zoneIds.map((zId) => {
            const z = zonesById[zId];
            if (!z) return null;
            const zCurrent = z.itemIds.reduce((s, iId) => s + (itemsById[iId]?.current || 0), 0);
            const zTotal = z.itemIds.reduce((s, iId) => s + (itemsById[iId]?.total || 0), 0);
            const isComplete = zTotal > 0 && zCurrent === zTotal;
            const isActive = zId === currentZoneId;
            return (
              <button
                key={zId}
                onClick={() => setCurrentZone(zId)}
                className={`text-xs px-2 py-1 rounded-t whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : isComplete
                      ? 'text-emerald-400/50 hover:text-emerald-400'
                      : 'text-white/40 hover:text-white/60'
                }`}
              >
                {z.name}
                {isComplete && ' \u2713'}
              </button>
            );
          })}
        </div>
      )}

      {/* Zone content */}
      {currentZone ? (
        <ZoneTracker zone={currentZone} gameId={currentGameId} />
      ) : (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-white/30 text-xs text-center">
            Aucune zone. Ouvrez l&apos;&eacute;diteur pour en ajouter.
          </p>
        </div>
      )}

      {/* Global progress */}
      {gameProgress && gameProgress.total > 0 && (
        <div className="px-3 py-1.5 border-t border-white/5 flex-shrink-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/30">Progression totale</span>
            <span className="text-white/50 font-mono">
              {gameProgress.current}/{gameProgress.total} (
              {Math.round((gameProgress.current / gameProgress.total) * 100)}%)
            </span>
          </div>
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${(gameProgress.current / gameProgress.total) * 100}%`,
                backgroundColor:
                  gameProgress.current === gameProgress.total ? '#10b981' : '#3b82f6',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
