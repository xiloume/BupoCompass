import React, { useEffect, useState, useMemo } from 'react';

export default function GameDetectionDebug({ onClose, registry }) {
  const [processes, setProcesses] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!window.electronAPI?.listProcesses) return;
    setLoading(true);
    try {
      const list = await window.electronAPI.listProcesses();
      setProcesses(list || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(() => {
    if (!filter) return processes;
    const f = filter.toLowerCase();
    return processes.filter((p) => p.toLowerCase().includes(f));
  }, [processes, filter]);

  // Cross-reference: is anything in `processes` matching a registry entry?
  const matches = useMemo(() => {
    if (!registry?.games) return [];
    const procLower = new Set(processes.map((p) => p.toLowerCase()));
    return registry.games.filter((g) =>
      g.processNames.some((pn) => {
        const t = pn.toLowerCase();
        const tNoExt = t.replace(/\.exe$/, '');
        return [...procLower].some((n) => {
          const nNoExt = n.replace(/\.exe$/, '');
          return n === t || nNoExt === tNoExt;
        });
      })
    );
  }, [processes, registry]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-white/10 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white font-semibold">Diagnostic d&eacute;tection de jeu</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">&times;</button>
        </div>

        <div className="px-4 py-3 border-b border-white/10 space-y-2">
          <div className="text-xs text-white/60">
            Processus actifs : <span className="text-emerald-400">{processes.length}</span>
            {' - '}
            Jeux connus correspondants : <span className="text-emerald-400">{matches.length}</span>
          </div>
          {matches.length > 0 && (
            <div className="text-xs">
              {matches.map((g) => (
                <div key={g.id} className="text-emerald-300">
                  ✓ {g.name} ({g.processNames.join(', ')})
                </div>
              ))}
            </div>
          )}
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrer (ex: graveyard)"
            className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-white placeholder-white/30"
          />
          <button
            onClick={refresh}
            disabled={loading}
            className="text-xs px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-white/70"
          >
            {loading ? 'Chargement...' : 'Rafra&icirc;chir'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-[11px] font-mono space-y-0.5">
            {filtered.map((p, i) => (
              <div key={i} className="text-white/60 hover:bg-white/5 px-2 py-0.5 rounded">
                {p}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="text-white/30 px-2 py-2">Aucun process correspondant.</div>
            )}
          </div>
        </div>

        <div className="px-4 py-2 border-t border-white/10 text-[10px] text-white/40">
          Astuce : si ton jeu apparait ici mais n'est pas dans "Jeux connus", copie son nom exact
          et ajoute-le dans <code className="text-white/60">desktop/games/registry.json</code>.
        </div>
      </div>
    </div>
  );
}
