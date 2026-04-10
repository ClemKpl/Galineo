'use client';
import { useState, useEffect, useCallback } from 'react';
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

export default function TrashPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyingTrash, setEmptyingTrash] = useState(false);
  const router = useRouter();

  const fetchTrash = useCallback(async () => {
    try {
      const data = await api.get('/projects/trash');
      setProjects(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrash();
  }, [fetchTrash]);

  const restoreProject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('Voulez-vous restaurer ce projet et le rendre actif ?')) return;
    try {
      await api.patch(`/projects/${id}/restore`, {});
      window.dispatchEvent(new Event('project-updated'));
      fetchTrash();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const hardDeleteProject = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('ATTENTION : Voulez-vous supprimer ce projet de façon DÉFINITIVE ? Cette action est irréversible.')) return;
    try {
      await api.delete(`/projects/${id}/hard`);
      fetchTrash();
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const emptyTrash = async () => {
    if (!projects.length) return;
    if (!confirm('ATTENTION : Voulez-vous supprimer définitivement tout le contenu de la corbeille ? Cette action est irréversible.')) return;

    setEmptyingTrash(true);
    try {
      await api.delete('/projects/trash/empty');
      fetchTrash();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setEmptyingTrash(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto animate-[fadeIn_0.3s_ease-out]">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Corbeille</h1>
          <p className="text-stone-400 text-sm mt-0.5">
            {loading ? 'Chargement...' : `${projects.length} projet${projects.length > 1 ? 's' : ''} supprimé${projects.length > 1 ? 's' : ''}`}
          </p>
        </div>
        {!loading && projects.length > 0 && (
          <button
            type="button"
            onClick={emptyTrash}
            disabled={emptyingTrash}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-600 transition-all hover:bg-red-100 disabled:opacity-50 active:scale-95"
          >
            {emptyingTrash && <div className="h-3.5 w-3.5 rounded-full border-2 border-red-300/50 border-t-red-600 animate-spin" />}
            Tout vider
          </button>
        )}
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
            <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/></svg>
          </div>
          <h3 className="text-stone-900 font-semibold text-lg">Corbeille vide</h3>
          <p className="text-stone-400 text-sm mt-1">Les projets supprimés seront conservés ici temporairement.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((p) => (
            <div 
              key={p.id}
              onClick={() => router.push(`/projects/${p.id}`)}
              className="bg-white rounded-2xl border border-red-100 p-6 opacity-90 hover:opacity-100 shadow-sm hover:shadow-md transition-all cursor-pointer group relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-500 font-bold">
                  {(p.title || 'PR').substring(0, 2).toUpperCase()}
                </div>
                
                <div className="flex gap-2">
                  <button onClick={(e) => restoreProject(e, p.id)} title="Restaurer" className="p-1.5 text-stone-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v0a8 8 0 01-8 8H3"/><path d="M8 5L3 10l5 5"/></svg>
                  </button>
                  <button onClick={(e) => hardDeleteProject(e, p.id)} title="Supprimer définitivement" className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
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
