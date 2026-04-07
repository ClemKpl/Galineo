'use client';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';

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
    { name: 'Calendrier', path: `/projects/${projectId}/calendar` },
    { name: 'Chat', path: `/projects/${projectId}/chat` },
  ];

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* Project Header */}
      <header className="bg-white border-b border-stone-200 px-8 py-5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {project.title.substring(0,2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-stone-900 leading-tight">{project.title}</h1>
              <p className="text-sm text-stone-500 mt-0.5 max-w-xl truncate">{project.description || 'Projet sans description'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard" className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 hover:text-stone-900 rounded-lg text-sm font-medium transition-colors">
              Retour
            </Link>
          </div>
        </div>

        {/* Interior Navigation */}
        <nav className="flex gap-6 mt-6 pb-0">
          {tabs.map(tab => {
            const active = pathname === tab.path;
            return (
              <Link key={tab.path} href={tab.path}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  active ? 'border-orange-500 text-orange-600' : 'border-transparent text-stone-500 hover:text-stone-800'
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
  );
}
