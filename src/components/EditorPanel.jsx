import React, { useState } from 'react';
import useStore from '../store/useStore';
import { themeList, getTheme } from '../themes';

export default function EditorPanel() {
  const {
    gameIds,
    gamesById,
    zonesById,
    itemsById,
    currentGameId,
    currentZoneId,
    addGame,
    removeGame,
    setCurrentGame,
    addZone,
    removeZone,
    setCurrentZone,
    addItem,
    removeItem,
    setEditorOpen,
    exportData,
    importData,
    overlayOpacity,
    setOverlayOpacity,
    soundEnabled,
    toggleSound,
    themeId,
    setTheme,
    isVip,
  } = useStore();

  const [newGameName, setNewGameName] = useState('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemTotal, setNewItemTotal] = useState('');
  const [activeTab, setActiveTab] = useState('items');

  const currentGame = gamesById[currentGameId];
  const currentZone = zonesById[currentZoneId];

  const handleAddGame = (e) => {
    e.preventDefault();
    if (!newGameName.trim()) return;
    const id = addGame(newGameName.trim());
    setCurrentGame(id);
    setNewGameName('');
  };

  const handleAddZone = (e) => {
    e.preventDefault();
    if (!newZoneName.trim() || !currentGameId) return;
    const id = addZone(currentGameId, newZoneName.trim());
    setCurrentZone(id);
    setNewZoneName('');
  };

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemTotal || !currentGameId || !currentZoneId) return;
    addItem(currentGameId, currentZoneId, newItemName.trim(), parseInt(newItemTotal, 10));
    setNewItemName('');
    setNewItemTotal('');
  };

  const handleExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bupocompass-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        importData(ev.target.result);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const inputClass =
    'w-full bg-white/5 text-white text-xs rounded px-2 py-1.5 border border-white/10 outline-none focus:border-emerald-400/50 placeholder-white/20';
  const btnClass =
    'bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded hover:bg-emerald-500/30 transition-colors';
  const btnDangerClass = 'text-red-400/60 hover:text-red-400 text-xs transition-colors';

  return (
    <div className="w-64 border-l border-white/10 flex flex-col overflow-hidden bg-black/20 flex-shrink-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('items')}
            className={`text-xs px-2 py-0.5 rounded ${
              activeTab === 'items' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            &Eacute;diteur
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`text-xs px-2 py-0.5 rounded ${
              activeTab === 'settings' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            Options
          </button>
        </div>
        <button
          onClick={() => setEditorOpen(false)}
          className="text-white/30 hover:text-white/60 text-xs"
        >
          &#x2715;
        </button>
      </div>

      {activeTab === 'settings' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Opacity */}
          <div>
            <label className="text-white/40 text-xs block mb-1">
              Opacit&eacute; ({Math.round(overlayOpacity * 100)}%)
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.05"
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-full accent-emerald-400"
            />
          </div>

          {/* Sound */}
          <div>
            <label className="text-white/40 text-xs block mb-1">Son de compl&eacute;tion</label>
            <button
              onClick={toggleSound}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                soundEnabled
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/5 text-white/40'
              }`}
            >
              {soundEnabled ? '\u266B Activ\u00e9' : '\u2716 D\u00e9sactiv\u00e9'}
            </button>
          </div>

          {/* Theme */}
          <div>
            <label className="text-white/40 text-xs block mb-2">Th&egrave;me</label>
            <div className="grid grid-cols-4 gap-1.5">
              {themeList.map((t) => {
                const locked = t.vipOnly && !isVip;
                return (
                <button
                  key={t.id}
                  onClick={() => !locked && setTheme(t.id)}
                  className={`relative flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-colors ${
                    themeId === t.id
                      ? 'border-white/30 bg-white/5'
                      : 'border-white/5 hover:border-white/10'
                  } ${locked ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={locked ? `${t.name} (VIP)` : t.name}
                >
                  <div
                    className="w-5 h-5 rounded-full border border-white/10"
                    style={{ backgroundColor: t.accent }}
                  />
                  <span className="text-[9px] text-white/50 truncate w-full text-center">
                    {t.name}
                  </span>
                  {t.vipOnly && (
                    <span className="absolute -top-1 -right-1 text-[8px] bg-yellow-500/80 text-black px-1 rounded font-bold">
                      VIP
                    </span>
                  )}
                </button>
                );
              })}
            </div>
          </div>

          {/* Shortcuts */}
          <div>
            <label className="text-white/40 text-xs block mb-2">Raccourcis</label>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-white/30">
                <span>Afficher/Masquer</span>
                <kbd className="bg-white/10 px-1.5 rounded text-white/50">F9</kbd>
              </div>
              <div className="flex justify-between text-white/30">
                <span>Mode interactif</span>
                <kbd className="bg-white/10 px-1.5 rounded text-white/50">F10</kbd>
              </div>
            </div>
          </div>

          {/* Import / Export */}
          <div>
            <label className="text-white/40 text-xs block mb-2">Donn&eacute;es</label>
            <div className="flex gap-2">
              <button onClick={handleExport} className={btnClass}>
                Exporter
              </button>
              <button onClick={handleImport} className={btnClass}>
                Importer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Games */}
          <div>
            <label className="text-white/40 text-xs block mb-1.5">Jeux</label>
            <form onSubmit={handleAddGame} className="flex gap-1 mb-2">
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Nom du jeu..."
                className={inputClass}
              />
              <button type="submit" className={btnClass}>
                +
              </button>
            </form>
            <div className="space-y-0.5">
              {gameIds.map((gId) => {
                const g = gamesById[gId];
                if (!g) return null;
                return (
                  <div
                    key={gId}
                    className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
                      gId === currentGameId
                        ? 'bg-white/10 text-white'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    <button
                      onClick={() => setCurrentGame(gId)}
                      className="flex-1 text-left truncate"
                    >
                      {g.name}
                    </button>
                    <button onClick={() => removeGame(gId)} className={btnDangerClass}>
                      &#x2715;
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Zones */}
          {currentGame && (
            <div>
              <label className="text-white/40 text-xs block mb-1.5">
                Zones &mdash; {currentGame.name}
              </label>
              <form onSubmit={handleAddZone} className="flex gap-1 mb-2">
                <input
                  type="text"
                  value={newZoneName}
                  onChange={(e) => setNewZoneName(e.target.value)}
                  placeholder="Nom de la zone..."
                  className={inputClass}
                />
                <button type="submit" className={btnClass}>
                  +
                </button>
              </form>
              <div className="space-y-0.5">
                {currentGame.zoneIds.map((zId) => {
                  const z = zonesById[zId];
                  if (!z) return null;
                  return (
                    <div
                      key={zId}
                      className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
                        zId === currentZoneId
                          ? 'bg-white/10 text-white'
                          : 'text-white/40 hover:text-white/60'
                      }`}
                    >
                      <button
                        onClick={() => setCurrentZone(zId)}
                        className="flex-1 text-left truncate"
                      >
                        {z.name} ({z.itemIds.length})
                      </button>
                      <button
                        onClick={() => removeZone(currentGameId, zId)}
                        className={btnDangerClass}
                      >
                        &#x2715;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items */}
          {currentZone && (
            <div>
              <label className="text-white/40 text-xs block mb-1.5">
                Items &mdash; {currentZone.name}
              </label>
              <form onSubmit={handleAddItem} className="space-y-1 mb-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nom de l'item..."
                  className={inputClass}
                />
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={newItemTotal}
                    onChange={(e) => setNewItemTotal(e.target.value)}
                    placeholder="Total"
                    min="1"
                    className={`${inputClass} w-20`}
                  />
                  <button type="submit" className={`${btnClass} flex-1`}>
                    Ajouter
                  </button>
                </div>
              </form>
              <div className="space-y-0.5">
                {currentZone.itemIds.map((iId) => {
                  const i = itemsById[iId];
                  if (!i) return null;
                  return (
                    <div
                      key={iId}
                      className="flex items-center justify-between px-2 py-1 rounded text-xs text-white/40"
                    >
                      <span className="truncate flex-1">
                        {i.name} ({i.current}/{i.total})
                      </span>
                      <button
                        onClick={() => removeItem(currentGameId, currentZoneId, iId)}
                        className={btnDangerClass}
                      >
                        &#x2715;
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
