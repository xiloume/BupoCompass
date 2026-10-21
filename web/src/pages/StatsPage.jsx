import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function StatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.request('GET', '/stats').then((data) => {
      setStats(data);
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

  if (!stats) {
    return <p className="text-white/40 text-center py-10">Impossible de charger les statistiques.</p>;
  }

  const { global, games, activity, summary } = stats;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Statistiques</h1>

      {/* Global progress */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Progression" value={`${global.percentage}%`} accent />
        <StatCard label="Collect&eacute;s" value={`${global.collected}/${global.total_collectibles}`} />
        <StatCard label="Zones compl&egrave;tes" value={`${summary.completed_zones}/${summary.total_zones}`} />
        <StatCard label="Jours actifs (30j)" value={summary.active_days_30} />
      </div>

      {/* Global progress bar */}
      <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/60 text-sm">Progression globale</span>
          <span className="text-emerald-400 text-sm font-mono">{global.percentage}%</span>
        </div>
        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${global.percentage}%` }}
          />
        </div>
      </div>

      {/* Per-game breakdown */}
      <div>
        <h2 className="text-lg font-medium mb-3">Par jeu</h2>
        <div className="space-y-2">
          {games.map((game) => {
            const pct = game.total_collectibles > 0
              ? Math.round((game.collected / game.total_collectibles) * 100)
              : 0;
            return (
              <div key={game.checklist_id} className="bg-dark-800 rounded-xl p-4 border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <div>
                    <span className="text-white text-sm font-medium">{game.game_name}</span>
                    <span className="text-white/30 text-xs ml-2">{game.checklist_title}</span>
                  </div>
                  <span className={`text-xs font-mono ${pct === 100 ? 'text-emerald-400' : 'text-white/50'}`}>
                    {pct}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct === 100 ? '#10b981' : pct > 50 ? '#f59e0b' : '#ef4444',
                    }}
                  />
                </div>
                <div className="text-white/30 text-xs mt-1">
                  {game.collected}/{game.total_collectibles} &middot; {game.item_count} items
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Activity chart (simple bar chart) */}
      <div>
        <h2 className="text-lg font-medium mb-3">Activit&eacute; (30 derniers jours)</h2>
        <div className="bg-dark-800 rounded-xl p-4 border border-white/5">
          {activity.length === 0 ? (
            <p className="text-white/30 text-xs text-center py-4">Aucune activit&eacute; r&eacute;cente.</p>
          ) : (
            <div className="flex items-end gap-0.5 h-24">
              {activity.map((day) => {
                const maxActions = Math.max(...activity.map((d) => d.actions));
                const height = maxActions > 0 ? (day.actions / maxActions) * 100 : 0;
                return (
                  <div
                    key={day.date}
                    className="flex-1 rounded-t transition-all hover:opacity-80"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                      backgroundColor: '#10b981',
                      opacity: 0.6 + (height / 100) * 0.4,
                    }}
                    title={`${day.date}: ${day.actions} actions`}
                  />
                );
              })}
            </div>
          )}
          {activity.length > 0 && (
            <div className="flex justify-between text-white/20 text-[10px] mt-1">
              <span>{activity[0]?.date}</span>
              <span>{activity[activity.length - 1]?.date}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="bg-dark-800 rounded-xl p-3 border border-white/5 text-center">
      <div className={`text-lg font-bold ${accent ? 'text-emerald-400' : 'text-white'}`}>
        {value}
      </div>
      <div className="text-white/40 text-xs mt-0.5">{label}</div>
    </div>
  );
}
