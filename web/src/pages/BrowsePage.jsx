import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function BrowsePage() {
  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getGames().then((data) => {
      setGames(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSelectGame = async (game) => {
    setSelectedGame(game);
    try {
      const result = await api.getGameChecklists(game.slug);
      setChecklists(result.checklists || []);
    } catch {
      setChecklists([]);
    }
  };

  const handleFork = async (checklistId) => {
    try {
      await api.forkChecklist(checklistId);
      alert('Checklist ajout\u00e9e \u00e0 votre profil !');
    } catch (err) {
      alert('Erreur : ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Parcourir les checklists</h1>

      {/* Game list */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => handleSelectGame(game)}
            className={`text-left px-4 py-3 rounded-xl border transition-colors ${
              selectedGame?.id === game.id
                ? 'border-emerald-400/30 bg-emerald-400/5'
                : 'border-white/5 bg-dark-800 hover:border-white/10'
            }`}
          >
            <span className="text-white text-sm font-medium">{game.name}</span>
          </button>
        ))}
      </div>

      {games.length === 0 && (
        <p className="text-white/30 text-sm text-center py-8">
          Aucun jeu disponible pour le moment.
        </p>
      )}

      {/* Checklists for selected game */}
      {selectedGame && (
        <div>
          <h2 className="text-lg font-medium mb-3">
            Checklists &mdash; {selectedGame.name}
          </h2>
          {checklists.length === 0 ? (
            <p className="text-white/30 text-sm">Aucune checklist publi&eacute;e pour ce jeu.</p>
          ) : (
            <div className="space-y-2">
              {checklists.map((cl) => (
                <div
                  key={cl.id}
                  className="flex items-center justify-between bg-dark-800 rounded-xl px-4 py-3 border border-white/5"
                >
                  <div>
                    <p className="text-white text-sm font-medium">{cl.title}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      par {cl.author_name} &middot; v{cl.version}
                    </p>
                  </div>
                  <button
                    onClick={() => handleFork(cl.id)}
                    className="bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1.5 rounded-lg hover:bg-emerald-500/30 transition-colors flex-shrink-0"
                  >
                    + Ajouter
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
