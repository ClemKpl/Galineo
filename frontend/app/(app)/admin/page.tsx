'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

type User = {
  id: number;
  name: string;
  email: string;
  plan: 'free' | 'premium' | 'unlimited';
  created_at: string;
  last_login_at: string | null;
  project_count: number;
};

type Project = {
  id: number;
  title: string;
  status: string;
  created_at: string;
  owner_name: string;
  owner_email: string;
  member_count: number;
  task_count: number;
};

type Stats = {
  users: number;
  premium_users: number;
  projects: number;
  tasks: number;
};

type Tab = 'users' | 'projects' | 'support';

type SupportTicket = {
  id: number;
  user_name: string;
  user_email: string;
  user_plan: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_reply: string | null;
  created_at: string;
};

const PLAN_LABELS: Record<string, string> = { free: 'Free', premium: 'Premium', unlimited: 'Admin' };
const PLAN_COLORS: Record<string, string> = {
  free: 'bg-stone-100 text-stone-500',
  premium: 'bg-orange-100 text-orange-600',
  unlimited: 'bg-purple-100 text-purple-600',
};

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('users');
  const [projectFilter, setProjectFilter] = useState<'active' | 'completed' | 'deleted'>('active');
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [search, setSearch] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, p, t] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/projects'),
        api.get('/support/admin'),
      ]);
      setStats(s);
      setUsers(u);
      setProjects(p);
      setTickets(t as SupportTicket[]);
    } catch {
      showToast('Accès refusé ou erreur serveur.', true);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (user && user.plan !== 'unlimited') {
      router.push('/dashboard');
      return;
    }
    loadData();
  }, [user, router, loadData]);

  const handleDeleteUser = async (u: User) => {
    if (!confirm(`Supprimer le compte de ${u.name} (${u.email}) ? Cette action est irréversible.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      showToast(`Compte de ${u.name} supprimé.`);
    } catch (e) {
      showToast((e as Error).message, true);
    }
  };

  const handleChangePlan = async (u: User, plan: 'free' | 'premium' | 'unlimited') => {
    try {
      await api.patch(`/admin/users/${u.id}/plan`, { plan });
      setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, plan } : x));
      showToast(`Plan de ${u.name} mis à jour → ${PLAN_LABELS[plan]}`);
    } catch (e) {
      showToast((e as Error).message, true);
    }
  };

  const handleDeleteProject = async (p: Project) => {
    const isAlreadyDeleted = p.status === 'deleted';
    const msg = isAlreadyDeleted 
      ? `Supprimer DÉFINITIVEMENT le projet "${p.title}" ? Cette action est irréversible et supprimera toutes les données associées (tâches, logs, etc.).`
      : `Souhaitez-vous désactiver le projet "${p.title}" ? Il ne sera plus accessible aux utilisateurs mais restera visible dans ce panel pour archivage.`;
    
    if (!confirm(msg)) return;
    
    try {
      if (isAlreadyDeleted) {
        await api.delete(`/admin/projects/${p.id}/hard`);
        setProjects((prev) => prev.filter((x) => x.id !== p.id));
        showToast(`Projet "${p.title}" supprimé définitivement de la base de données.`);
      } else {
        await api.delete(`/admin/projects/${p.id}`);
        setProjects((prev) => prev.map((x) => x.id === p.id ? { ...x, status: 'deleted' } : x));
        showToast(`Projet "${p.title}" a été désactivé.`);
      }
    } catch (e) {
      showToast((e as Error).message, true);
    }
  };

  const handleTicketReply = async (ticket: SupportTicket, status?: string) => {
    const reply = replyDrafts[ticket.id];
    if (!reply?.trim() && !status) return;
    try {
      await api.patch(`/support/admin/${ticket.id}`, {
        ...(reply?.trim() ? { admin_reply: reply.trim() } : {}),
        ...(status ? { status } : {}),
      });
      setTickets((prev) => prev.map((t) => t.id === ticket.id
        ? { ...t, admin_reply: reply?.trim() || t.admin_reply, status: status || t.status }
        : t
      ));
      setReplyDrafts((prev) => { const n = { ...prev }; delete n[ticket.id]; return n; });
      showToast('Ticket mis à jour');
    } catch (e) {
      showToast((e as Error).message, true);
    }
  };

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProjects = projects.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.owner_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = p.status === projectFilter;
    return matchesSearch && matchesStatus;
  });

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${toast.error ? 'bg-red-500 text-white' : 'bg-stone-900 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Panel Admin</h1>
          <p className="text-stone-400 text-sm mt-0.5">Gestion globale de la plateforme</p>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] font-bold bg-purple-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>
          </svg>
          Admin
        </span>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Utilisateurs', value: stats.users },
            { label: 'Premium', value: stats.premium_users },
            { label: 'Projets actifs', value: stats.projects },
            { label: 'Tâches', value: stats.tasks },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-stone-100 rounded-2xl px-5 py-4">
              <div className="text-2xl font-bold text-stone-900">{s.value}</div>
              <div className="text-xs text-stone-400 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-3">
          <div className="flex gap-1 bg-stone-100 p-1 rounded-xl flex-wrap">
            {(['users', 'projects', 'support'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(''); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${tab === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
              >
                {t === 'users' ? `Utilisateurs (${users.length})` : t === 'projects' ? `Projets (${projects.length})` : (
                  <span className="flex items-center gap-1.5">
                    Support
                    {tickets.filter(tk => tk.status === 'open').length > 0 && (
                      <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{tickets.filter(tk => tk.status === 'open').length}</span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab === 'projects' && (
            <div className="flex gap-4 ml-1">
              <button onClick={() => setProjectFilter('active')} className={`text-xs font-semibold pb-1 border-b-2 transition-all ${projectFilter === 'active' ? 'border-blue-600 text-blue-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>Actifs ({projects.filter(p => p.status === 'active').length})</button>
              <button onClick={() => setProjectFilter('completed')} className={`text-xs font-semibold pb-1 border-b-2 transition-all ${projectFilter === 'completed' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>Archivés ({projects.filter(p => p.status === 'completed').length})</button>
              <button onClick={() => setProjectFilter('deleted')} className={`text-xs font-semibold pb-1 border-b-2 transition-all ${projectFilter === 'deleted' ? 'border-red-600 text-red-600' : 'border-transparent text-stone-400 hover:text-stone-600'}`}>Corbeille ({projects.filter(p => p.status === 'deleted').length})</button>
            </div>
          )}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={tab === 'users' ? 'Rechercher un utilisateur…' : 'Rechercher un projet…'}
          className="px-4 py-2 rounded-xl border border-stone-200 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all w-64"
        />
      </div>

      {/* Users table */}
      {tab === 'users' && (
        <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider">Utilisateur</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider">Plan</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">Projets</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider hidden md:table-cell">Dernière connexion</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider hidden md:table-cell">Inscrit le</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-stone-900">{u.name}</div>
                    <div className="text-xs text-stone-400">{u.email}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={u.plan}
                      onChange={(e) => handleChangePlan(u, e.target.value as 'free' | 'premium' | 'unlimited')}
                      className={`text-xs font-semibold px-2 py-1 rounded-lg border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400/30 ${PLAN_COLORS[u.plan]}`}
                    >
                      <option value="free">Free</option>
                      <option value="premium">Premium</option>
                      <option value="unlimited">Admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-stone-500">{u.project_count}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-stone-400 text-xs">{fmt(u.last_login_at)}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-stone-400 text-xs">{fmt(u.created_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    {u.email !== user?.email && (
                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors px-2 py-1 rounded-lg hover:bg-red-50 flex items-center justify-center"
                      >
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="sm:hidden"><path d="M19 7l-1 12H6L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3"/></svg>
                        <span className="hidden sm:inline">Supprimer</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-stone-400 text-sm">Aucun résultat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Projects table */}
      {tab === 'projects' && (
        <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider">Projet</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">Propriétaire</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">Membres</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider hidden md:table-cell">Tâches</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-stone-400 uppercase tracking-wider hidden md:table-cell">Créé le</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filteredProjects.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-stone-900">{p.title}</div>
                    <div className={`text-[10px] font-bold uppercase tracking-widest mt-1 inline-block px-2 py-0.5 rounded-md ${
                      p.status === 'active' ? 'bg-blue-50 text-blue-600' : 
                      p.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                      'bg-red-50 text-red-600'
                    }`}>
                      {p.status === 'active' ? 'Actif' : p.status === 'completed' ? 'Archivé' : 'Dans la corbeille'}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <div className="text-stone-700 font-medium">{p.owner_name}</div>
                    <div className="text-xs text-stone-400">{p.owner_email}</div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-stone-500">{p.member_count}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-stone-500">{p.task_count}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-stone-400 text-xs">{fmt(p.created_at)}</td>
                  <td className="px-5 py-3.5 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => window.open(`/projects/${p.id}`, '_blank')}
                      className="text-xs text-purple-600 hover:text-purple-700 font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-purple-50 flex items-center justify-center"
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="sm:hidden"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      <span className="hidden sm:inline">Consulter</span>
                    </button>
                    <button
                      onClick={() => handleDeleteProject(p)}
                      title={p.status === 'deleted' ? "Supprimer définitivement" : "Placer dans la corbeille"}
                      className={`text-xs font-medium transition-colors px-2 py-1 rounded-lg flex items-center justify-center ${
                        p.status === 'deleted' ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-stone-400 hover:text-red-500 hover:bg-red-50'
                      }`}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" className="sm:hidden">
                        {p.status === 'deleted' ? (
                          <path d="M19 7l-1 12H6L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3" />
                        ) : (
                           <path d="M19 7l-1 12H6L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3" />
                        )}
                      </svg>
                      <span className="hidden sm:inline">{p.status === 'deleted' ? 'Supprimer définitivement' : 'Supprimer'}</span>
                    </button>
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-stone-400 text-sm">Aucun résultat</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {/* Support tickets */}
      {tab === 'support' && (
        <div className="space-y-4">
          {tickets.length === 0 && (
            <div className="bg-white border border-stone-100 rounded-2xl px-5 py-10 text-center text-stone-400 text-sm">Aucun ticket de support</div>
          )}
          {tickets.map((t) => (
            <div key={t.id} className={`bg-white border rounded-2xl overflow-hidden ${t.priority === 'high' ? 'border-orange-200' : 'border-stone-100'}`}>
              <div className="px-5 py-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-stone-900 text-sm">{t.subject}</span>
                    {t.priority === 'high' && <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase">⭐ Prioritaire</span>}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      t.status === 'closed' ? 'bg-stone-100 text-stone-500' :
                      t.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>{t.status === 'closed' ? 'Fermé' : t.status === 'in_progress' ? 'En cours' : 'Ouvert'}</span>
                  </div>
                  <p className="text-xs text-stone-400">{t.user_name} · {t.user_email} · <span className={`font-medium ${t.user_plan === 'premium' ? 'text-orange-500' : 'text-stone-400'}`}>{t.user_plan}</span> · {fmt(t.created_at)}</p>
                  <p className="text-sm text-stone-600 mt-2 whitespace-pre-wrap">{t.message}</p>
                  {t.admin_reply && (
                    <div className="mt-3 bg-orange-50 border border-orange-100 rounded-xl p-3">
                      <p className="text-xs font-bold text-orange-600 mb-1">Réponse envoyée</p>
                      <p className="text-sm text-stone-600 whitespace-pre-wrap">{t.admin_reply}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  {t.status !== 'in_progress' && t.status !== 'closed' && (
                    <button onClick={() => handleTicketReply(t, 'in_progress')} className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 font-medium hover:bg-blue-100 transition-colors">En cours</button>
                  )}
                  {t.status !== 'closed' && (
                    <button onClick={() => handleTicketReply(t, 'closed')} className="text-xs px-3 py-1.5 rounded-lg bg-stone-100 text-stone-500 font-medium hover:bg-stone-200 transition-colors">Fermer</button>
                  )}
                </div>
              </div>
              {t.status !== 'closed' && (
                <div className="border-t border-stone-100 px-5 py-4 flex gap-3 flex-wrap">
                  <textarea
                    rows={2}
                    value={replyDrafts[t.id] || ''}
                    onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [t.id]: e.target.value }))}
                    placeholder="Répondre à l'utilisateur..."
                    className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 text-sm placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-400 transition-all resize-none"
                  />
                  <button
                    onClick={() => handleTicketReply(t)}
                    disabled={!replyDrafts[t.id]?.trim()}
                    className="self-end px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl text-sm disabled:opacity-40 transition-colors"
                  >
                    Envoyer
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
