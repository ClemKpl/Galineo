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
  avatar?: string | null;
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

function ProjectCard({ 
  project, 
  currentUserId, 
  onClick, 
  onManageMembers,
  onDragStart,
  onDragEnd,
  isDragging
}: { 
  project: Project; 
  currentUserId: number; 
  onClick: () => void; 
  onManageMembers?: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}) {
  const isOwner = project.owner_id === currentUserId;
  const canManageMembers = isOwner || project.my_role_id === 2 || project.my_role_id === 1;
  const now = new Date();
  const deadline = project.deadline ? new Date(project.deadline) : null;
  const isOverdue = deadline ? deadline < now : false;
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / 86400000) : null;

  return (
    <div 
      onClick={onClick}
      draggable="true"
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`bg-white rounded-2xl border p-5 transition-all duration-300 cursor-grab active:cursor-grabbing group ${
        isDragging ? 'opacity-40 scale-95 border-orange-300 border-dashed bg-stone-50' : 'border-stone-200 hover:shadow-xl hover:border-stone-300 hover:-translate-y-1'
      }`}>
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center text-stone-500 font-bold overflow-hidden shadow-sm shrink-0">
          {project.avatar ? (
            <img src={project.avatar} alt={project.title} className="w-full h-full object-cover" />
          ) : (
            project.title[0].toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-stone-900 text-base group-hover:text-orange-500 transition-colors leading-tight truncate">
            {project.title}
          </h3>
          <span className={`inline-block mt-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${
            isOwner
              ? 'bg-orange-50 text-orange-600 border-orange-100'
              : 'bg-stone-50 text-stone-500 border-stone-200'
          }`}>
            {isOwner ? 'Propriétaire' : 'Membre'}
          </span>
        </div>
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
  const [draggingProjectId, setDraggingProjectId] = useState<number | null>(null);
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
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Mes projets</h1>
          <p className="text-stone-400 text-sm mt-0.5">
            {loading ? 'Chargement...' : `${projects.length} projet${projects.length > 1 ? 's' : ''} au total`}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all text-sm shadow-sm active:scale-95 shrink-0">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nouveau projet
        </button>
      </div>

      {/* Assigned tasks */}
      <section className="mb-10 animate-fadeUp">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Mes tâches assignées</h2>
          <button
            onClick={() => { setAssignedLoading(true); fetchAssignedTasks(); }}
            className="text-[10px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-widest transition-colors"
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
                  className="text-left bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-xl hover:shadow-stone-200/40 hover:border-orange-200 transition-all duration-300 group active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 line-clamp-2 group-hover:text-orange-500 transition-colors leading-snug">{t.title}</p>
                      <p className="text-[10px] text-stone-400 mt-1.5 uppercase font-black tracking-widest truncate">{t.project_title}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.15em] text-stone-400">
                    <span className="px-2 py-0.5 bg-stone-50 rounded-md border border-stone-100 text-stone-500">{t.status === 'in_progress' ? 'En cours' : 'À faire'}</span>
                    <span className="flex items-center gap-1 opacity-60">
                       <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                       {dueText || 'Libre'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Upcoming events */}
      <section className="mb-10 animate-fadeUp [animation-delay:100ms]">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Mes prochains événements</h2>
          <button
            onClick={() => { setEventsLoading(true); fetchUpcomingEvents(); }}
            className="text-[10px] font-black text-orange-500 hover:text-orange-600 uppercase tracking-widest transition-colors"
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
                  className="text-left bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-xl hover:shadow-violet-100 hover:border-violet-200 transition-all duration-300 active:scale-[0.98]"
                >
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <p className="text-sm font-bold text-stone-900 line-clamp-1 leading-tight">{ev.title}</p>
                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${isToday ? 'bg-orange-100 text-orange-700' : isTomorrow ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}`}>
                      {dateLabel}
                    </span>
                  </div>
                  <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest truncate mb-1">{ev.project_title}</p>
                  <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 mt-3 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5 opacity-60">
                      <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {timeLabel}
                    </span>
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
              <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.25em] mb-4 px-1 flex items-center gap-3">
                Propriétaire <span className="w-1 h-1 rounded-full bg-stone-300"></span> {ownedProjects.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {ownedProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    currentUserId={user!.id}
                    isDragging={draggingProjectId === p.id}
                    onDragStart={() => setDraggingProjectId(p.id)}
                    onDragEnd={() => setDraggingProjectId(null)}
                    onClick={() => router.push(`/projects/${p.id}`)}
                    onManageMembers={() => setManageProjectId(p.id)}
                  />
                ))}
              </div>
            </section>
          )}
          {memberProjects.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black text-stone-400 uppercase tracking-[0.25em] mb-4 px-1 flex items-center gap-3">
                Membre <span className="w-1 h-1 rounded-full bg-stone-300"></span> {memberProjects.length}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {memberProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    currentUserId={user!.id}
                    isDragging={draggingProjectId === p.id}
                    onDragStart={() => setDraggingProjectId(p.id)}
                    onDragEnd={() => setDraggingProjectId(null)}
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
          onCreated={(newId) => { 
            setShowModal(false); 
            if (newId) router.push(`/projects/${newId}`);
            else fetchProjects(); 
          }}
        />
      )}

      {manageProjectId !== null && (
        <ManageMembersModal
          projectId={manageProjectId}
          onClose={() => setManageProjectId(null)}
          onChanged={() => fetchProjects()}
        />
      )}

      {/* Action Drop Zones */}
      {draggingProjectId && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-6 animate-[slideUp_0.4s_cubic-bezier(0.16,1,0.3,1)]">
          {/* History Zone */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              try {
                await api.patch(`/projects/${draggingProjectId}/complete`);
                setDraggingProjectId(null);
                fetchProjects();
              } catch (err) { alert("Erreur lors de l'archivage"); }
            }}
            className="w-40 h-40 rounded-3xl bg-white/80 backdrop-blur-xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center gap-3 group/zone hover:border-emerald-500 hover:bg-emerald-50/50 transition-all shadow-xl shadow-stone-200/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-xl group-hover/zone:bg-emerald-500 group-hover/zone:text-white transition-colors">📦</div>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover/zone:text-emerald-600">Archiver</p>
          </div>

          {/* Trash Zone */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              if (window.confirm("Voulez-vous vraiment mettre ce projet à la corbeille ?")) {
                try {
                  await api.delete(`/projects/${draggingProjectId}`);
                  setDraggingProjectId(null);
                  fetchProjects();
                } catch (err) { alert("Action réservée au propriétaire"); setDraggingProjectId(null); }
              }
            }}
            className="w-40 h-40 rounded-3xl bg-white/80 backdrop-blur-xl border-2 border-dashed border-stone-200 flex flex-col items-center justify-center gap-3 group/zone hover:border-red-500 hover:bg-red-50/50 transition-all shadow-xl shadow-stone-200/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-xl group-hover/zone:bg-red-500 group-hover/zone:text-white transition-colors">🗑️</div>
            <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 group-hover/zone:text-red-600">Supprimer</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp { from { transform: translate(-50%, 100px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
      `}</style>
    </div>
  );
}
