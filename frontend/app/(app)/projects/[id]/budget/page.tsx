'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '../ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import BudgetSummaryCard from '@/components/budget/BudgetSummaryCard';
import BudgetAlertBanner from '@/components/budget/BudgetAlertBanner';
import BudgetCategoryChart from '@/components/budget/BudgetCategoryChart';
import BudgetMonthlyChart from '@/components/budget/BudgetMonthlyChart';
import BudgetEntryTable from '@/components/budget/BudgetEntryTable';
import BudgetEntryForm from '@/components/budget/BudgetEntryForm';

interface BudgetSummary {
  budget_total: number;
  devise: string;
  solde_net: number;
  total_depenses: number;
  total_revenus: number;
  depenses_previsionnelles: number;
  pct_consomme: number;
  alerte: 'warning' | 'critique' | null;
}

interface BudgetEntry {
  id: number;
  title: string;
  amount: number;
  amount_cents: number;
  category: string;
  status: string;
  entry_date: string | null;
  notes: string | null;
  attachment_url: string | null;
  created_by: number;
  created_by_email: string | null;
  created_by_name: string | null;
}

export default function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user } = useAuth();
  const project = useProject() as any;
  const { showToast } = useToast();
  const isReadOnly = project.status !== 'active';

  const [summary, setSummary] = useState<BudgetSummary | null>(null);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Config modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configBudget, setConfigBudget] = useState('');
  const [configDevise, setConfigDevise] = useState('EUR');
  const [savingConfig, setSavingConfig] = useState(false);

  // Entry form
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);

  // Role permissions
  const myRoleId = project.my_role_id ?? 4;
  const isOwnerOrAdmin = myRoleId <= 2 || user?.isAdmin;
  const isMember = myRoleId <= 3 || user?.isAdmin;

  const fetchAll = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([
        api.get(`/projects/${projectId}/budget`),
        api.get(`/projects/${projectId}/budget/entries`),
      ]);
      setSummary(s);
      setEntries(e);
    } catch (err: any) {
      showToast(err.message || 'Erreur de chargement', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.put(`/projects/${projectId}/budget/config`, {
        budget_total: parseFloat(configBudget.replace(',', '.')) || 0,
        devise: configDevise,
      });
      showToast('Budget configuré', 'success');
      setShowConfigModal(false);
      fetchAll();
    } catch (err: any) {
      showToast(err.message || 'Erreur', 'error');
    } finally {
      setSavingConfig(false);
    }
  }

  function openConfigModal() {
    if (summary) {
      setConfigBudget(summary.budget_total > 0 ? String(summary.budget_total / 100) : '');
      setConfigDevise(summary.devise || 'EUR');
    }
    setShowConfigModal(true);
  }

  function handleExportCsv() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('galineo_token') : null;
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
    const url = `${apiBase}/projects/${projectId}/budget/export`;
    const a = document.createElement('a');
    a.href = url + (token ? `?token=${token}` : '');
    // Use fetch with auth header instead
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        a.href = blobUrl;
        a.download = `budget-${projectId}.csv`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => showToast('Erreur export CSV', 'error'));
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 animate-pulse space-y-4">
        <div className="h-8 bg-stone-200 rounded-xl w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-stone-200 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-stone-900 tracking-tight">Budget</h1>
          <p className="text-xs text-stone-400 mt-0.5 font-medium uppercase tracking-wider">
            Gestion financière du projet
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
          {isOwnerOrAdmin && !isReadOnly && (
            <button
              onClick={openConfigModal}
              className="flex items-center gap-2 px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              Configurer
            </button>
          )}
          {isMember && !isReadOnly && (
            <button
              onClick={() => { setEditingEntry(null); setShowEntryForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nouvelle ligne
            </button>
          )}
        </div>
      </div>

      {/* Alert banner */}
      {summary && <BudgetAlertBanner alerte={summary.alerte} pctConsomme={summary.pct_consomme} />}

      {/* Summary cards */}
      {summary && (
        <BudgetSummaryCard
          budgetTotal={summary.budget_total}
          soldeNet={summary.solde_net}
          totalDepenses={summary.total_depenses}
          totalRevenus={summary.total_revenus}
          depensesPrevisionnelles={summary.depenses_previsionnelles}
          pctConsomme={summary.pct_consomme}
          devise={summary.devise}
        />
      )}

      {/* Charts */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <BudgetCategoryChart entries={entries} devise={summary?.devise || 'EUR'} />
          <BudgetMonthlyChart entries={entries} devise={summary?.devise || 'EUR'} />
        </div>
      )}

      {/* Entries table */}
      <BudgetEntryTable
        entries={entries}
        devise={summary?.devise || 'EUR'}
        canEdit={isMember && !isReadOnly}
        canDelete={isOwnerOrAdmin && !isReadOnly}
        currentUserId={user?.id || 0}
        currentRoleId={myRoleId}
        projectId={projectId}
        onEdit={(entry) => { setEditingEntry(entry); setShowEntryForm(true); }}
        onDeleted={fetchAll}
      />

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-stone-100">
              <h2 className="text-base font-black text-stone-900">Configurer le budget</h2>
              <button onClick={() => setShowConfigModal(false)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-400">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSaveConfig} className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Budget total (€)</label>
                <input
                  type="number"
                  value={configBudget}
                  onChange={e => setConfigBudget(e.target.value)}
                  placeholder="Ex: 50000"
                  min="0"
                  step="0.01"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-stone-500 mb-1.5">Devise</label>
                <select
                  value={configDevise}
                  onChange={e => setConfigDevise(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                >
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="USD">USD — Dollar ($)</option>
                  <option value="GBP">GBP — Livre sterling (£)</option>
                  <option value="CHF">CHF — Franc suisse</option>
                  <option value="CAD">CAD — Dollar canadien</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowConfigModal(false)} className="flex-1 py-2.5 border border-stone-200 text-stone-600 font-bold text-sm rounded-xl hover:bg-stone-50 transition-colors">
                  Annuler
                </button>
                <button type="submit" disabled={savingConfig} className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-black text-sm rounded-xl transition-colors disabled:opacity-50">
                  {savingConfig ? 'Enregistrement…' : 'Confirmer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entry form modal */}
      {showEntryForm && (
        <BudgetEntryForm
          projectId={projectId}
          entry={editingEntry}
          onClose={() => { setShowEntryForm(false); setEditingEntry(null); }}
          onSaved={() => { setShowEntryForm(false); setEditingEntry(null); fetchAll(); }}
        />
      )}
    </div>
  );
}
