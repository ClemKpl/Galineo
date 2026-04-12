'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

const CATEGORIES = ['Personnel', 'Matériel', 'Logiciel', 'Sous-traitance', 'Marketing', 'Divers'];
const STATUSES = ['prévu', 'engagé', 'payé', 'annulé'];

interface BudgetEntry {
  id?: number;
  title: string;
  amount: number;
  category: string;
  status: string;
  entry_date: string | null;
  notes: string | null;
  attachment_url: string | null;
}

interface BudgetEntryFormProps {
  projectId: string;
  entry?: BudgetEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function BudgetEntryForm({ projectId, entry, onClose, onSaved }: BudgetEntryFormProps) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [isDepense, setIsDepense] = useState(true);
  const [category, setCategory] = useState('Divers');
  const [status, setStatus] = useState('prévu');
  const [entryDate, setEntryDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setAmount(String(Math.abs(entry.amount)));
      setIsDepense(entry.amount < 0);
      setCategory(entry.category);
      setStatus(entry.status);
      setEntryDate(entry.entry_date || '');
      setNotes(entry.notes || '');
    }
  }, [entry]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return showToast('Titre requis', 'error');
    if (!amount) return showToast('Montant requis', 'error');

    setSaving(true);
    try {
      const parsedAmount = parseFloat(amount.replace(',', '.'));
      const finalAmount = isDepense ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
      const payload = {
        title: title.trim(),
        amount: finalAmount,
        category,
        status,
        entry_date: entryDate || null,
        notes: notes.trim() || null,
      };

      if (entry?.id) {
        await api.put(`/projects/${projectId}/budget/entries/${entry.id}`, payload);
        showToast('Ligne mise à jour', 'success');
      } else {
        await api.post(`/projects/${projectId}/budget/entries`, payload);
        showToast('Ligne créée', 'success');
      }
      onSaved();
    } catch (err: any) {
      showToast(err.message || 'Erreur', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-stone-100">
          <h2 className="text-base font-black text-stone-900">
            {entry?.id ? 'Modifier la ligne' : 'Nouvelle ligne budgétaire'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-stone-100 text-stone-400 transition-colors">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {/* Type */}
          <div className="flex rounded-xl overflow-hidden border border-stone-200">
            <button
              type="button"
              onClick={() => setIsDepense(true)}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
                isDepense ? 'bg-red-500 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              Dépense (−)
            </button>
            <button
              type="button"
              onClick={() => setIsDepense(false)}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-wider transition-colors ${
                !isDepense ? 'bg-emerald-500 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'
              }`}
            >
              Revenu (+)
            </button>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Hébergement serveur"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              required
            />
          </div>

          {/* Montant */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">
              Montant (€) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:border-orange-400"
              required
            />
          </div>

          {/* Catégorie + Statut */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Catégorie</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Statut</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Description, référence de facture…"
              rows={3}
              className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-stone-200 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-sm rounded-xl transition-colors disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : entry?.id ? 'Mettre à jour' : 'Créer la ligne'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
