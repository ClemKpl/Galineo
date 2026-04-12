'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const STATUS_STYLES: Record<string, string> = {
  prévu:   'bg-stone-100 text-stone-600',
  engagé:  'bg-amber-100 text-amber-700',
  payé:    'bg-emerald-100 text-emerald-700',
  annulé:  'bg-red-100 text-red-500',
};

const CATEGORY_COLORS: Record<string, string> = {
  Personnel:       'bg-orange-100 text-orange-700',
  Matériel:        'bg-blue-100 text-blue-700',
  Logiciel:        'bg-purple-100 text-purple-700',
  'Sous-traitance':'bg-red-100 text-red-700',
  Marketing:       'bg-pink-100 text-pink-700',
  Divers:          'bg-stone-100 text-stone-600',
};

function fmt(cents: number, devise: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: devise || 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

interface Entry {
  id: number;
  title: string;
  amount: number;
  amount_cents: number;
  category: string;
  status: string;
  entry_date: string | null;
  notes: string | null;
  attachment_url: string | null;
  created_by_email: string | null;
  created_by_name: string | null;
  created_by: number;
}

interface BudgetEntryTableProps {
  entries: Entry[];
  devise: string;
  canEdit: boolean;
  canDelete: boolean;
  currentUserId: number;
  currentRoleId: number;
  projectId: string;
  onEdit: (entry: Entry) => void;
  onDeleted: () => void;
}

export default function BudgetEntryTable({
  entries,
  devise,
  canDelete,
  currentUserId,
  currentRoleId,
  projectId,
  onEdit,
  onDeleted,
}: BudgetEntryTableProps) {
  const { showToast } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch] = useState('');

  const filtered = entries.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Top 5 dépenses
  const top5 = [...entries]
    .filter(e => e.amount_cents < 0 && (e.status === 'payé' || e.status === 'engagé'))
    .sort((a, b) => a.amount_cents - b.amount_cents)
    .slice(0, 5);

  async function handleDelete(id: number) {
    if (!confirm('Supprimer définitivement cette ligne budgétaire ?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/projects/${projectId}/budget/entries/${id}`);
      showToast('Ligne supprimée', 'success');
      onDeleted();
    } catch (err: any) {
      showToast(err.message || 'Erreur', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  function canEditEntry(entry: Entry) {
    if (currentRoleId <= 2) return true;
    if (currentRoleId === 3 && entry.created_by === currentUserId) return true;
    return false;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top 5 */}
      {top5.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3">Top 5 postes de dépense</p>
          <div className="flex flex-col gap-2">
            {top5.map((e, i) => (
              <div key={e.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-black text-stone-300 w-4 shrink-0">#{i + 1}</span>
                  <span className="text-sm text-stone-700 font-semibold truncate">{e.title}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full shrink-0 ${CATEGORY_COLORS[e.category] || 'bg-stone-100 text-stone-500'}`}>{e.category}</span>
                </div>
                <span className="text-sm font-black text-red-600 shrink-0">{fmt(Math.abs(e.amount_cents), devise)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        {/* Filtres */}
        <div className="p-4 border-b border-stone-100 flex flex-wrap gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 flex-1 min-w-32"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
          >
            <option value="">Tous les statuts</option>
            <option value="prévu">Prévu</option>
            <option value="engagé">Engagé</option>
            <option value="payé">Payé</option>
            <option value="annulé">Annulé</option>
          </select>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
          >
            <option value="">Toutes les catégories</option>
            {['Personnel', 'Matériel', 'Logiciel', 'Sous-traitance', 'Marketing', 'Divers'].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-stone-400 text-sm">Aucune ligne budgétaire</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-400">Titre</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-400">Catégorie</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-400">Statut</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-stone-400">Montant</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-stone-400">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {filtered.map(entry => (
                  <tr key={entry.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-stone-900">{entry.title}</p>
                        {entry.notes && <p className="text-[11px] text-stone-400 truncate max-w-xs">{entry.notes}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${CATEGORY_COLORS[entry.category] || 'bg-stone-100 text-stone-500'}`}>
                        {entry.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-[10px] font-black rounded-full ${STATUS_STYLES[entry.status] || 'bg-stone-100 text-stone-500'}`}>
                        {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-black ${entry.amount_cents < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {entry.amount_cents < 0 ? '−' : '+'}{fmt(Math.abs(entry.amount_cents), devise)}
                    </td>
                    <td className="px-4 py-3 text-stone-500 text-xs">
                      {entry.entry_date ? new Date(entry.entry_date).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {canEditEntry(entry) && (
                          <button
                            onClick={() => onEdit(entry)}
                            className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
                            title="Modifier"
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(entry.id)}
                            disabled={deletingId === entry.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors"
                            title="Supprimer"
                          >
                            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
