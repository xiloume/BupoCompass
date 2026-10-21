import React, { useRef } from 'react';
import useStore from '../store/useStore';

export default function TitleBar() {
  const {
    toggleEditor, editorOpen, compact, toggleCompact,
    currentGameId, currentZoneId, gamesById, zonesById,
    setCurrentZone,
  } = useStore();

  const prevHeightRef = useRef(null);
  const currentGame = gamesById[currentGameId];

  const handleToggleCompact = () => {
    const newCompact = !compact;
    toggleCompact();
    window.electronAPI?.setCompact(newCompact);
    if (newCompact) {
      // Remember current height so we can restore on un-compact
      prevHeightRef.current = window.innerHeight;
    } else if (prevHeightRef.current) {
      window.electronAPI?.resizeWindow({ height: prevHeightRef.current });
      prevHeightRef.current = null;
    }
  };

  return (
    <div
      className="flex items-center justify-between px-2 py-1.5 flex-shrink-0 gap-1 min-w-0"
      style={{ WebkitAppRegion: 'drag' }}
    >
      <div className="flex items-center gap-1.5 min-w-0 overflow-hidden flex-1">
        {compact && currentGame && currentGame.zoneIds.length > 0 ? (
          <select
            value={currentZoneId || ''}
            onChange={(e) => setCurrentZone(e.target.value)}
            className="bg-white/5 text-white/80 text-xs rounded px-1.5 py-0.5 border border-white/10 outline-none flex-1 min-w-0 max-w-full"
            style={{ WebkitAppRegion: 'no-drag' }}
          >
            {currentGame.zoneIds.map((zId) => {
              const z = zonesById[zId];
              if (!z) return null;
              return (
                <option key={zId} value={zId}>{z.name}</option>
              );
            })}
          </select>
        ) : (
          <span className="text-sm font-bold tracking-wide truncate" style={{ color: 'var(--accent, #10b981)' }}>
            &#x2B21; BupoCompass
          </span>
        )}
      </div>
      <div className="flex items-center flex-shrink-0" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={handleToggleCompact}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white/80 text-xs transition-colors"
          title={compact ? 'Développer' : 'Compact'}
        >
          {compact ? '\u25BC' : '\u25B2'}
        </button>
        <button
          onClick={toggleEditor}
          className={`w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-xs transition-colors ${
            editorOpen ? 'text-emerald-400' : 'text-white/50 hover:text-white/80'
          }`}
          title="Éditeur"
        >
          &#x2699;
        </button>
        <button
          onClick={() => window.electronAPI?.minimizeWindow()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white/80 text-xs transition-colors"
          title="Réduire"
        >
          &#x2014;
        </button>
        <button
          onClick={() => window.electronAPI?.closeWindow()}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/30 text-white/50 hover:text-red-400 text-xs transition-colors"
          title="Fermer"
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
}
