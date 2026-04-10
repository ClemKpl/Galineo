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

type Tab = 'users' | 'projects';

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
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; error?: boolean } | null>(null);
  const [search, setSearch] = useState('');

  const showToast = (message: string, error = false) => {
    setToast({ message, error });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, p] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/users'),
        api.get('/admin/projects'),
      ]);
      setStats(s);
      setUsers(u);
      setProjects(p);
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
    if (!confirm(`Supprimer le projet "${p.title}" ? Il sera placé dans la corbeille.`)) return;
    try {
      await api.delete(`/admin/projects/${p.id}`);
      setProjects((prev) => prev.filter((x) => x.id !== p.id));
      showToast(`Projet "${p.title}" supprimé.`);
    } catch (e) {
      showToast((e as Error).message, true);
    }
  };

  const filteredUsers = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );
  const filteredProjects = projects.filter(
    (p) => p.title.toLowerCase().includes(search.toLowerCase()) || p.owner_name?.toLowerCase().includes(search.toLowerCase())
  );

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
        <span className="text-[11px] font-bold bg-purple-600 text-white px-3 py-1 rounded-full uppercase tracking-widest">Admin</span>
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-stone-100 p-1 rounded-xl">
          {(['users', 'projects'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSearch(''); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
            >
              {t === 'users' ? `Utilisateurs (${users.length})` : `Projets (${projects.length})`}
            </button>
          ))}
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
                        className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        Supprimer
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
                    <div className={`text-xs mt-0.5 ${p.status === 'active' ? 'text-green-500' : 'text-stone-400'}`}>{p.status}</div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    <div className="text-stone-700 font-medium">{p.owner_name}</div>
                    <div className="text-xs text-stone-400">{p.owner_email}</div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell text-stone-500">{p.member_count}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-stone-500">{p.task_count}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell text-stone-400 text-xs">{fmt(p.created_at)}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDeleteProject(p)}
                      className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      Supprimer
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
    </div>
  );
}
