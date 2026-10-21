import React, { useEffect, useState } from 'react';
import useFocusableWhenOpen from '../hooks/useFocusableWhenOpen';

export default function SteamConfigDialog({ open, onClose, onSaved }) {
  const [status, setStatus] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [lang, setLang] = useState('french');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useFocusableWhenOpen(open);

  useEffect(() => {
    if (!open) return;
    if (!window.electronAPI?.getSteamConfigStatus) return;
    window.electronAPI.getSteamConfigStatus().then((s) => {
      setStatus(s);
      if (s?.steamId) setSteamId(s.steamId);
      if (s?.lang) setLang(s.lang);
      // Don't pre-fill apiKey for security
    });
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!window.electronAPI?.setSteamConfig) return;
    setSaving(true);
    setSavedMsg('');
    const trimmedKey = apiKey.trim();
    const trimmedId = steamId.trim();
    const r = await window.electronAPI.setSteamConfig({
      apiKey: trimmedKey,
      steamId: trimmedId,
      lang,
    });
    setSaving(false);
    if (r?.ok) {
      setSavedMsg('Sauvegard\u00e9 ✓');
      const s = await window.electronAPI.getSteamConfigStatus();
      setStatus(s);
      setApiKey('');
      onSaved?.();
      setTimeout(() => setSavedMsg(''), 2000);
    } else {
      setSavedMsg(`Erreur: ${r?.error || 'inconnue'}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-blue-500/30 rounded-xl max-w-lg w-full overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-blue-500/10">
          <h3 className="text-blue-300 font-semibold">Configuration Steam</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">
            &times;
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 text-sm">
          <div className="text-xs text-white/60">
            BupoCompass synchronise tes achievements Steam pour cocher la checklist
            automatiquement.
          </div>

          {status && (
            <div className="bg-white/5 border border-white/10 rounded p-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-white/50">SteamID:</span>
                <span className={status.hasSteamId ? 'text-emerald-400' : 'text-white/40'}>
                  {status.hasSteamId ? status.steamId : 'non configur\u00e9'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Cl&eacute; API:</span>
                <span className={status.hasApiKey ? 'text-emerald-400' : 'text-white/40'}>
                  {status.hasApiKey ? status.apiKeyMasked : 'optionnelle'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Langue des succ&egrave;s:</span>
                <span className="text-emerald-400">{status.lang || 'french'}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block">
              <div className="text-xs text-white/70 mb-1">
                SteamID 64{' '}
                <span className="text-emerald-400/80">(requis)</span>{' '}
                <a
                  href="https://steamid.io"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  trouver mon SteamID
                </a>
              </div>
              <input
                type="text"
                value={steamId}
                onChange={(e) => setSteamId(e.target.value)}
                placeholder="76561198XXXXXXXXX"
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <div className="text-xs text-white/70 mb-1">
                Cl&eacute; API Steam{' '}
                <span className="text-white/40">(optionnel)</span>{' '}
                <a
                  href="https://steamcommunity.com/dev/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:underline"
                >
                  g&eacute;n&eacute;rer
                </a>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={status?.hasApiKey ? '(d\u00e9j\u00e0 configur\u00e9e)' : 'Laisse vide si profil public'}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white font-mono text-xs"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <div className="text-xs text-white/70 mb-1">
                Langue des succ&egrave;s{' '}
                <span className="text-white/40">(noms et descriptifs)</span>
              </div>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-xs"
              >
                <option value="french">Fran&ccedil;ais</option>
                <option value="english">English</option>
                <option value="spanish">Espa&ntilde;ol</option>
                <option value="german">Deutsch</option>
                <option value="italian">Italiano</option>
              </select>
              <div className="text-[10px] text-white/40 mt-1">
                Apr&egrave;s un changement, r&eacute;g&eacute;n&egrave;re le template du jeu (onglet
                {' '}<strong>Templates &rarr; Steam</strong>) pour mettre &agrave; jour les libell&eacute;s.
              </div>
            </label>
          </div>

          <div className="bg-blue-500/5 border border-blue-500/20 rounded p-2 text-[11px] text-white/70 space-y-1">
            <div className="font-medium text-blue-300">Deux modes possibles :</div>
            <div>
              <strong className="text-white/80">Profil public</strong> (recommand&eacute;, sans cl&eacute;): rends ton profil Steam et tes
              achievements <strong>publics</strong> dans Steam &rarr; Profil &rarr; Confidentialit&eacute;.
              Seul le SteamID est requis.
            </div>
            <div>
              <strong className="text-white/80">Avec cl&eacute; API</strong>: fonctionne m&ecirc;me avec un profil priv&eacute;.
              La cl&eacute; reste sur ton ordinateur (chiffr&eacute;e).
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <button
              onClick={handleSave}
              disabled={saving || (!apiKey.trim() && !steamId.trim() && !lang)}
              className="px-3 py-1.5 rounded text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded text-sm bg-white/10 text-white/70 hover:bg-white/20"
            >
              Fermer
            </button>
            {savedMsg && (
              <span
                className={`text-xs ${
                  savedMsg.startsWith('Erreur') ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {savedMsg}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
