'use client';
import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import CreateProjectModal from '@/components/CreateProjectModal';
import ManageMembersModal from '@/components/ManageMembersModal';
import { useRouter } from 'next/navigation';

interface Project {
  id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  owner_id: number;
  owner_name: string;
  member_count: number;
  my_role_id?: number | null;
  my_role_name?: string | null;
  created_at: string;
}

interface AssignedTask {
  id: number;
  title: string;
  status: 'todo' | 'in_progress' | 'done' | string;
  due_date: string | null;
  project_id: number;
  project_title: string;
}

interface UpcomingEvent {
  id: number;
  project_id: number;
  project_title: string;
  title: string;
  description?: string | null;
  start_datetime: string;
  end_datetime: string;
  location?: string | null;
  creator_name?: string;
  attendee_names: string;
  attendee_count: number;
}

function ProjectCard({ project, currentUserId, onClick, onManageMembers }: { project: Project; currentUserId: number; onClick: () => void; onManageMembers?: () => void }) {
  const isOwner = project.owner_id === currentUserId;
  const canManageMembers = isOwner || project.my_role_id === 2 || project.my_role_id === 1;
  const now = new Date();
  const deadline = project.deadline ? new Date(project.deadline) : null;
  const isOverdue = deadline ? deadline < now : false;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / 86400000) : null;

  return (
    <div onClick={onClick}
      className="bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-md hover:border-stone-300 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
      <div className="flex items-start justify-between mb-2 gap-3">
        <h3 className="font-semibold text-stone-900 text-base group-hover:text-orange-500 transition-colors leading-snug">
          {project.title}
        </h3>
        <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${
          isOwner
            ? 'bg-orange-50 text-orange-600 border-orange-100'
            : 'bg-stone-50 text-stone-500 border-stone-200'
        }`}>
          {isOwner ? 'Propriétaire' : 'Membre'}
        </span>
      </div>

      {project.description && (
        <p className="text-stone-500 text-sm line-clamp-2 mb-4">{project.description}</p>
      )}

      {canManageMembers && onManageMembers && (
        <div className="mb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onManageMembers();
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            Gérer les membres
          </button>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-stone-100 mt-4">
        <div className="flex items-center gap-1.5 text-stone-400 text-xs">
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          {project.member_count} membre{project.member_count > 1 ? 's' : ''}
        </div>

        {deadline && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isOverdue
              ? 'bg-red-50 text-red-500'
              : daysLeft !== null && daysLeft <= 7
                ? 'bg-amber-50 text-amber-600'
                : 'bg-stone-50 text-stone-400'
          }`}>
            {isOverdue ? 'En retard'
              : daysLeft === 0 ? "Aujourd'hui"
              : daysLeft === 1 ? 'Demain'
              : `${daysLeft}j restants`}
          </span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-4">
        <svg width="28" height="28" fill="none" stroke="#f97316" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
        </svg>
      </div>
      <h3 className="text-stone-900 font-semibold text-lg mb-1">Aucun projet pour l&apos;instant</h3>
      <p className="text-stone-400 text-sm mb-6 max-w-xs">Créez votre premier projet ou attendez d&apos;être ajouté à un projet existant.</p>
      <button onClick={onNew}
        className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors text-sm">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Créer un projet
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [manageProjectId, setManageProjectId] = useState<number | null>(null);
  const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
  const [assignedLoading, setAssignedLoading] = useState(true);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const router = useRouter();

  const fetchProjects = useCallback(async () => {
    try {
      const data = await api.get('/projects');
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAssignedTasks = useCallback(async () => {
    try {
      const data = await api.get('/tasks/assigned');
      setAssignedTasks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setAssignedTasks([]);
    } finally {
      setAssignedLoading(false);
    }
  }, []);

  const fetchUpcomingEvents = useCallback(async () => {
    try {
      const data = await api.get('/events/upcoming');
      setUpcomingEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setUpcomingEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchAssignedTasks();
    fetchUpcomingEvents();
    const handler = () => fetchProjects();
    window.addEventListener('project-created', handler);
    return () => window.removeEventListener('project-created', handler);
  }, [fetchProjects, fetchAssignedTasks, fetchUpcomingEvents]);

  const ownedProjects  = projects.filter((p) => p.owner_id === user?.id);
  const memberProjects = projects.filter((p) => p.owner_id !== user?.id);

  const statusLabel = (s: string) => {
    if (s === 'todo') return 'À faire';
    if (s === 'in_progress') return 'En cours';
    if (s === 'done') return 'Terminé';
    return s;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Mes projets</h1>
          <p className="text-stone-400 text-sm mt-0.5">
            {loading ? 'Chargement...' : `${projects.length} projet${projects.length > 1 ? 's' : ''} au total`}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors text-sm shadow-sm">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouveau projet
        </button>
      </div>

      {/* Assigned tasks */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Mes tâches assignées</h2>
          <button
            onClick={() => { setAssignedLoading(true); fetchAssignedTasks(); }}
            className="text-xs font-semibold text-stone-500 hover:text-stone-800"
          >
            Rafraîchir
          </button>
        </div>

        {assignedLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse h-28" />
            ))}
          </div>
        ) : assignedTasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-6 text-sm text-stone-400">
            Aucune tâche assignée pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedTasks.slice(0, 9).map((t) => {
              const due = t.due_date ? new Date(t.due_date) : null;
              const dueText = due && !Number.isNaN(due.getTime()) ? due.toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit' }) : null;
              return (
                <button
                  key={t.id}
                  onClick={() => router.push(`/projects/${t.project_id}/tasks`)}
                  className="text-left bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-md hover:border-stone-300 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 line-clamp-2">{t.title}</p>
                      <p className="text-xs text-stone-400 mt-1 truncate">{t.project_title}</p>
                    </div>
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
                      {statusLabel(t.status || 'todo')}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-stone-400">
                    <span>#{t.id}</span>
                    <span>{dueText ? `Échéance: ${dueText}` : 'Aucune échéance'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming events */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Mes prochains événements</h2>
          <button
            onClick={() => { setEventsLoading(true); fetchUpcomingEvents(); }}
            className="text-xs font-semibold text-stone-500 hover:text-stone-800"
          >
            Rafraîchir
          </button>
        </div>

        {eventsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse h-24" />
            ))}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-6 text-sm text-stone-400">
            Aucun événement à venir.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingEvents.slice(0, 6).map((ev) => {
              const start = new Date(ev.start_datetime);
              const isToday = start.toDateString() === new Date().toDateString();
              const isTomorrow = start.toDateString() === new Date(Date.now() + 86400000).toDateString();
              const dateLabel = isToday ? "Aujourd'hui" : isTomorrow ? 'Demain' : start.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
              const timeLabel = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              return (
                <button
                  key={ev.id}
                  onClick={() => router.push(`/projects/${ev.project_id}/calendar`)}
                  className="text-left bg-white rounded-2xl border border-violet-100 p-5 hover:shadow-md hover:border-violet-200 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <p className="text-sm font-semibold text-stone-900 line-clamp-1">{ev.title}</p>
                    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${isToday ? 'bg-orange-100 text-orange-600' : isTomorrow ? 'bg-amber-50 text-amber-600' : 'bg-violet-50 text-violet-600'}`}>
                      {dateLabel}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 truncate mb-1">{ev.project_title}</p>
                  <div className="flex items-center justify-between text-xs text-stone-400 mt-2">
                    <span className="flex items-center gap-1">
                      <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {timeLabel}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1 truncate max-w-[120px]">
                        <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {ev.location}
                      </span>
                    )}
                    {!ev.location && ev.attendee_count > 0 && (
                      <span>{ev.attendee_count} participant{ev.attendee_count > 1 ? 's' : ''}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-stone-200 p-5 animate-pulse h-36">
              <div className="h-4 bg-stone-100 rounded-lg w-3/4 mb-3" />
              <div className="h-3 bg-stone-100 rounded-lg w-full mb-2" />
              <div className="h-3 bg-stone-100 rounded-lg w-2/3" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onNew={() => setShowModal(true)} />
      ) : (
        <div className="space-y-8">
          {ownedProjects.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                Propriétaire · {ownedProjects.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownedProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    currentUserId={user!.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    onManageMembers={() => setManageProjectId(p.id)}
                  />
                ))}
              </div>
            </section>
          )}
          {memberProjects.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">
                Membre · {memberProjects.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {memberProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    currentUserId={user!.id}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    onManageMembers={() => setManageProjectId(p.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); fetchProjects(); }}
        />
      )}

      {manageProjectId !== null && (
        <ManageMembersModal
          projectId={manageProjectId}
          onClose={() => setManageProjectId(null)}
          onChanged={() => fetchProjects()}
        />
      )}
    </div>
  );
}
