'use client';
import { useState, useEffect, use } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ProjectProvider, Project } from './ProjectContext';
import LeaveProjectModal from '@/components/LeaveProjectModal';

export default function ProjectLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function init() {
      try {
        // Un endpoint backend à créer pour get un projet: /projects/:id
        const p = await api.get(`/projects/${projectId}`);
        setProject(p);
      } catch (err) {
        console.error(err);
        router.push('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [projectId, router]);

  async function toggleFavorite() {
    try {
      const res = await api.post(`/projects/${projectId}/toggle-favorite`, {});
      setProject(prev => prev ? { ...prev, is_favorite: res.is_favorite } : null);
      // Notifier la sidebar et le dashboard
      window.dispatchEvent(new Event('projects-refresh'));
    } catch (err) {
      console.error('Failed to toggle favorite', err);
    }
  }

  async function handleRestore() {
    try {
      await api.patch(`/projects/${projectId}/restore`, {});
      // Re-fetch project to update status
      const p = await api.get(`/projects/${projectId}`);
      setProject(p);
    } catch (err) {
      console.error('Failed to restore project', err);
    }
  }

  if (loading) return <div className="p-8"><div className="animate-pulse h-10 bg-stone-200 rounded-xl w-64 mb-6"></div></div>;
  if (!project) return null;

  const isReadOnly = project.status !== 'active';

  const tabs = [
    { name: 'Dashboard', path: `/projects/${projectId}` },
    { name: 'Tâches', path: `/projects/${projectId}/tasks` },
    { name: 'GANTT', path: `/projects/${projectId}/calendar` },
    { name: 'Budget', path: `/projects/${projectId}/budget` },
    { name: 'Assistant IA', path: `/projects/${projectId}/ai` },
    { name: 'Chat', path: `/projects/${projectId}/chat` },
  ];

  tabs.push({ name: 'Paramètres', path: `/projects/${projectId}/settings` });

  return (
    <ProjectProvider value={project}>
      <div className="flex flex-col h-full bg-stone-50 animate-fadeIn">
        {/* Project Header */}
        <header className="bg-white border-b border-stone-200 px-4 md:px-8 py-3 lg:py-6 shrink-0 relative z-20 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/dashboard" className="lg:hidden flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-700 active:scale-95 transition-transform shrink-0">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="w-10 h-10 lg:w-14 lg:h-14 bg-orange-500 rounded-xl lg:rounded-2xl flex items-center justify-center text-white font-black text-sm lg:text-xl overflow-hidden shrink-0">
                {project.avatar ? (
                  <img src={project.avatar} alt={project.title} className="w-full h-full object-cover" />
                ) : (
                  (project?.title || 'PR').substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg lg:text-2xl font-black text-stone-900 leading-tight tracking-tight truncate">{project.title}</h1>
                  <button 
                    onClick={toggleFavorite}
                    className={`p-1.5 rounded-xl transition-all hover:scale-110 active:scale-95 ${project.is_favorite ? 'text-amber-400 bg-amber-50' : 'text-stone-300 hover:text-stone-400 bg-stone-50'}`}
                    title={project.is_favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  >
                    <svg width="20" height="20" fill={project.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                    </svg>
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {project.status === 'completed' && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-amber-200">Archivé</span>
                  )}
                  {project.status === 'deleted' && (
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase tracking-wider rounded-md border border-red-200">Corbeille</span>
                  )}
                  <p className="hidden lg:block text-[10px] lg:text-xs text-stone-400 font-bold uppercase tracking-widest truncate max-w-xl">{project.description || 'Projet sans description'}</p>
                </div>
              </div>
            </div>
            
            <div className="hidden lg:flex gap-2">
              <Link href="/dashboard" className="flex items-center justify-center px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95">
                Retour
              </Link>
              <button 
                onClick={() => setShowLeaveModal(true)}
                className="flex items-center justify-center px-4 py-2 bg-stone-50 hover:bg-stone-100 text-stone-500 hover:text-red-600 border border-stone-200 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95 gap-2 group"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="group-hover:translate-x-0.5 transition-transform"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                Quitter
              </button>
            </div>

            {/* Mobile Settings + Leave Icons */}
            <div className="lg:hidden flex items-center gap-2 shrink-0">
              <Link
                href={`/projects/${projectId}/settings`}
                data-tour="project-settings-mobile-btn"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-400 active:text-orange-500 active:scale-95 transition-all"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
              </Link>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-400 active:text-red-500 active:scale-95 transition-all"
              >
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </button>
            </div>
          </div>

          {/* Interior Navigation - Scrollable on mobile */}
          <nav className="flex gap-6 mt-6 pb-0 overflow-x-auto scrollbar-none -mx-4 px-4 md:-mx-0 md:px-0">
            {tabs.map(tab => {
              const active = pathname === tab.path;
              const tourAttr = tab.name === 'Dashboard' ? 'project-tab-dashboard'
                : tab.name === 'Tâches' ? 'project-tab-tasks'
                : tab.name === 'GANTT' ? 'project-tab-gantt'
                : tab.name === 'Budget' ? 'project-tab-budget'
                : tab.name === 'Assistant IA' ? 'project-tab-ai'
                : tab.name === 'Chat' ? 'project-tab-chat'
                : tab.name === 'Paramètres' ? 'project-tab-settings'
                : undefined;
              return (
                <Link key={tab.path} href={tab.path}
                  {...(tourAttr ? { 'data-tour': tourAttr } : {})}
                  className={`pb-3 text-[10px] font-black uppercase tracking-[0.15em] border-b-2 transition-all duration-200 whitespace-nowrap ${
                    active ? 'border-orange-500 text-orange-600' : 'border-transparent text-stone-400 hover:text-stone-800'
                  } ${tab.name === 'Paramètres' ? 'hidden lg:block' : ''}`}>
                  {tab.name}
                </Link>
              )
            })}
          </nav>
        </header>

        {/* Status Warning Banner */}
        {isReadOnly && (
          <div className={`px-4 lg:px-8 py-3 flex items-center justify-between gap-4 animate-slideDown ${project.status === 'completed' ? 'bg-amber-500' : 'bg-red-600'} text-white shadow-inner`}>
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm shrink-0">
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-sm font-bold tracking-tight">
                {project.status === 'completed' 
                  ? "Ce projet est archivé. Les modifications sont désactivées." 
                  : "Ce projet est dans la corbeille. Restaurez-le pour effectuer des modifications."}
              </p>
            </div>
            <button 
              onClick={handleRestore}
              className="px-4 py-1.5 bg-white text-stone-900 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-stone-100 transition-all active:scale-95 shadow-sm"
            >
              Restaurer
            </button>
          </div>
        )}

        {/* Pages content */}
        <div className="flex-1 overflow-auto">
          <div className="pb-32 lg:pb-8">
            {children}
          </div>
        </div>

        {showLeaveModal && (
          <LeaveProjectModal
            projectId={project.id}
            projectTitle={project.title}
            isOwner={project.owner_id === user?.id}
            members={project.members || []}
            currentUserId={user?.id || 0}
            onClose={() => setShowLeaveModal(false)}
          />
        )}
      </div>
    </ProjectProvider>
  );
}
