'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useProject } from './ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import ProjectActivityLog from '@/components/ProjectActivityLog';

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
  avatar: string | null;
  assigned_count: number;
  done_count: number;
  todo_count: number;
  urgent_count: number;
  overdue_count: number;
};

type CalendarEvent = {
  id: number;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  location: string | null;
  link: string | null;
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
  pending_features: Array<{
    id: number;
    title: string;
    priority: string;
  }>;
  urgent_tasks: UrgentTask[];
  my_tasks: UrgentTask[];
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
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventLink, setEventLink] = useState('');
  const [eventRecurrence, setEventRecurrence] = useState('none');
  const [eventRecurrenceEnd, setEventRecurrenceEnd] = useState('');
  const [eventSaving, setEventSaving] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);

  const canManageProject = project.my_role_id === 1 || project.my_role_id === 2 || project.owner_id === user?.id;
  const isReadOnly = project.status !== 'active';

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
      const payload = {
        title: eventTitle,
        start_datetime: eventStart,
        end_datetime: eventEnd,
        description: eventDescription.trim() || null,
        link: eventLink.trim() || null,
        recurrence: eventRecurrence,
        recurrence_end: eventRecurrenceEnd || null,
      };

      if (editingEventId) {
        await api.patch(`/projects/${project.id}/events/${editingEventId}`, payload);
      } else {
        await api.post(`/projects/${project.id}/events`, payload);
      }

      setEventTitle('');
      setEventDescription('');
      setEventStart('');
      setEventEnd('');
      setEventLink('');
      setEventRecurrence('none');
      setEventRecurrenceEnd('');
      setEditingEventId(null);
      setShowEventModal(false);
      fetchEvents();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setEventSaving(false);
    }
  }

  function startEditEvent(ev: any) {
    setEditingEventId(ev.id);
    setEventTitle(ev.title);
    setEventDescription(ev.description || '');
    setEventStart(ev.start_datetime ? ev.start_datetime.replace(' ', 'T').slice(0, 16) : '');
    setEventEnd(ev.end_datetime ? ev.end_datetime.replace(' ', 'T').slice(0, 16) : '');
    setEventLink(ev.link || '');
    setEventRecurrence(ev.recurrence || 'none');
    setEventRecurrenceEnd(ev.recurrence_end || '');
    setShowEventModal(true);
  }

  async function deleteEvent(id: number) {
    if (isReadOnly) return;
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
  const myTasks = dashboard?.my_tasks || [];
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
    <div className="min-h-full bg-[radial-gradient(circle_at_top_left,var(--accent-rgba-low),transparent_32%),radial-gradient(circle_at_top_right,var(--accent-rgba-vlow),transparent_26%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)] p-6 sm:p-8 animate-fadeIn">
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
              {!isReadOnly && (
                <button onClick={() => { const d = new Date(); const pad = (n: number) => String(n).padStart(2,'0'); const base = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T09:00`; setEventStart(base); setEventEnd(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T10:00`); setShowEventModal(true); }} className="rounded-2xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-stone-800 shadow-lg shadow-stone-200">
                  Nouvel Événement
                </button>
              )}
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
          <article className="xl:col-span-2 rounded-[28px] border border-stone-200 bg-white/90 p-6 sm:p-8 shadow-sm">
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
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500">Événements</p>
              {!isReadOnly && (
                <button onClick={() => { const d = new Date(); const pad = (n: number) => String(n).padStart(2,'0'); const base = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T09:00`; setEventStart(base); setEventEnd(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T10:00`); setShowEventModal(true); }} className="text-orange-500 hover:text-orange-600 transition-colors">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 4v16m8-8H4"/></svg>
                </button>
              )}
            </div>
            
            <div className="space-y-3 overflow-y-auto max-h-[320px] pr-1 custom-scrollbar">
              {events.length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-stone-50/50 border border-dashed border-stone-200">
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Aucun événement</p>
                  <p className="text-[11px] text-stone-400 mt-1">Réunions, points d&apos;étape, etc.</p>
                </div>
              ) : (
                events.map(ev => (
                  <div key={ev.id} className="group relative rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm hover:shadow-md transition-all hover:bg-violet-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-stone-900 break-words">{ev.title}</h4>
                        <p className="text-[11px] text-stone-500 mt-0.5 font-medium">
                          {ev.start_datetime ? new Date(ev.start_datetime.replace(' ', 'T')).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                          {' → '}
                          {ev.end_datetime ? new Date(ev.end_datetime.replace(' ', 'T')).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </p>
                        {ev.description && (
                          <p className="text-xs text-stone-500 mt-1 break-words whitespace-pre-wrap">{ev.description}</p>
                        )}
                        {ev.link && (
                          <a href={ev.link} target="_blank" rel="noopener noreferrer"
                            className="mt-1 flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-semibold truncate max-w-[200px]"
                          >
                            <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                            {ev.link.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEditEvent(ev)} className="p-1.5 text-stone-300 hover:text-violet-500 transition-all rounded-lg hover:bg-violet-50">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button onClick={() => deleteEvent(ev.id)} className="p-1.5 text-stone-300 hover:text-red-500 transition-all rounded-lg hover:bg-red-50">
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M19 7l-1 12H6L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3"/></svg>
                        </button>
                      </div>
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

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
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

          {/* My Tasks (Restored) */}
          <article className="rounded-[28px] border border-stone-200 bg-white/90 p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-orange-500">Mes Tâches</p>
              <button onClick={() => router.push(`/projects/${project.id}/tasks`)} className="text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-orange-500 transition-colors">Gérer</button>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[400px] pr-1 custom-scrollbar">
              {(dashboard?.my_tasks || []).length === 0 ? (
                <div className="py-12 text-center rounded-2xl bg-stone-50/50 border border-dashed border-stone-200">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Aucune tâche assignée</p>
                  <p className="text-[11px] text-stone-400 mt-1">Vous êtes libre pour l'instant !</p>
                </div>
              ) : (
                (dashboard?.my_tasks || []).map((task) => (
                  <div key={task.id} className="flex items-center justify-between p-4 rounded-2xl border border-stone-100 bg-white hover:border-orange-200 hover:shadow-sm transition-all group">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate group-hover:text-orange-600 transition-colors">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.normal}`}>
                          {task.priority === 'urgent_important' ? 'Urgent & Imp.' : task.priority === 'urgent_not_important' ? 'Urgent' : task.priority === 'not_urgent_important' ? 'Important' : 'Normal'}
                        </span>
                        {task.due_date && (
                          <span className={`text-[10px] font-bold ${task.is_overdue ? 'text-red-500' : 'text-stone-400'}`}>
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => router.push(`/projects/${project.id}/tasks`)} className="p-2 text-stone-400 hover:text-orange-500 transition-all">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7"/></svg>
                    </button>
                  </div>
                ))
              )}
            </div>
          </article>

          {/* Team Load */}
          <article className="rounded-[28px] border border-stone-200 bg-white/90 p-8 shadow-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-stone-500 mb-8">Équipe</p>
            <div className="space-y-4 overflow-y-auto max-h-[400px] pr-1 custom-scrollbar">
              {memberLoad.map((member) => {
                const total = Math.max(1, member.done_count + member.todo_count);
                const progress = Math.round((member.done_count / total) * 100);

                return (
                  <div key={member.id} className="p-6 rounded-[2rem] border border-stone-100 bg-white hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center font-black text-sm overflow-hidden border border-stone-100 shadow-sm shrink-0">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-stone-400">{member.name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-stone-900 truncate group-hover:text-orange-500 transition-colors">{member.name}</p>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-[0.1em]">{member.role_name}</p>
                        <p className="text-[8px] sm:text-[9px] text-stone-400 font-medium mt-0.5 leading-tight">Dernière co : {formatLastLogin(member.last_login_at)}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="text-center">
                        <p className="text-lg font-black text-stone-900">{member.done_count}</p>
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">Réalisés</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-stone-900">{member.todo_count}</p>
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">À faire</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-lg font-black ${member.urgent_count > 0 ? 'text-red-500' : 'text-stone-900'}`}>{member.urgent_count}</p>
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-tighter">Urgentes</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest text-stone-500">
                          <span>Complétion</span>
                          <span className="text-xs text-stone-900">{progress}%</span>
                       </div>
                       <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{ width: `${progress}%` }} />
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>

        {/* Activity Log Section (Managers Only) */}
        {canManageProject && (
          <section className="animate-fadeUp" style={{ animationDelay: '0.2s' }}>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              <div className="xl:col-span-2">
                 <div className="rounded-[28px] border border-stone-200 bg-white/90 p-8 shadow-sm h-full">
                    <ProjectActivityLog projectId={project.id} />
                 </div>
              </div>
              <div className="hidden xl:block">
                 <div className="rounded-[28px] bg-stone-900 p-8 text-white h-full flex flex-col justify-center">
                    <h3 className="text-xl font-black mb-4">Audit et Sécurité</h3>
                    <p className="text-stone-400 text-sm leading-relaxed">
                      Ce journal d&apos;activités est réservé aux administrateurs du projet. Il suit chaque modification critique pour garantir la transparence et l&apos;intégrité des données.
                    </p>
                    <div className="mt-8 flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-widest">
                       <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                       Mode Audit Actif
                    </div>
                 </div>
              </div>
            </div>
          </section>
        )}

        {/* Management Alerts (Secondary Section) */}
        {canManageProject && (dashboard?.pending_features || []).length > 0 && (
          <section className="mt-8 bg-orange-50/50 border border-orange-100 rounded-[32px] p-8 -mx-2">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900 uppercase tracking-tight">Alerte de Pilotage</h3>
                <p className="text-xs text-stone-500 mt-0.5 font-medium">Les fonctionnalités suivantes sont encore vides et bloquent la vision globale du planning :</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboard?.pending_features?.map((feature) => (
                <div 
                  key={feature.id} 
                  onClick={() => router.push(`/projects/${project.id}/tasks`)}
                  className="bg-white border border-stone-100 p-4 rounded-2xl hover:border-orange-300 hover:shadow-sm transition-all group cursor-pointer flex items-center justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900 truncate group-hover:text-orange-600 transition-colors">{feature.title}</p>
                    <p className="text-[10px] text-stone-400 font-bold uppercase mt-1">En attente de tâches</p>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-stone-50 group-hover:bg-orange-50 flex items-center justify-center text-stone-400 group-hover:text-orange-500 transition-all">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isReadOnly ? "1.5" : "3"}><path d="M12 5v14M5 12h14"/></svg>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* New Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-fadeUp">
            <header className="px-6 py-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-500 mb-1 block">Agenda</span>
                <h3 className="font-bold text-xl text-stone-900">{editingEventId ? 'Modifier l\'événement' : 'Nouvel événement'}</h3>
              </div>
              <button onClick={() => { setShowEventModal(false); setEditingEventId(null); }} className="text-stone-400 hover:text-stone-900 p-2 hover:bg-stone-100 rounded-full transition-colors">
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </header>
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              <input
                type="text"
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                required
                placeholder="Titre de l'événement"
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-400/30"
              />
              <textarea
                value={eventDescription}
                onChange={e => setEventDescription(e.target.value)}
                placeholder="Description (optionnel)"
                rows={2}
                className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-400/30 resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Début</label>
                  <input type="datetime-local" value={eventStart} onChange={e => setEventStart(e.target.value)} required
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Fin</label>
                  <input type="datetime-local" value={eventEnd} onChange={e => setEventEnd(e.target.value)} required
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
                </div>
              </div>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-300" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                <input type="url" value={eventLink} onChange={e => setEventLink(e.target.value)}
                  placeholder="Lien (optionnel)"
                  className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Récurrence</label>
                <select value={eventRecurrence} onChange={e => setEventRecurrence(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-400/30 appearance-none">
                  <option value="none">Aucune</option>
                  <option value="daily">Quotidienne</option>
                  <option value="weekly">Hebdomadaire</option>
                  <option value="monthly">Mensuelle</option>
                </select>
              </div>
              {eventRecurrence !== 'none' && (
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2">Répéter jusqu'au</label>
                  <input type="date" value={eventRecurrenceEnd} onChange={e => setEventRecurrenceEnd(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-900 focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
                </div>
              )}
              <button type="submit" disabled={eventSaving || (eventRecurrence !== 'none' && !eventRecurrenceEnd)} className="w-full rounded-2xl bg-violet-600 hover:bg-violet-700 py-3.5 text-sm font-black text-white transition-all shadow-lg shadow-violet-100 disabled:opacity-50 active:scale-95 uppercase tracking-widest">
                {eventSaving ? (editingEventId ? 'Mise à jour...' : 'Création...') : (editingEventId ? 'Mettre à jour' : (eventRecurrence !== 'none' ? 'Créer les occurrences' : 'Ajouter l\'événement'))}
              </button>
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
      <div className="text-xl font-black leading-none">{value}</div>
      <div className="text-[9px] font-black uppercase tracking-wider mt-1 opacity-80">{label}</div>
    </div>
  );
}
