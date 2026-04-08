'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Project {
  id: number;
  title: string;
  description: string | null;
  deadline: string | null;
  owner_id: number;
  owner_name: string;
  member_count: number;
  created_at: string;
}

export default function HistoryPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchHistory() {
      try {
        const data = await api.get('/projects/history');
        setProjects(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return (
    <div className="p-8 max-w-6xl mx-auto animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-stone-900">Historique des projets</h1>
        <p className="text-stone-400 text-sm mt-0.5">
          {loading ? 'Chargement...' : `${projects.length} projet${projects.length > 1 ? 's' : ''} terminé${projects.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-40 bg-white rounded-2xl border border-stone-200 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="py-24 text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-stone-400">
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 className="text-stone-900 font-semibold text-lg">Aucun projet terminé</h3>
          <p className="text-stone-400 text-sm mt-1">Les projets que vous clôturez apparaîtront ici.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div 
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="bg-white rounded-2xl border border-stone-200 p-6 opacity-80 hover:opacity-100 grayscale-[0.5] hover:grayscale-0 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-500 font-bold group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                  {p.title.substring(0,2).toUpperCase()}
                </div>
                <span className="px-2 py-1 bg-stone-50 text-stone-400 text-[10px] font-bold uppercase tracking-widest rounded-lg">Terminé</span>
              </div>
              <h3 className="font-bold text-stone-800 mb-1 truncate">{p.title}</h3>
              <p className="text-sm text-stone-400 line-clamp-2 mb-4">{p.description || 'Pas de description.'}</p>
              
              <div className="flex items-center justify-between pt-4 border-t border-stone-50 text-[11px] text-stone-400 font-medium">
                <span>Par {p.owner_name}</span>
                <span>{p.member_count} membre{p.member_count > 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
