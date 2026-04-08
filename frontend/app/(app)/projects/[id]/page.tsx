'use client';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { useProject } from './ProjectContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface Task {
  id: number;
  title: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'normal' | 'high';
  due_date: string | null;
  assigned_to: number | null;
  assignee_name: string | null;
  created_at: string;
  phase: string | null;
}

export default function ProjectDashboardPage() {
  const project = useProject();
  const { user } = useAuth();
  const router = useRouter();
  const members = Array.isArray(project.members) ? project.members : [];

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickAssignee, setQuickAssignee] = useState('');
  const [quickDue, setQuickDue] = useState('');
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await api.get(`/projects/${project.id}/tasks`);
      setTasks(Array.isArray(data) ? data : []);
    } catch { setTasks([]); }
    finally { setTasksLoading(false); }
  }, [project.id]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleComplete = async () => {
    if (!confirm('Voulez-vous marquer ce projet comme TERMINÉ ? Il sera déplacé dans l\'historique.')) return;
    try {
      await api.patch(`/projects/${project.id}/complete`, {});
      window.dispatchEvent(new Event('project-updated'));
      router.push('/history');
    } catch (err) { alert((err as Error).message); }
  };

  const handleQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setQuickSubmitting(true);
    try {
      await api.post(`/projects/${project.id}/tasks`, {
        title: quickTitle.trim(),
        assigned_to: quickAssignee ? Number(quickAssignee) : null,
        due_date: quickDue || null,
      });
      setQuickTitle(''); setQuickAssignee(''); setQuickDue('');
      setShowQuickTask(false);
      fetchTasks();
    } catch (err) { alert((err as Error).message); }
    finally { setQuickSubmitting(false); }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const todo = tasks.filter(t => t.status === 'todo').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const done = tasks.filter(t => t.status === 'done').length;
    const total = tasks.length;
    const progress = total === 0 ? 0 : Math.round((done / total) * 100);
    const now = new Date();
    const overdue = tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'done').length;
    return { todo, inProgress, done, total, progress, overdue };
  }, [tasks]);

  // ── Deadline countdown ─────────────────────────────────────────────────────
  const deadlineInfo = useMemo(() => {
    if (!project.deadline) return null;
    const now = new Date();
    const dl = new Date(project.deadline);
    const diffMs = dl.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { date: dl, diffDays, isPast: diffDays < 0 };
  }, [project.deadline]);

  // ── Upcoming tasks (next 7 with due_date, not done) ────────────────────────
  const upcomingTasks = useMemo(() => {
    const now = new Date();
    return tasks
      .filter(t => t.due_date && t.status !== 'done')
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 6);
  }, [tasks]);

  // ── Member workload ────────────────────────────────────────────────────────
  const memberWorkload = useMemo(() => {
    return members.map(m => {
      const assigned = tasks.filter(t => t.assigned_to === m.id);
      const done = assigned.filter(t => t.status === 'done').length;
      return { ...m, total: assigned.length, done, inProgress: assigned.filter(t => t.status === 'in_progress').length };
    }).sort((a, b) => b.total - a.total);
  }, [members, tasks]);

  // ── Recent activity (last tasks created/modified) ─────────────────────────
  const recentActivity = useMemo(() => {
    return [...tasks]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [tasks]);

  const canComplete = project.my_role_id === 1 || project.my_role_id === 2 || project.owner_id === user?.id;

  const sortedMembers = useMemo(() => [...members].sort((a, b) => a.role_id - b.role_id), [members]);

  const formatLastLogin = (v?: string | null) => {
    if (!v) return 'Jamais';
    const d = new Date(v);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  const priorityColor = (p: string) => p === 'high' ? 'text-red-500' : p === 'low' ? 'text-stone-400' : 'text-orange-400';
  const statusLabel = (s: string) => s === 'done' ? 'Terminé' : s === 'in_progress' ? 'En cours' : 'À faire';
  const statusColor = (s: string) => s === 'done' ? 'bg-emerald-100 text-emerald-700' : s === 'in_progress' ? 'bg-orange-100 text-orange-700' : 'bg-stone-100 text-stone-600';

  const timeAgo = (d: string) => {
    const diffMin = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    if (diffMin < 1) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `Il y a ${diffH}h`;
    return `Il y a ${Math.floor(diffH / 24)}j`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-stone-900">Vue d&apos;ensemble</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowQuickTask(true)}
            className="flex items-center gap-2 px-4 py-2 bg-stone-900 hover:bg-stone-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-all"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Ajouter une tâche
          </button>
          {canComplete && project.status !== 'completed' && (
            <button onClick={handleComplete} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
              Terminer le projet
            </button>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total tâches', value: stats.total, color: 'text-stone-900', bg: 'bg-stone-50', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg> },
          { label: 'En cours', value: stats.inProgress, color: 'text-orange-600', bg: 'bg-orange-50', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
          { label: 'Terminées', value: stats.done, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
          { label: 'En retard', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-600' : 'text-stone-400', bg: stats.overdue > 0 ? 'bg-red-50' : 'bg-stone-50', icon: <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> },
        ].map(({ label, value, color, bg, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center mb-3`}>{icon}</div>
            <p className={`text-3xl font-bold ${color}`}>{tasksLoading ? '–' : value}</p>
            <p className="text-xs text-stone-400 font-medium mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Progress + Deadline ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Progress bar */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-stone-900">Progression globale</h3>
            <span className="text-2xl font-bold text-stone-900">{stats.progress}%</span>
          </div>
          <div className="h-4 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-700"
              style={{ width: `${stats.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-stone-400">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-stone-200 inline-block"/> {stats.todo} à faire</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"/> {stats.inProgress} en cours</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"/> {stats.done} terminées</span>
          </div>
        </div>

        {/* Deadline countdown */}
        <div className={`bg-white rounded-2xl border p-6 flex flex-col justify-center ${deadlineInfo?.isPast ? 'border-red-200' : deadlineInfo && deadlineInfo.diffDays <= 7 ? 'border-orange-200' : 'border-stone-200'}`}>
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400 mb-2">Deadline projet</p>
          {!deadlineInfo ? (
            <p className="text-stone-400 text-sm font-medium">Aucune deadline définie</p>
          ) : (
            <>
              <p className={`text-3xl font-bold ${deadlineInfo.isPast ? 'text-red-600' : deadlineInfo.diffDays <= 7 ? 'text-orange-500' : 'text-stone-900'}`}>
                {deadlineInfo.isPast ? `${Math.abs(deadlineInfo.diffDays)}j` : `${deadlineInfo.diffDays}j`}
              </p>
              <p className="text-sm text-stone-400 mt-1">
                {deadlineInfo.isPast ? 'de retard' : 'restants'}
              </p>
              <p className="text-xs text-stone-300 mt-2">
                {deadlineInfo.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </>
          )}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Upcoming + Activity */}
        <div className="lg:col-span-2 space-y-6">

          {/* Prochaines échéances */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-stone-900 flex items-center gap-2">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Prochaines échéances
              </h3>
              <button onClick={() => router.push(`/projects/${project.id}/tasks`)} className="text-xs text-orange-500 hover:text-orange-600 font-semibold transition-colors">Voir toutes →</button>
            </div>
            {tasksLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-stone-50 rounded-xl animate-pulse"/>)}</div>
            ) : upcomingTasks.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-sm">Aucune tâche avec échéance à venir.</div>
            ) : (
              <div className="space-y-2">
                {upcomingTasks.map(t => {
                  const due = new Date(t.due_date!);
                  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
                  const isOverdue = daysLeft < 0;
                  const isUrgent = daysLeft >= 0 && daysLeft <= 2;
                  return (
                    <div key={t.id} onClick={() => router.push(`/projects/${project.id}/tasks`)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer group">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? 'bg-red-500' : isUrgent ? 'bg-orange-400' : 'bg-emerald-400'}`}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-800 truncate">{t.title}</p>
                        {t.assignee_name && <p className="text-xs text-stone-400">{t.assignee_name}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${isOverdue ? 'bg-red-50 text-red-600' : isUrgent ? 'bg-orange-50 text-orange-600' : 'bg-stone-50 text-stone-500'}`}>
                          {isOverdue ? `${Math.abs(daysLeft)}j retard` : daysLeft === 0 ? "Aujourd'hui" : `Dans ${daysLeft}j`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activité récente */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              Activité récente
            </h3>
            {tasksLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-stone-50 rounded-xl animate-pulse"/>)}</div>
            ) : recentActivity.length === 0 ? (
              <div className="py-8 text-center text-stone-400 text-sm">Aucune activité pour le moment.</div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map(t => (
                  <div key={t.id} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${statusColor(t.status)}`}>
                      {t.status === 'done' ? (
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                      ) : t.status === 'in_progress' ? (
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12"/></svg>
                      ) : (
                        <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-800 font-medium truncate">{t.title}</p>
                      <p className="text-xs text-stone-400">{statusLabel(t.status)}{t.assignee_name ? ` · ${t.assignee_name}` : ''}</p>
                    </div>
                    <span className="text-xs text-stone-300 shrink-0">{timeAgo(t.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Members + Workload */}
        <div className="space-y-6">

          {/* Charge par membre */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Charge de travail
            </h3>
            {tasksLoading ? (
              <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-14 bg-stone-50 rounded-xl animate-pulse"/>)}</div>
            ) : memberWorkload.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">Aucun membre.</p>
            ) : (
              <div className="space-y-3">
                {memberWorkload.map(m => (
                  <div key={m.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                          {m.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2)}
                        </div>
                        <span className="text-xs font-semibold text-stone-700 truncate max-w-[80px]">{m.name}</span>
                      </div>
                      <span className="text-xs text-stone-400">{m.done}/{m.total}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-500 rounded-full transition-all duration-500"
                        style={{ width: m.total === 0 ? '0%' : `${Math.round((m.done / m.total) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Membres du projet */}
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              Membres
            </h3>
            {sortedMembers.length === 0 ? (
              <p className="text-sm text-stone-400 text-center py-4">Aucun membre.</p>
            ) : (
              <div className="space-y-2">
                {sortedMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-stone-50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {m.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">{m.name}</p>
                      <p className="text-xs text-stone-400 truncate">Connecté {formatLastLogin(m.last_login_at)}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                      {m.role_name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick Task Modal ── */}
      {showQuickTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-stone-900">Ajouter une tâche rapide</h3>
              <button onClick={() => setShowQuickTask(false)} className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleQuickTask} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">Titre *</label>
                <input
                  type="text" autoFocus required
                  value={quickTitle} onChange={e => setQuickTitle(e.target.value)}
                  placeholder="Ex: Réviser la maquette..."
                  className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">Assigner à</label>
                  <select value={quickAssignee} onChange={e => setQuickAssignee(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white">
                    <option value="">Non assigné</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider block mb-1.5">Échéance</label>
                  <input type="date" value={quickDue} onChange={e => setQuickDue(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowQuickTask(false)} className="flex-1 py-3 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors">Annuler</button>
                <button type="submit" disabled={quickSubmitting} className="flex-1 py-3 rounded-xl bg-stone-900 hover:bg-stone-700 text-white text-sm font-bold transition-all disabled:opacity-60">
                  {quickSubmitting ? 'Création...' : 'Créer la tâche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
