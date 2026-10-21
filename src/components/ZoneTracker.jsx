import React, { useState, useCallback } from 'react';
import useStore from '../store/useStore';
import ItemRow from './ItemRow';
import Toast from './Toast';

function playCompleteSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.frequency.setValueAtTime(523, ctx.currentTime);
    osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

export default function ZoneTracker({ zone, gameId, compact = false }) {
  const { itemsById, soundEnabled } = useStore();
  const [toast, setToast] = useState(null);

  const items = zone.itemIds.map((id) => itemsById[id]).filter(Boolean);
  const zoneCurrent = items.reduce((s, i) => s + i.current, 0);
  const zoneTotal = items.reduce((s, i) => s + i.total, 0);
  const pct = zoneTotal > 0 ? Math.round((zoneCurrent / zoneTotal) * 100) : 0;

  const handleZoneComplete = useCallback(() => {
    const newCurrent = items.reduce((s, i) => s + i.current, 0) + 1;
    const total = items.reduce((s, i) => s + i.total, 0);
    if (newCurrent >= total && total > 0) {
      setToast(`\u2713 ${zone.name} \u2014 100% compl\u00e9t\u00e9 !`);
      if (soundEnabled) playCompleteSound();
    }
  }, [items, zone.name, soundEnabled]);

  return (
    <div className={`flex-1 overflow-y-auto relative ${compact ? 'px-2 py-1' : 'px-3 py-2'}`}>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Zone header + progress bar - hidden in compact mode */}
      {!compact && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/80 text-sm font-medium">{zone.name}</span>
            <span
              className={`text-xs font-mono ${pct === 100 ? 'text-emerald-400' : 'text-white/50'}`}
            >
              {pct}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </>
      )}

      {/* Items */}
      <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
        {items.map((item) => (
          <ItemRow key={item.id} item={item} onZoneComplete={handleZoneComplete} />
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-white/20 text-xs text-center py-4">
          {compact ? 'Aucun item' : 'Aucun item. Ouvrez l\u2019\u00e9diteur pour en ajouter.'}
        </p>
      )}
    </div>
  );
}
