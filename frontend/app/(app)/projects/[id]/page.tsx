'use client';
import { useMemo } from 'react';
import { useProject } from './ProjectContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ProjectDashboardPage() {
  const project = useProject();
  const { user } = useAuth();
  const router = useRouter();
  const members = Array.isArray(project.members) ? project.members : [];

  const handleComplete = async () => {
    if (!confirm('Voulez-vous marquer ce projet comme TERMINÉ ? Il sera déplacé dans l\'historique.')) return;
    try {
      await api.patch(`/projects/${project.id}/complete`, {});
      window.dispatchEvent(new Event('project-updated'));
      router.push('/history');
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.role_id !== b.role_id) return a.role_id - b.role_id;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [members]);

  const formatLastLogin = (value?: string | null) => {
    if (!value) return 'Jamais';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const canComplete = project.my_role_id === 1 || project.my_role_id === 2 || project.owner_id === user?.id;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-stone-800">Vue d&apos;ensemble du projet</h2>
        {canComplete && project.status !== 'completed' && (
          <button 
            onClick={handleComplete}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm transition-all"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
            Terminer le projet
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
            <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Activité récente
            </h3>
            <div className="py-12 text-center text-stone-400 text-sm">
              Rien à afficher pour le moment.
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-stone-200 p-6">
             <h3 className="font-semibold text-stone-800 mb-4 flex items-center gap-2">
               <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
               Membres
             </h3>
             {sortedMembers.length === 0 ? (
               <div className="py-10 text-center text-stone-400 text-sm">Aucun membre.</div>
             ) : (
               <div className="space-y-3">
                 {sortedMembers.map((m) => (
                   <div key={m.id} className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 p-3">
                     <div className="min-w-0">
                       <p className="text-sm font-semibold text-stone-900 truncate">{m.name}</p>
                       <p className="text-xs text-stone-400 truncate">{m.email}</p>
                       <p className="text-xs text-stone-500 mt-1">Dernière connexion : {formatLastLogin(m.last_login_at)}</p>
                     </div>
                     <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-stone-100 text-stone-700">
                       {m.role_name}
                     </span>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
