import React, { useEffect, useState } from 'react';
import api from '../services/api';

export default function ShopPage() {
  const [plans, setPlans] = useState([]);
  const [isVip, setIsVip] = useState(false);
  const [activeSub, setActiveSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);

  useEffect(() => {
    api.request('GET', '/shop/plans').then((data) => {
      setPlans(data.plans || []);
      setIsVip(data.is_vip);
      setActiveSub(data.active_subscription);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handlePurchase = async (planId) => {
    setPurchasing(planId);
    try {
      // Create checkout
      const checkout = await api.request('POST', '/shop/checkout', { plan: planId });

      // In production: redirect to checkout.checkout_url (Stripe)
      // For dev: auto-confirm
      const confirmed = await api.request('POST', '/shop/confirm', {
        checkout_id: checkout.checkout_id,
        plan: planId,
        provider: 'stripe',
      });

      setIsVip(true);
      alert('VIP activ\u00e9 ! Merci pour votre achat.');
    } catch (err) {
      alert('Erreur : ' + err.message);
    } finally {
      setPurchasing(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('\u00cates-vous s\u00fbr de vouloir annuler votre abonnement ?')) return;
    try {
      await api.request('POST', '/shop/cancel');
      setIsVip(false);
      setActiveSub(null);
      alert('Abonnement annul\u00e9.');
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
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Boutique VIP</h1>
        <p className="text-white/40 text-sm mt-1">
          D\u00e9bloquez des fonctionnalit\u00e9s exclusives
        </p>
      </div>

      {/* VIP Status */}
      {isVip && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
          <span className="text-yellow-400 text-lg font-bold">\u2B50 VIP Actif</span>
          {activeSub?.expires_at && (
            <p className="text-white/40 text-xs mt-1">
              Expire le {new Date(activeSub.expires_at).toLocaleDateString('fr-FR')}
            </p>
          )}
          {activeSub && (
            <button
              onClick={handleCancel}
              className="mt-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
            >
              Annuler l'abonnement
            </button>
          )}
        </div>
      )}

      {/* VIP Benefits */}
      <div className="bg-dark-800 rounded-xl p-5 border border-white/5">
        <h2 className="text-white font-medium mb-3">Avantages VIP</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2 text-white/60">
            <span className="text-emerald-400">\u2713</span>
            Th\u00e8mes exclusifs (Neon, Gold, Cherry Blossom)
          </li>
          <li className="flex items-center gap-2 text-white/60">
            <span className="text-emerald-400">\u2713</span>
            Marqueurs personnalis\u00e9s (ic\u00f4nes, couleurs par item)
          </li>
          <li className="flex items-center gap-2 text-white/60">
            <span className="text-emerald-400">\u2713</span>
            Checklists illimit\u00e9es (au lieu de 5)
          </li>
          <li className="flex items-center gap-2 text-white/60">
            <span className="text-emerald-400">\u2713</span>
            Badge VIP sur le profil communautaire
          </li>
          <li className="flex items-center gap-2 text-white/60">
            <span className="text-emerald-400">\u2713</span>
            Statistiques avanc\u00e9es (pr\u00e9dictions, heatmaps)
          </li>
          <li className="flex items-center gap-2 text-white/60">
            <span className="text-emerald-400">\u2713</span>
            Support prioritaire
          </li>
        </ul>
      </div>

      {/* Plans */}
      {!isVip && (
        <div className="grid gap-3 sm:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-dark-800 rounded-xl p-5 border transition-colors ${
                plan.id === 'yearly' ? 'border-emerald-400/30' : 'border-white/5'
              }`}
            >
              {plan.id === 'yearly' && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  POPULAIRE
                </span>
              )}
              <div className="text-center">
                <h3 className="text-white font-medium capitalize">{plan.id}</h3>
                <div className="text-2xl font-bold text-white mt-2">
                  {(plan.price_cents / 100).toFixed(2)}\u20ac
                </div>
                <p className="text-white/30 text-xs mt-1">
                  {plan.duration_days ? `${plan.duration_days} jours` : '\u00c0 vie'}
                </p>
              </div>
              <button
                onClick={() => handlePurchase(plan.id)}
                disabled={purchasing === plan.id}
                className={`w-full mt-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  plan.id === 'yearly'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-white/70'
                } disabled:opacity-50`}
              >
                {purchasing === plan.id ? '...' : 'Choisir'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
