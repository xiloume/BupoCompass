import React, { useState, useCallback } from 'react';
import useStore from '../store/useStore';

export default function ItemRow({ item, onZoneComplete }) {
  const { incrementItem, decrementItem } = useStore();
  const [flash, setFlash] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const hasDescription = Boolean(item.description);

  const triggerFlash = useCallback((type) => {
    setFlash(type);
    setTimeout(() => setFlash(null), 250);
  }, []);

  const handleIncrement = () => {
    incrementItem(item.id);
    triggerFlash('up');
    if (item.current + 1 >= item.total && onZoneComplete) {
      onZoneComplete();
    }
  };

  const handleDecrement = () => {
    decrementItem(item.id);
    triggerFlash('down');
  };

  const isComplete = item.current >= item.total;
  const pct = item.total > 0 ? (item.current / item.total) * 100 : 0;

  const flashBg = flash === 'up'
    ? 'bg-emerald-400/15'
    : flash === 'down'
      ? 'bg-red-400/15'
      : '';

  return (
    <div className={`rounded transition-colors ${isComplete ? 'opacity-50' : ''} ${flashBg}`}>
      <div className="flex items-center gap-2 group rounded px-2 py-1 hover:bg-white/5">
        {/* Mini progress bar */}
        <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden flex-shrink-0">
          <div
            className="h-full rounded-full transition-all duration-200"
            style={{
              width: `${pct}%`,
              backgroundColor: isComplete ? '#10b981' : '#3b82f6',
            }}
          />
        </div>

        {/* Item name - click to reveal the description */}
        <button
          type="button"
          onClick={() => hasDescription && setExpanded((v) => !v)}
          title={hasDescription ? 'Cliquer pour voir le descriptif' : item.name}
          aria-expanded={expanded}
          className={`text-xs flex-1 min-w-0 flex items-center gap-1 text-left ${
            hasDescription ? 'cursor-pointer' : 'cursor-default'
          } ${isComplete ? 'text-emerald-400/60 line-through' : 'text-white/70'} ${
            hasDescription ? 'hover:text-white' : ''
          }`}
        >
          <span className="truncate">{item.name}</span>
          {hasDescription && (
            <span
              className={`flex-shrink-0 text-[9px] text-white/30 transition-transform ${
                expanded ? 'rotate-90' : ''
              }`}
            >
              &#x25B6;
            </span>
          )}
        </button>

        {/* Counter controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleDecrement}
            className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 text-xs opacity-0 group-hover:opacity-100 transition-all"
            disabled={item.current <= 0}
          >
            &#x2212;
          </button>
          <span
            className={`text-xs font-mono min-w-[3rem] text-center ${
              isComplete ? 'text-emerald-400' : 'text-white/60'
            }`}
          >
            {item.current}/{item.total}
          </span>
          <button
            onClick={handleIncrement}
            className="w-5 h-5 flex items-center justify-center rounded text-white/30 hover:text-white/70 hover:bg-white/10 text-xs opacity-0 group-hover:opacity-100 transition-all"
            disabled={item.current >= item.total}
          >
            +
          </button>
        </div>

        {/* Complete check */}
        {isComplete && <span className="text-emerald-400 text-xs flex-shrink-0">&#x2713;</span>}
      </div>

      {/* Description panel */}
      {hasDescription && expanded && (
        <div className="mx-2 mb-1 px-2 py-1.5 rounded bg-black/30 border-l-2 border-white/20 text-[11px] leading-snug text-white/60 whitespace-pre-wrap">
          {item.description}
        </div>
      )}
    </div>
  );
}
