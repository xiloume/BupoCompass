import React, { useEffect, useMemo, useState } from 'react';
import useFocusableWhenOpen from '../hooks/useFocusableWhenOpen';

const TABS = [
  { id: 'local', label: 'Mes templates' },
  { id: 'steam', label: 'Steam (g\u00e9n\u00e9rer)' },
  { id: 'community', label: 'Communaut\u00e9' },
];

export default function TemplateBrowser({ open, onClose, onImport }) {
  const [tab, setTab] = useState('local');
  const [search, setSearch] = useState('');
  const [localGames, setLocalGames] = useState([]);
  const [steamResults, setSteamResults] = useState([]);
  const [communityResults, setCommunityResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(null); // appId being generated
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  useFocusableWhenOpen(open);

  // Load local templates whenever opened
  useEffect(() => {
    if (!open) return;
    if (!window.electronAPI?.listLocalTemplates) return;
    window.electronAPI.listLocalTemplates().then((r) => {
      setLocalGames(r?.games || []);
    });
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (tab === 'local') return;
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      setSteamResults([]);
      setCommunityResults([]);
      return;
    }
    setLoading(true);
    setError('');
    const handle = setTimeout(async () => {
      try {
        if (tab === 'steam' && window.electronAPI?.searchSteamGames) {
          const r = await window.electronAPI.searchSteamGames(trimmed);
          if (r?.error) setError(r.error);
          setSteamResults(r?.results || []);
        } else if (tab === 'community' && window.electronAPI?.browseCommunityTemplates) {
          const r = await window.electronAPI.browseCommunityTemplates(trimmed);
          setCommunityResults(r?.items || r?.data || []);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [search, tab, open]);

  // Load community list on tab activate (empty query)
  useEffect(() => {
    if (!open || tab !== 'community') return;
    if (search.trim()) return;
    setLoading(true);
    window.electronAPI?.browseCommunityTemplates?.('').then((r) => {
      setCommunityResults(r?.items || r?.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [tab, open, search]);

  const filteredLocal = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return localGames;
    return localGames.filter((g) =>
      (g.name || '').toLowerCase().includes(q) ||
      (g.id || '').toLowerCase().includes(q)
    );
  }, [localGames, search]);

  const handleGenerate = async (appId, name) => {
    setError('');
    setGenerating(appId);
    try {
      const r = await window.electronAPI.generateTemplate(appId, { lang: 'french' });
      if (!r?.ok) throw new Error(r?.error || 'Erreur g\u00e9n\u00e9ration');
      const entry = {
        ...r.entry,
        name,
        id: String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      };
      setPreview(entry);
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(null);
    }
  };

  const handleSaveGenerated = async () => {
    if (!preview) return;
    const r = await window.electronAPI.saveTemplate(preview);
    if (r?.ok) {
      // Refresh local list and switch tab
      const list = await window.electronAPI.listLocalTemplates();
      setLocalGames(list?.games || []);
      setPreview(null);
      setTab('local');
    } else {
      setError(r?.error || 'Erreur sauvegarde');
    }
  };

  const handleImport = (game) => {
    onImport?.(game);
    onClose?.();
  };

  const handleDelete = async (id) => {
    if (!confirm('Supprimer ce template ?')) return;
    await window.electronAPI.deleteTemplate(id);
    const list = await window.electronAPI.listLocalTemplates();
    setLocalGames(list?.games || []);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-white/10 rounded-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
          <h3 className="text-white font-semibold">Templates de checklist</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-2 flex gap-1 border-b border-white/10">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setPreview(null); setError(''); }}
              className={`px-3 py-1.5 text-sm rounded-t ${
                tab === t.id
                  ? 'bg-white/10 text-white border-b-2 border-emerald-400'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div className="px-4 py-2 border-b border-white/10">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === 'steam'
                ? 'Rechercher un jeu Steam (ex: Hollow Knight)...'
                : tab === 'community'
                ? 'Rechercher dans la communaut\u00e9...'
                : 'Filtrer mes templates...'
            }
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-white/30 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
              {error}
            </div>
          )}

          {preview ? (
            <TemplatePreview
              entry={preview}
              onCancel={() => setPreview(null)}
              onSave={handleSaveGenerated}
            />
          ) : tab === 'local' ? (
            <LocalList
              games={filteredLocal}
              onImport={handleImport}
              onDelete={handleDelete}
            />
          ) : tab === 'steam' ? (
            <SteamSearchList
              results={steamResults}
              loading={loading}
              generating={generating}
              onGenerate={handleGenerate}
              minQueryLength={search.trim().length < 2}
            />
          ) : (
            <CommunityList
              results={communityResults}
              loading={loading}
              onImport={handleImport}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function LocalList({ games, onImport, onDelete }) {
  if (!games.length) {
    return (
      <div className="text-white/40 text-sm text-center py-8">
        Aucun template local. Va dans l'onglet <strong>Steam</strong> pour en g&eacute;n&eacute;rer un automatiquement.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {games.map((g) => {
        const zonesCount = g.checklistTemplate?.zones?.length || 0;
        const itemsCount = (g.checklistTemplate?.zones || []).reduce(
          (acc, z) => acc + (z.items?.length || 0),
          0
        );
        return (
          <div
            key={g.id}
            className="bg-white/5 hover:bg-white/10 border border-white/10 rounded p-3 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <div className="text-white font-medium truncate">{g.name}</div>
              <div className="text-xs text-white/40">
                {zonesCount} zone(s) - {itemsCount} succès
                {g.steamAppId && <span className="ml-2 text-blue-400/60">Steam #{g.steamAppId}</span>}
              </div>
            </div>
            <button
              onClick={() => onImport(g)}
              className="px-3 py-1 text-xs bg-emerald-500 text-black font-medium rounded hover:bg-emerald-400"
            >
              Importer
            </button>
            <button
              onClick={() => onDelete(g.id)}
              className="px-2 py-1 text-xs text-red-400/70 hover:text-red-400"
              title="Supprimer"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SteamSearchList({ results, loading, generating, onGenerate, minQueryLength }) {
  if (minQueryLength) {
    return (
      <div className="text-white/40 text-sm text-center py-8">
        Tape au moins 2 caract&egrave;res pour chercher un jeu Steam.
      </div>
    );
  }
  if (loading) {
    return <div className="text-white/40 text-sm text-center py-8">Recherche...</div>;
  }
  if (!results.length) {
    return <div className="text-white/40 text-sm text-center py-8">Aucun r&eacute;sultat</div>;
  }
  return (
    <div className="space-y-1">
      {results.map((r) => (
        <div
          key={r.appId}
          className="bg-white/5 hover:bg-white/10 border border-white/10 rounded p-2 flex items-center gap-2"
        >
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm truncate">{r.name}</div>
            <div className="text-[10px] text-white/40">appId {r.appId}</div>
          </div>
          <button
            disabled={generating === r.appId}
            onClick={() => onGenerate(r.appId, r.name)}
            className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
          >
            {generating === r.appId ? 'G\u00e9n\u00e9ration...' : 'G\u00e9n\u00e9rer'}
          </button>
        </div>
      ))}
    </div>
  );
}

function CommunityList({ results, loading, onImport }) {
  if (loading) {
    return <div className="text-white/40 text-sm text-center py-8">Chargement...</div>;
  }
  if (!results || !results.length) {
    return (
      <div className="text-white/40 text-sm text-center py-8">
        Aucun template communautaire disponible pour le moment.
        <div className="text-xs text-white/30 mt-2">
          Connexion API requise. V&eacute;rifie ta connexion au serveur communautaire.
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {results.map((c, i) => (
        <div key={c.id || i} className="bg-white/5 border border-white/10 rounded p-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-white font-medium">{c.name || c.title}</div>
              {c.author && (
                <div className="text-xs text-white/50">par {c.author}</div>
              )}
              <div className="text-xs text-white/40 mt-1">
                {c.votes !== undefined && <span>★ {c.votes} </span>}
                {c.itemCount && <span>- {c.itemCount} items </span>}
              </div>
              {c.description && (
                <div className="text-xs text-white/60 mt-1 line-clamp-2">{c.description}</div>
              )}
            </div>
            <button
              onClick={() => onImport(c)}
              className="px-3 py-1 text-xs bg-emerald-500 text-black font-medium rounded hover:bg-emerald-400"
            >
              Importer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplatePreview({ entry, onCancel, onSave }) {
  const zones = entry.checklistTemplate?.zones || [];
  const totalItems = zones.reduce((acc, z) => acc + (z.items?.length || 0), 0);
  return (
    <div className="space-y-3">
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded p-3">
        <div className="text-emerald-300 font-medium">{entry.name}</div>
        <div className="text-xs text-white/60 mt-1">
          {zones.length} zone(s) - {totalItems} succès
        </div>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {zones.map((z, i) => (
          <details key={i} className="bg-white/5 border border-white/10 rounded">
            <summary className="cursor-pointer px-3 py-2 text-sm text-white/80 hover:bg-white/5">
              {z.name} <span className="text-white/40">({z.items?.length || 0})</span>
            </summary>
            <div className="px-3 pb-2 text-xs text-white/60 space-y-1">
              {(z.items || []).slice(0, 30).map((it, j) => (
                <div key={j}>
                  <div className="truncate text-white/80">{it.name}</div>
                  {it.description && (
                    <div className="text-[11px] text-white/40 leading-snug">{it.description}</div>
                  )}
                </div>
              ))}
              {z.items?.length > 30 && (
                <div className="text-white/40">... +{z.items.length - 30} autres</div>
              )}
            </div>
          </details>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-white/60 hover:text-white"
        >
          Annuler
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-black font-medium rounded"
        >
          Sauvegarder ce template
        </button>
      </div>
    </div>
  );
}
