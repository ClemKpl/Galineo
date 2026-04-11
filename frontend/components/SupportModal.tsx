'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onClose: () => void;
}

type SupportTicket = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  created_at: string;
};

export default function SupportModal({ onClose }: Props) {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [view, setView] = useState<'form' | 'history'>('form');

  const fetchTickets = async () => {
    setTicketsLoading(true);
    try {
      const data = await api.get('/support');
      setTickets(data as SupportTicket[]);
    } catch {
      // Ignorer
    } finally {
      setTicketsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/support', { subject, message });
      setSubject('');
      setMessage('');
      setView('history');
      await fetchTickets();
    } catch (err: any) {
      alert(err.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90dvh] flex flex-col overflow-hidden animate-[fadeUp_0.3s_ease-out]">
        {/* Header */}
        <div className="bg-stone-900 px-6 py-6 text-center relative shrink-0">
          <button onClick={onClose} className="absolute top-4 right-4 text-stone-500 hover:text-stone-300 transition-colors p-1">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          
          <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-1.5 mb-3">
             <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
               <path d="M3 11c0-4.97 4.03-9 9-9s9 4.03 9 9" />
               <rect x="2" y="11" width="4" height="7" rx="2" />
               <rect x="18" y="11" width="4" height="7" rx="2" />
               <path d="M21 16v2a2 2 0 0 1-2 2h-5" />
             </svg>
            <span className="text-orange-400 text-xs font-bold uppercase tracking-wider">Centre d'aide</span>
          </div>
          <h2 className="text-white text-xl font-bold">Besoin d'aide ?</h2>
          <p className="text-stone-400 text-xs mt-1">L'équipe Galineo vous répondra dans les plus brefs délais.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-100 shrink-0">
          <button 
            onClick={() => setView('form')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${view === 'form' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Nouveau ticket
          </button>
          <button 
            onClick={() => setView('history')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${view === 'history' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-stone-400 hover:text-stone-600'}`}
          >
            Mes tickets
            {tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-stone-50/50">
          {view === 'form' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Sujet</label>
                <input 
                  type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required
                  placeholder="Ex: Problème d'affichage des tâches"
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">Message</label>
                <textarea 
                  value={message} onChange={(e) => setMessage(e.target.value)} required rows={5}
                  placeholder="Décrivez votre demande en détail..."
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 transition-all font-medium resize-none shadow-sm"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {user?.plan === 'premium' || user?.plan === 'unlimited' ? (
                  <div className="flex items-center gap-1.5 text-orange-600 font-bold text-[10px] uppercase tracking-wider bg-orange-50 px-2.5 py-1 rounded-full">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                    Support Prioritaire
                  </div>
                ) : (
                  <p className="text-[10px] text-stone-400 italic">Passez à Premium pour un support prioritaire.</p>
                )}
                
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-orange-100 disabled:opacity-60 flex items-center gap-2"
                >
                  {loading && <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                  Envoyer
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              {ticketsLoading ? (
                <div className="flex items-center justify-center py-10 text-stone-400 gap-2">
                  <div className="w-4 h-4 border-2 border-stone-200 border-t-orange-500 rounded-full animate-spin" />
                  Chargement de l'historique...
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-10 space-y-3">
                  <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-300">
                    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
                  </div>
                  <p className="text-sm font-medium text-stone-500">Aucun ticket pour le moment</p>
                </div>
              ) : (
                tickets.map(t => (
                  <div key={t.id} className={`bg-white border rounded-2xl p-4 shadow-sm transition-all hover:border-orange-200 ${t.status === 'open' ? 'border-emerald-100' : 'border-stone-100'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-bold text-stone-900 leading-tight">{t.subject}</p>
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0 ${
                        t.status === 'closed' ? 'bg-stone-100 text-stone-400' :
                        t.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                        'bg-emerald-100 text-emerald-600'
                      }`}>
                        {t.status === 'closed' ? 'Fermé' : t.status === 'in_progress' ? 'En cours' : 'Ouvert'}
                      </span>
                    </div>
                    {t.admin_reply && (
                      <div className="mt-3 bg-orange-50/50 border-l-2 border-orange-400 rounded-r-lg p-3">
                        <p className="text-[10px] font-black text-orange-600 uppercase mb-1">Réponse de l'équipe</p>
                        <p className="text-xs text-stone-600 leading-relaxed italic">{t.admin_reply}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-stone-400 mt-2.5">Posté le {new Date(t.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
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
