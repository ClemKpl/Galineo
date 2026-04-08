'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useProject } from './ProjectContext';
import { useAuth } from '@/contexts/AuthContext';

type DashboardStats = {
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  overdue: number;
  completion_rate: number;
};

type UrgentTask = {
  id: number;
  parent_id: number | null;
  title: string;
  status: string;
  priority: string;
  due_date: string;
  assigned_to: number | null;
  assignee_name: string | null;
  is_overdue: boolean;
};

type MemberLoad = {
  id: number;
  name: string;
  email: string;
  role_name: string;
  last_login_at: string | null;
  assigned_count: number;
  open_count: number;
  overdue_count: number;
};

type DashboardPayload = {
  project: {
    id: number;
    title: string;
    deadline: string | null;
    status: string;
  };
  stats: DashboardStats;
  features: Array<{
    id: number;
    title: string;
  }>;
  urgent_tasks: UrgentTask[];
  member_load: MemberLoad[];
};

const EMPTY_STATS: DashboardStats = {
  total: 0,
  done: 0,
  in_progress: 0,
  todo: 0,
  overdue: 0,
  completion_rate: 0,
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'A faire',
  in_progress: 'En cours',
  done: 'Terminee',
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent_important: 'bg-red-100 text-red-700 border-red-200',
  urgent_not_important: 'bg-orange-100 text-orange-700 border-orange-200',
  not_urgent_important: 'bg-sky-100 text-sky-700 border-sky-200',
  normal: 'bg-stone-100 text-stone-600 border-stone-200',
};

export default function ProjectDashboardPage() {
  const project = useProject();
  const { user } = useAuth();
  const router = useRouter();

  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [savingQuickTask, setSavingQuickTask] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskDueDate, setQuickTaskDueDate] = useState('');
  const [quickTaskAssignedTo, setQuickTaskAssignedTo] = useState('');
  const [quickTaskFeatureId, setQuickTaskFeatureId] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState('normal');

  const members = Array.isArray(project.members) ? project.members : [];
  const canManageProject = project.my_role_id === 1 || project.my_role_id === 2 || project.owner_id === user?.id;

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  async function fetchDashboard(nextRefreshing = false) {
    if (nextRefreshing) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await api.get(`/projects/${project.id}/dashboard`);
      setDashboard(data);
    } catch (err) {
      console.error(err);
    } finally {
      if (nextRefreshing) setRefreshing(false);
      else setLoading(false);
    }
  }

  async function handleComplete() {
    if (!confirm('Voulez-vous marquer ce projet comme TERMINE ? Il sera deplace dans l\'historique.')) return;
    try {
      await api.patch(`/projects/${project.id}/complete`, {});
      window.dispatchEvent(new Event('project-updated'));
      router.push('/history');
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function handleQuickCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    if (!quickTaskFeatureId) {
      alert('Selectionne d’abord une fonctionnalite.');
      return;
    }

    setSavingQuickTask(true);
    try {
      await api.post(`/projects/${project.id}/tasks`, {
        title: quickTaskTitle.trim(),
        parent_id: Number(quickTaskFeatureId),
        due_date: quickTaskDueDate || null,
        assigned_to: quickTaskAssignedTo ? Number(quickTaskAssignedTo) : null,
        priority: quickTaskPriority,
        status: 'todo',
      });

      setQuickTaskTitle('');
      setQuickTaskDueDate('');
      setQuickTaskAssignedTo('');
      setQuickTaskFeatureId('');
      setQuickTaskPriority('normal');
      setShowQuickCreate(false);
      await fetchDashboard(true);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSavingQuickTask(false);
    }
  }

  const stats = dashboard?.stats || EMPTY_STATS;
  const features = dashboard?.features || [];
  const urgentTasks = dashboard?.urgent_tasks || [];
  const memberLoad = dashboard?.member_load || [];

  const donutStyle = useMemo(() => {
    const total = Math.max(stats.total, 1);
    const doneAngle = Math.round((stats.done / total) * 360);
    const inProgressAngle = Math.round((stats.in_progress / total) * 360);
    return {
      background: `conic-gradient(#16a34a 0deg ${doneAngle}deg, #f59e0b ${doneAngle}deg ${doneAngle + inProgressAngle}deg, #d6d3d1 ${doneAngle + inProgressAngle}deg 360deg)`,
    };
  }, [stats.done, stats.in_progress, stats.total]);

  const deadlineMeta = useMemo(() => {
    const deadline = dashboard?.project?.deadline || project.deadline;
    if (!deadline) return null;

    const now = new Date();
    const due = new Date(deadline);
    if (Number.isNaN(due.getTime())) return null;

    const diff = due.getTime() - now.getTime();
    const isLate = diff < 0;
    const days = Math.floor(Math.abs(diff) / (1000 * 60 * 60 * 24));
    const hours = Math.floor((Math.abs(diff) / (1000 * 60 * 60)) % 24);

    return {
      label: isLate ? `Retard de ${days}j ${hours}h` : `${days}j ${hours}h restants`,
      formatted: due.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
      progress: Math.max(8, Math.min(100, 100 - Math.max(0, days * 3))),
      isLate,
    };
  }, [dashboard?.project?.deadline, project.deadline]);

  function formatLastLogin(value?: string | null) {
    if (!value) return 'Jamais';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDueDate(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Date invalide';
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 h-64 rounded-[28px] bg-stone-200/70 animate-pulse" />
          <div className="h-64 rounded-[28px] bg-stone-200/70 animate-pulse" />
          <div className="h-72 rounded-[28px] bg-stone-200/70 animate-pulse xl:col-span-2" />
          <div className="h-72 rounded-[28px] bg-stone-200/70 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_26%),linear-gradient(180deg,_#fafaf9_0%,_#f5f5f4_100%)] p-6 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-stone-200/80 bg-white/90 shadow-[0_20px_60px_-35px_rgba(28,25,23,0.35)]">
          <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-500">Pilotage projet</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Vision claire de l&apos;avancement</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">
                Progression globale, taches a surveiller et repartition de la charge en un coup d&apos;oeil.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => fetchDashboard(true)}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
              >
                {refreshing ? 'Actualisation...' : 'Actualiser'}
              </button>
              <button
                type="button"
                onClick={() => setShowQuickCreate((current) => !current)}
                className="rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                {showQuickCreate ? 'Fermer' : 'Creer une tache'}
              </button>
              {canManageProject && project.status !== 'completed' && (
                <button
                  onClick={handleComplete}
                  className="rounded-2xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Terminer le projet
                </button>
              )}
            </div>
          </div>

          {showQuickCreate && (
            <div className="border-t border-stone-200/80 bg-stone-50/80 px-6 py-5 sm:px-8">
              {features.length === 0 ? (
                <div className="flex flex-col gap-3 rounded-[24px] border border-dashed border-stone-300 bg-white px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Aucune fonctionnalite disponible</p>
                    <p className="mt-1 text-sm text-stone-500">Cree d’abord une fonctionnalite dans l’onglet Taches avant d’ajouter une sous-tache ici.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/projects/${project.id}/tasks`)}
                    className="rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Ouvrir Taches
                  </button>
                </div>
              ) : (
                <form onSubmit={handleQuickCreateTask} className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1.8fr_1fr_1fr_1fr_auto]">
                  <select
                    value={quickTaskFeatureId}
                    onChange={(e) => setQuickTaskFeatureId(e.target.value)}
                    required
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400"
                  >
                    <option value="">Fonctionnalite</option>
                    {features.map((feature) => (
                      <option key={feature.id} value={feature.id}>
                        {feature.title}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={quickTaskTitle}
                    onChange={(e) => setQuickTaskTitle(e.target.value)}
                    placeholder="Nouvelle tache prioritaire..."
                    required
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400"
                  />
                  <input
                    type="date"
                    value={quickTaskDueDate}
                    onChange={(e) => setQuickTaskDueDate(e.target.value)}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400"
                  />
                  <select
                    value={quickTaskAssignedTo}
                    onChange={(e) => setQuickTaskAssignedTo(e.target.value)}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400"
                  >
                    <option value="">Non assignee</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={quickTaskPriority}
                    onChange={(e) => setQuickTaskPriority(e.target.value)}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-900 outline-none transition focus:border-orange-400"
                  >
                    <option value="normal">Normale</option>
                    <option value="urgent_important">Urg. & Imp.</option>
                    <option value="not_urgent_important">Importante</option>
                    <option value="urgent_not_important">Urgente</option>
                  </select>
                  <button
                    type="submit"
                    disabled={savingQuickTask}
                    className="rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {savingQuickTask ? 'Creation...' : 'Ajouter'}
                  </button>
                </form>
              )}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <article className="xl:col-span-2 rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-[0_18px_50px_-36px_rgba(28,25,23,0.42)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Progression globale</p>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-5xl font-black tracking-tight text-stone-900">{stats.completion_rate}%</span>
                  <span className="pb-1 text-sm text-stone-500">des taches terminees</span>
                </div>
                <div className="mt-5 h-4 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 via-amber-500 to-emerald-500 transition-all"
                    style={{ width: `${stats.completion_rate}%` }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatPill label="Total" value={stats.total} tone="stone" />
                  <StatPill label="A faire" value={stats.todo} tone="slate" />
                  <StatPill label="En cours" value={stats.in_progress} tone="amber" />
                  <StatPill label="Terminees" value={stats.done} tone="emerald" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 rounded-[24px] bg-stone-50 p-5">
                <div className="relative h-36 w-36 rounded-full" style={donutStyle}>
                  <div className="absolute inset-[14px] flex items-center justify-center rounded-full bg-white text-center">
                    <div>
                      <div className="text-3xl font-black text-stone-900">{stats.total}</div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Taches</div>
                    </div>
                  </div>
                </div>
                <div className="grid w-full grid-cols-3 gap-2 text-center text-xs font-semibold">
                  <Legend tone="stone" label="A faire" value={stats.todo} />
                  <Legend tone="amber" label="En cours" value={stats.in_progress} />
                  <Legend tone="emerald" label="Done" value={stats.done} />
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-[0_18px_50px_-36px_rgba(28,25,23,0.42)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Cadence & alertes</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-700">Taches en retard</div>
                <div className="mt-2 flex items-end gap-3">
                  <span className="text-4xl font-black tracking-tight text-red-700">{stats.overdue}</span>
                  <button
                    type="button"
                    onClick={() => router.push(`/projects/${project.id}/tasks`)}
                    className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-red-600 underline-offset-4 hover:underline"
                  >
                    Voir les taches
                  </button>
                </div>
              </div>

              {deadlineMeta ? (
                <div className="rounded-[24px] bg-stone-900 p-4 text-white">
                  <div className="text-sm font-semibold text-white/70">Deadline projet</div>
                  <div className="mt-2 text-2xl font-black">{deadlineMeta.label}</div>
                  <div className="mt-1 text-sm text-white/70">{deadlineMeta.formatted}</div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
                    <div
                      className={`h-full rounded-full ${deadlineMeta.isLate ? 'bg-red-400' : 'bg-orange-400'}`}
                      style={{ width: `${deadlineMeta.progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-dashed border-stone-300 p-4 text-sm text-stone-500">
                  Aucune deadline projet definie.
                </div>
              )}
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1.8fr]">
          <article className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-[0_18px_50px_-36px_rgba(28,25,23,0.42)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Prochaines echeances</p>
                <h3 className="mt-2 text-lg font-bold text-stone-900">Les 5 prochaines a surveiller</h3>
              </div>
              <button
                type="button"
                onClick={() => router.push(`/projects/${project.id}/tasks`)}
                className="rounded-xl border border-stone-200 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-stone-600 transition hover:bg-stone-50"
              >
                Toutes les taches
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {urgentTasks.length === 0 ? (
                <div className="rounded-[22px] bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                  Aucune echeance active. Le projet respire.
                </div>
              ) : (
                urgentTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => router.push(`/projects/${project.id}/tasks`)}
                    className="flex w-full items-start justify-between gap-4 rounded-[22px] border border-stone-200 px-4 py-4 text-left transition hover:border-orange-300 hover:bg-orange-50/40"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-stone-900">{task.title}</span>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal}`}>
                          {task.priority === 'urgent_important' ? 'Urg. & Imp.' : task.priority === 'urgent_not_important' ? 'Urgente' : task.priority === 'not_urgent_important' ? 'Importante' : 'Normale'}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                        <span>{STATUS_LABELS[task.status] || 'A faire'}</span>
                        <span>{task.assignee_name || 'Non assignee'}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className={`text-sm font-bold ${task.is_overdue ? 'text-red-600' : 'text-stone-700'}`}>{formatDueDate(task.due_date)}</div>
                      <div className={`mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${task.is_overdue ? 'text-red-500' : 'text-stone-400'}`}>
                        {task.is_overdue ? 'En retard' : 'A venir'}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-stone-200 bg-white/90 p-6 shadow-[0_18px_50px_-36px_rgba(28,25,23,0.42)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Charge par membre</p>
                <h3 className="mt-2 text-lg font-bold text-stone-900">Identifier les points de surcharge</h3>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {memberLoad.length === 0 ? (
                <div className="rounded-[22px] bg-stone-50 px-4 py-8 text-center text-sm text-stone-500">
                  Aucun membre disponible.
                </div>
              ) : (
                memberLoad.map((member) => {
                  const loadPercent = Math.min(100, member.open_count * 20);
                  const tone = member.overdue_count > 0 ? 'bg-red-500' : member.open_count >= 4 ? 'bg-amber-500' : 'bg-emerald-500';

                  return (
                    <div key={member.id} className="rounded-[24px] border border-stone-200 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-sm font-bold text-stone-700">
                              {member.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-stone-900">{member.name}</div>
                              <div className="truncate text-xs text-stone-500">{member.role_name} · {member.email}</div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-stone-500">
                            Derniere connexion : {formatLastLogin(member.last_login_at)}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold sm:min-w-[220px]">
                          <MiniMetric label="Assignees" value={member.assigned_count} />
                          <MiniMetric label="Ouvertes" value={member.open_count} />
                          <MiniMetric label="Retard" value={member.overdue_count} alert={member.overdue_count > 0} />
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                          <span>Charge actuelle</span>
                          <span>{loadPercent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                          <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(loadPercent, member.open_count > 0 ? 12 : 0)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: 'stone' | 'slate' | 'amber' | 'emerald' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    slate: 'bg-slate-100 text-slate-700',
    amber: 'bg-amber-100 text-amber-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className={`rounded-2xl px-4 py-3 ${tones[tone]}`}>
      <div className="text-xl font-black">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</div>
    </div>
  );
}

function Legend({ label, value, tone }: { label: string; value: number; tone: 'stone' | 'amber' | 'emerald' }) {
  const dots = {
    stone: 'bg-stone-300',
    amber: 'bg-amber-500',
    emerald: 'bg-emerald-500',
  };

  return (
    <div className="rounded-2xl bg-white px-2 py-2">
      <div className={`mx-auto mb-2 h-2.5 w-2.5 rounded-full ${dots[tone]}`} />
      <div className="text-[10px] uppercase tracking-[0.14em] text-stone-500">{label}</div>
      <div className="mt-1 text-sm font-bold text-stone-900">{value}</div>
    </div>
  );
}

function MiniMetric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`rounded-2xl px-3 py-3 ${alert ? 'bg-red-50 text-red-700' : 'bg-stone-50 text-stone-700'}`}>
      <div className="text-lg font-black">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.14em]">{label}</div>
    </div>
  );
}
