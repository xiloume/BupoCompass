import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function DashboardPage() {
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMyChecklists().then((data) => {
      setChecklists(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Mes jeux</h1>

      {checklists.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-white/30 text-sm mb-4">Aucune checklist pour le moment.</p>
          <Link
            to="/browse"
            className="inline-block bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg text-sm hover:bg-emerald-500/30 transition-colors"
          >
            Parcourir les checklists
          </Link>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {checklists.map((cl) => (
            <GameCard key={cl.id} checklist={cl} />
          ))}
        </div>
      )}
    </div>
  );
}

function GameCard({ checklist }) {
  return (
    <Link
      to={`/game/${checklist.id}`}
      className="block bg-dark-800 rounded-xl p-4 border border-white/5 hover:border-emerald-400/20 transition-colors"
    >
      <h3 className="text-white font-medium text-sm truncate">{checklist.title}</h3>
      <p className="text-white/40 text-xs mt-1">{checklist.game_name || 'Jeu'}</p>
      <div className="mt-3">
        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all"
            style={{ width: '0%' }}
          />
        </div>
        <p className="text-white/30 text-xs mt-1">
          Mis &agrave; jour {new Date(checklist.updated_at).toLocaleDateString('fr-FR')}
        </p>
      </div>
    </Link>
  );
}
