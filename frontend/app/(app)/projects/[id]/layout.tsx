'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ProjectProvider } from './ProjectContext';

export default function ProjectLayout({ children, params }: { children: React.ReactNode, params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const projectId = resolvedParams.id;

  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
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

  if (loading) return <div className="p-8"><div className="animate-pulse h-10 bg-stone-200 rounded-xl w-64 mb-6"></div></div>;
  if (!project) return null;

  const tabs = [
    { name: 'Dashboard', path: `/projects/${projectId}` },
    { name: 'Tâches', path: `/projects/${projectId}/tasks` },
    { name: 'GANTT', path: `/projects/${projectId}/calendar` },
    { name: 'Assistant IA', path: `/projects/${projectId}/ai` },
    { name: 'Chat', path: `/projects/${projectId}/chat` },
  ];

  const isAdmin = project.owner_id === project.my_user_id || project.my_role_id === 1 || project.my_role_id === 2;
  if (isAdmin) {
    tabs.push({ name: 'Paramètres', path: `/projects/${projectId}/settings` });
  }

  return (
    <ProjectProvider value={project}>
      <div className="flex flex-col h-full bg-stone-50 animate-fadeIn">
        {/* Project Header */}
        <header className="bg-white border-b border-stone-200 px-4 md:px-8 py-4 md:py-6 shrink-0 relative z-20 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-orange-500/20 overflow-hidden shrink-0">
                {project.avatar ? (
                  <img src={project.avatar} alt={project.title} className="w-full h-full object-cover" />
                ) : (
                  (project?.title || 'PR').substring(0, 2).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-black text-stone-900 leading-tight tracking-tight truncate">{project.title}</h1>
                <p className="text-[10px] md:text-xs text-stone-400 font-bold uppercase tracking-widest mt-1 truncate max-w-xl">{project.description || 'Projet sans description'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard" className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-all active:scale-95">
                Retour
              </Link>
            </div>
          </div>

          {/* Interior Navigation - Scrollable on mobile */}
          <nav className="flex gap-6 mt-6 pb-0 overflow-x-auto scrollbar-none -mx-4 px-4 md:-mx-0 md:px-0">
            {tabs.map(tab => {
              const active = pathname === tab.path;
              return (
                <Link key={tab.path} href={tab.path}
                  className={`pb-3 text-[10px] font-black uppercase tracking-[0.15em] border-b-2 transition-all duration-200 whitespace-nowrap ${
                    active ? 'border-orange-500 text-orange-600' : 'border-transparent text-stone-400 hover:text-stone-800'
                  }`}>
                  {tab.name}
                </Link>
              )
            })}
          </nav>
        </header>

        {/* Pages content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </ProjectProvider>
  );
}
