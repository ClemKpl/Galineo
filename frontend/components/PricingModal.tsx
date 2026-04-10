'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  onClose: () => void;
  currentPlan?: 'free' | 'premium' | 'unlimited';
}

const CheckIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="shrink-0 text-emerald-500">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CrossIcon = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="shrink-0 text-stone-300">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function PricingModal({ onClose, currentPlan = 'free' }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    try {
      const data = await api.post('/billing/checkout', {});
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      alert(e.message || 'Erreur lors de la redirection vers Stripe');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-[fadeUp_0.3s_ease-out]">
        {/* Header */}
        <div className="bg-stone-900 px-8 py-8 text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-stone-500 hover:text-stone-300 transition-colors p-1">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-1.5 mb-4">
            <svg width="14" height="14" viewBox="0 0 24 24" className="fill-orange-500"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            <span className="text-orange-400 text-xs font-bold uppercase tracking-wider">Choisissez votre forfait</span>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">Passez à la vitesse supérieure</h2>
          <p className="text-stone-400 text-sm">Débloquez tout le potentiel de Galineo avec Premium</p>
        </div>

        {/* Plans */}
        <div className="p-8 grid grid-cols-2 gap-5">
          {/* FREE */}
          <div className={`rounded-2xl border-2 p-6 flex flex-col ${currentPlan === 'free' ? 'border-stone-300 bg-stone-50' : 'border-stone-100 bg-white'}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-stone-500 uppercase tracking-wider">Free</span>
              {currentPlan === 'free' && (
                <span className="text-[10px] font-bold bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Actuel</span>
              )}
            </div>
            <div className="mb-5">
              <span className="text-3xl font-bold text-stone-900">0€</span>
              <span className="text-stone-400 text-sm">/mois</span>
            </div>
            <ul className="space-y-3 flex-1">
              {[
                { ok: true,  text: '3 projets maximum' },
                { ok: true,  text: '2 collaborateurs / projet' },
                { ok: true,  text: '10 prompts IA / total' },
                { ok: false, text: 'Projets illimités' },
                { ok: false, text: 'Collaborateurs illimités' },
                { ok: false, text: 'IA illimitée' },
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-stone-600">
                  {f.ok ? <CheckIcon /> : <CrossIcon />}
                  <span className={f.ok ? '' : 'text-stone-300'}>{f.text}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <div className="w-full text-center py-2.5 rounded-xl bg-stone-100 text-stone-400 text-sm font-semibold cursor-default">
                Plan actuel
              </div>
            </div>
          </div>

          {/* PREMIUM */}
          <div className="rounded-2xl border-2 border-orange-400 bg-white p-6 flex flex-col relative overflow-hidden shadow-lg shadow-orange-100">
            <div className="absolute top-0 right-0 bg-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl tracking-wider uppercase">
              Recommandé
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-orange-500 uppercase tracking-wider">Premium</span>
              {currentPlan === 'premium' && (
                <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase tracking-wider">Actuel</span>
              )}
            </div>
            <div className="mb-5">
              <span className="text-3xl font-bold text-stone-900">10€</span>
              <span className="text-stone-400 text-sm">/mois</span>
            </div>
            <ul className="space-y-3 flex-1">
              {[
                'Projets illimités',
                'Collaborateurs illimités',
                'Prompts IA illimités',
                'Support prioritaire',
                'Accès aux nouvelles fonctionnalités',
                'Badge Premium exclusif ✨',
              ].map((f, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-stone-700">
                  <CheckIcon />
                  {f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {currentPlan === 'unlimited' ? (
                <div className="w-full text-center py-2.5 rounded-xl bg-purple-100 text-purple-600 text-sm font-semibold cursor-default">
                  Accès Illimité Administrateur 👑
                </div>
              ) : currentPlan === 'premium' ? (
                <div className="w-full text-center py-2.5 rounded-xl bg-orange-100 text-orange-500 text-sm font-semibold cursor-default">
                  Déjà Premium 🎉
                </div>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-sm transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      Passer à Premium
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-stone-400 pb-6">
          Paiement sécurisé par Stripe · Annulable à tout moment
        </p>
      </div>

      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
