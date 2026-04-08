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

type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  location: string | null;
  creator_name: string;
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
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Event creation state
  const [showEventModal, setShowEventModal] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('09:00');
  const [eventSaving, setEventSaving] = useState(false);

  const canManageProject = project.my_role_id === 1 || project.my_role_id === 2 || project.owner_id === user?.id;

  useEffect(() => {
    fetchDashboard();
    fetchEvents();
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

  async function fetchEvents() {
    try {
      const data = await api.get(`/projects/${project.id}/events`);
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setEventSaving(true);
    try {
      await api.post(`/projects/${project.id}/events`, {
        title: eventTitle,
        start_datetime: `${eventDate}T${eventTime}`,
        end_datetime: `${eventDate}T${parseInt(eventTime) + 1}:00`,
        description: '',
        location: '',
        attendees: [user?.id]
      });
      setEventTitle('');
      setShowEventModal(false);
      fetchEvents();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setEventSaving(false);
    }
  }

  async function deleteEvent(id: number) {
    if (!confirm('Supprimer cet événement ?')) return;
    try {
      await api.delete(`/projects/${project.id}/events/${id}`);
      fetchEvents();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const stats = dashboard?.stats || EMPTY_STATS;
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

  function formatDateTime(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,_rgba(251,146,60,0.16),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.12),_transparent_26%),linear-gradient(180deg,_#fafaf9_0%,_#f5f5f4_100%)] p-6 sm:p-8 animate-fadeIn">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[30px] border border-stone-200/80 bg-white/90 shadow-xl">
          <div className="flex flex-col gap-6 px-6 py-6 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-500">Pilotage projet</p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">Tableau de bord</h2>
              <p className="mt-2 text-sm text-stone-600">
                Gérez vos jalons, surveillez la charge de l&apos;équipe et programmez vos événements.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button onClick={() => setShowEventModal(true)} className="rounded-2xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800 shadow-lg shadow-stone-200">
                Nouvel Événement
              </button>
              <button
                type="button"
                onClick={() => fetchDashboard(true)}
                className="rounded-2xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                {refreshing ? 'Actualisation...' : 'Actualiser'}
              </button>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Main Progress Card */}
          <article className="xl:col-span-2 rounded-[28px] border border-stone-200 bg-white/90 p-8 shadow-sm">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Progression</p>
                <div className="mt-4 flex items-end gap-3">
                  <span className="text-6xl font-black tracking-tight text-stone-900">{stats.completion_rate}%</span>
                  <span className="pb-2 text-sm text-stone-500">achevées</span>
                </div>
                <div className="mt-6 h-4 overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all duration-1000"
                    style={{ width: `${stats.completion_rate}%` }}
                  />
                </div>
                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <StatPill label="Total" value={stats.total} tone="stone" />
                  <StatPill label="A faire" value={stats.todo} tone="slate" />
                  <StatPill label="En cours" value={stats.in_progress} tone="amber" />
                  <StatPill label="Terminées" value={stats.done} tone="emerald" />
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 rounded-3xl bg-stone-50 p-6">
                <div className="relative h-40 w-40 rounded-full" style={donutStyle}>
                  <div className="absolute inset-[16px] flex items-center justify-center rounded-full bg-white text-center shadow-inner">
                    <div>
                      <div className="text-4xl font-black text-stone-900">{stats.total}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Taches</div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-1.5 text-stone-400"><span className="w-2 h-2 rounded-full bg-stone-300"></span>{stats.todo}</div>
                  <div className="flex items-center gap-1.5 text-amber-500"><span className="w-2 h-2 rounded-full bg-amber-500"></span>{stats.in_progress}</div>
                  <div className="flex items-center gap-1.5 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>{stats.done}</div>
                </div>
              </div>
            </div>
          </article>

          {/* Events Card */}
          <article className="rounded-[28px] border border-stone-200 bg-white/90 p-8 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Événements (Hors GANTT)</p>
              <button onClick={() => setShowEventModal(true)} className="text-orange-500 hover:text-orange-600 transition-colors">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 4v16m8-8H4"/></svg>
              </button>
            </div>
            
            <div className="space-y-3 overflow-y-auto max-h-[320px] pr-1 custom-scrollbar">
              {events.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-stone-50/50 border border-dashed border-stone-200">
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Aucun événement</p>
                  <p className="text-[11px] text-stone-400 mt-1">Réunions, points d&apos;étape, etc.</p>
                </div>
              ) : (
                events.map(ev => (
                  <div key={ev.id} className="group relative rounded-2xl border border-stone-100 bg-white p-4 shadow-sm hover:shadow-md transition-all hover:border-orange-200">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-stone-900 group-hover:text-orange-600 transition-colors">{ev.title}</h4>
                        <p className="text-[11px] text-stone-500 mt-1 font-medium">{formatDateTime(ev.start_datetime)}</p>
                      </div>
                      <button onClick={() => deleteEvent(ev.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-stone-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M19 7l-1 12H6L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3"/></svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {deadlineMeta && (
              <div className="mt-8 pt-8 border-t border-stone-100">
                <div className="rounded-2xl bg-stone-900 p-5 text-white shadow-lg shadow-stone-200">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Deadline Projet</p>
                  <p className="mt-2 text-2xl font-black">{deadlineMeta.label}</p>
                  <p className="text-xs text-white/50 mt-1">{deadlineMeta.formatted}</p>
                </div>
              </div>
            )}
          </article>
        </div>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1.8fr]">
          {/* Urgent Tasks */}
          <article className="rounded-[28px] border border-stone-200 bg-white/90 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Prochaines échéances</p>
              <button onClick={() => router.push(`/projects/${project.id}/tasks`)} className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-orange-500 transition-colors">Voir tout</button>
            </div>

            <div className="space-y-3">
              {urgentTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 rounded-2xl border border-stone-100 bg-white hover:bg-stone-50 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900 truncate">{task.title}</p>
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mt-1">{task.assignee_name || 'Non assignée'}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className={`text-xs font-bold ${task.is_overdue ? 'text-red-500' : 'text-stone-900'}`}>{formatDueDate(task.due_date)}</p>
                    <p className="text-[9px] font-black uppercase tracking-tighter text-stone-400">{task.is_overdue ? 'RETARD' : 'RESTANT'}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Team Load */}
          <article className="rounded-[28px] border border-stone-200 bg-white/90 p-8 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500 mb-8">Charge de l&apos;équipe</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {memberLoad.map((member) => (
                <div key={member.id} className="p-5 rounded-2xl border border-stone-100 bg-white">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black text-sm">{member.name.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate">{member.name}</p>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">{member.role_name}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-stone-400">
                      <span>Taches ouvertes</span>
                      <span className={member.open_count > 4 ? 'text-orange-500' : 'text-stone-900'}>{member.open_count}</span>
                    </div>
                    <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${member.open_count > 4 ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, member.open_count * 20)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>

      {/* New Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-fadeUp">
            <header className="px-8 py-6 border-b border-stone-100 flex items-center justify-between">
              <h3 className="font-bold text-xl text-stone-900">Nouvel Événement</h3>
              <button onClick={() => setShowEventModal(false)} className="text-stone-400 hover:text-stone-900"><svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
            </header>
            <form onSubmit={handleCreateEvent} className="p-8 space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Titre de la réunion / événement</label>
                <input type="text" value={eventTitle} onChange={e => setEventTitle(e.target.value)} required placeholder="ex: Point projet hebdomadaire" className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Date</label>
                  <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Heure</label>
                  <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} required className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20" />
                </div>
              </div>
              <div className="pt-4">
                <button type="submit" disabled={eventSaving} className="w-full rounded-2xl bg-orange-500 py-4 text-sm font-bold text-white transition hover:bg-orange-600 shadow-lg shadow-orange-100">
                  {eventSaving ? 'Création...' : 'Planifier l\'événement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e7e5e4; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #d6d3d1; }
      `}</style>
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: 'stone' | 'slate' | 'amber' | 'emerald' }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-700',
    slate: 'bg-slate-50 text-stone-500 border border-stone-100',
    amber: 'bg-orange-50 text-orange-600 border border-orange-100',
    emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
  };

  return (
    <div className={`rounded-2xl px-4 py-3 ${tones[tone]}`}>
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">{label}</div>
    </div>
  );
}
