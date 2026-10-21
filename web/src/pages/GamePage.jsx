import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function GamePage() {
  const { id } = useParams();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getChecklist(id).then((data) => {
      setChecklist(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!checklist) {
    return <p className="text-white/40 text-center py-10">Checklist introuvable.</p>;
  }

  const totalItems = checklist.zones?.reduce((acc, z) => acc + (z.items?.length || 0), 0) || 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link to="/" className="text-white/40 text-xs hover:text-white/60 mb-2 inline-block">
          &larr; Retour
        </Link>
        <h1 className="text-xl font-bold">{checklist.title}</h1>
        <p className="text-white/40 text-sm mt-1">
          {checklist.zones?.length || 0} zones &middot; {totalItems} items
        </p>
      </div>

      {/* Zones */}
      <div className="space-y-4">
        {(checklist.zones || []).map((zone) => (
          <ZoneCard key={zone.id} zone={zone} />
        ))}
      </div>
    </div>
  );
}

function ZoneCard({ zone }) {
  const [open, setOpen] = useState(false);
  const items = zone.items || [];
  const total = items.reduce((s, i) => s + (i.total || 1), 0);

  return (
    <div className="bg-dark-800 rounded-xl border border-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <span className="text-white font-medium text-sm">{zone.name}</span>
        <span className="text-white/40 text-xs">
          {items.length} items &middot; total {total}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-1 border-t border-white/5">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-1.5">
              <span className="text-white/70 text-xs truncate flex-1">{item.name}</span>
              <span className="text-white/40 text-xs font-mono ml-2">
                0/{item.total || 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
