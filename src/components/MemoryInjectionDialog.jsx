import React, { useState } from 'react';

const STORAGE_KEY = 'bupo-memory-injection-enabled';

export function getMemoryInjectionEnabled() {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export default function MemoryInjectionDialog({ open, onClose }) {
  const [enabled, setEnabled] = useState(getMemoryInjectionEnabled());
  const [acknowledged, setAcknowledged] = useState(false);

  if (!open) return null;

  const handleToggle = () => {
    if (!enabled && !acknowledged) return;
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-dark-900 border border-red-500/30 rounded-xl max-w-lg w-full overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-red-500/10">
          <h3 className="text-red-300 font-semibold">
            ⚠️ Memory Injection - Mode exp&eacute;rimental
          </h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">
            &times;
          </button>
        </div>

        <div className="px-4 py-4 space-y-3 text-sm text-white/80">
          <div className="bg-red-500/10 border border-red-500/30 rounded p-3 space-y-2">
            <div className="text-red-300 font-semibold">
              ATTENTION : Risque de bannissement
            </div>
            <ul className="text-xs text-red-200/80 list-disc pl-4 space-y-1">
              <li>
                <strong>Les anti-cheats (Easy Anti-Cheat, BattlEye, VAC, Vanguard...)
                d&eacute;tectent la lecture m&eacute;moire comme du cheat</strong> et peuvent bannir
                ton compte du jeu et/ou de la plateforme.
              </li>
              <li>
                M&ecirc;me en lecture seule, certaines protections (HyperGuard, kernel-mode)
                d&eacute;tectent l'attachement de processus.
              </li>
              <li>
                Les jeux multijoueur sont les plus risqu&eacute;s. Pour les jeux solo
                <strong> sans anti-cheat</strong> (comme Graveyard Keeper), le risque est minime
                mais non nul.
              </li>
              <li>
                Cette fonctionnalit&eacute; n&eacute;cessite des privil&egrave;ges
                administrateur et des modules natifs (memoryjs, koffi).
              </li>
            </ul>
          </div>

          <div className="text-xs text-white/60">
            <p className="mb-2">
              <strong className="text-white">Comment &ccedil;a marche :</strong> Memory injection
              attache BupoCompass au processus du jeu et lit les variables en m&eacute;moire
              (ex: liste des qu&ecirc;tes accomplies, technologies d&eacute;bloqu&eacute;es).
            </p>
            <p className="mb-2">
              <strong className="text-white">Pourquoi pas par d&eacute;faut :</strong> en plus du
              risque anti-cheat, chaque jeu a des offsets m&eacute;moire diff&eacute;rents qui
              changent &agrave; chaque mise &agrave; jour. C'est instable et demande une signature
              par version.
            </p>
            <p>
              <strong className="text-white">Alternative recommand&eacute;e :</strong> utilise les
              <strong> Steam achievements</strong> (s&eacute;curis&eacute; et sans risque).
            </p>
          </div>

          <label className="flex items-start gap-2 text-xs text-white/70 cursor-pointer">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Je comprends les risques et j'accepte que mon compte de jeu puisse &ecirc;tre
              banni. Je n'utiliserai cette fonction que sur des jeux solo sans anti-cheat.
            </span>
          </label>

          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
            <button
              onClick={handleToggle}
              disabled={!enabled && !acknowledged}
              className={`px-3 py-1.5 rounded text-sm font-medium ${
                enabled
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-white/10 text-white/60 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed'
              }`}
            >
              {enabled ? 'D&eacute;sactiver' : 'Activer (&agrave; mes risques)'}
            </button>
            <span
              className={`text-xs ${enabled ? 'text-red-400' : 'text-white/40'}`}
            >
              Statut : {enabled ? 'ACTIV&Eacute;' : 'D&eacute;sactiv&eacute;'}
            </span>
          </div>

          {enabled && (
            <div className="text-[10px] text-yellow-400/70 italic">
              Note : Aucun adapter de m&eacute;moire n'est install&eacute;. Cette fonction est pour
              l'instant un placeholder - il faut ajouter des modules sp&eacute;cifiques par jeu.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
