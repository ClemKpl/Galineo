'use client';

import { useState, useEffect } from 'react';
import { useProject } from '../ProjectContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import ManageMembersModal from '@/components/ManageMembersModal';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ProjectSettingsPage() {
  const project = useProject();
  const { user } = useAuth();
  const router = useRouter();
  
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || '');
  const [deadline, setDeadline] = useState(project.deadline ? project.deadline.substring(0, 10) : '');
  const [projectAvatar, setProjectAvatar] = useState(project.avatar || '');
  const [saving, setSaving] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${project.id}`, { title, description, deadline: deadline || null, avatar: projectAvatar || null });
      alert('Projet mis à jour avec succès !');
      // On rafraîchit la page pour mettre à jour le context
      window.location.reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProject() {
    const confirmation = confirm('ATTENTION : Voulez-vous vraiment supprimer ce projet ? Cette action est irréversible et supprimera toutes les tâches, messages et membres associés.');
    
    if (confirmation) {
      setIsDeleting(true);
      try {
        await api.delete(`/projects/${project.id}`);
        router.push('/dashboard');
      } catch (err) {
        alert((err as Error).message);
        setIsDeleting(false);
      }
    }
  }

  async function handleCompleteProject() {
    const confirmation = confirm('Voulez-vous marquer ce projet comme TERMINÉ ? Il sera déplacé dans l\'historique et ne sera plus modifiable.');
    if (confirmation) {
      try {
        await api.patch(`/projects/${project.id}/complete`, {});
        router.push('/dashboard');
      } catch (err) {
        alert((err as Error).message);
      }
    }
  }

  const isOwner = project.my_role_id === 1 || project.owner_id === user?.id;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-[fadeIn_0.3s_ease-out]">
      <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <h2 className="text-lg font-bold text-stone-900">Informations générales</h2>
          <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold mt-1">Éditez les détails principaux du projet</p>
        </div>
        
        <form onSubmit={handleUpdateProject} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-stone-700 mb-2">Titre du projet</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 transition-all font-medium"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-stone-700 mb-2">Description</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                rows={4}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 transition-all resize-none"
                placeholder="Décrivez l'objectif du projet..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Date d'échéance principale</label>
              <input 
                type="date" 
                value={deadline} 
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Avatar du projet (URL)</label>
              <input 
                type="url" 
                value={projectAvatar} 
                onChange={(e) => setProjectAvatar(e.target.value)}
                placeholder="https://votre-image.jpg"
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 transition-all font-medium"
              />
            </div>
          </div>
          
          <div className="pt-4 flex justify-end">
            <button 
              type="submit" 
              disabled={saving}
              className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Équipe & Membres</h2>
            <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold mt-1">Gérez qui a accès à ce projet</p>
          </div>
          <button 
            onClick={() => setShowMembersModal(true)}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
            Gérer les membres
          </button>
        </div>
        <div className="p-6">
          <div className="flex flex-wrap gap-4">
             {project.members && project.members.map((m: any) => (
               <div key={m.id} className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-100 rounded-2xl min-w-[200px]">
                  <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-700 font-bold shadow-sm shrink-0">
                    {m.name.substring(0,2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900 truncate">{m.name}</p>
                    <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{m.role_name}</p>
                  </div>
               </div>
             ))}
             {project.invitations && project.invitations.map((inv: any) => (
               <div key={inv.id} className="flex items-center gap-3 p-3 bg-orange-50/30 border border-orange-100 rounded-2xl min-w-[200px]">
                  <div className="w-10 h-10 rounded-full bg-white border border-orange-200 flex items-center justify-center text-orange-400 font-bold shadow-sm shrink-0">
                    {inv.email.substring(0,1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900 truncate">{inv.email}</p>
                    <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest">En attente ({inv.role_name})</p>
                  </div>
               </div>
             ))}
          </div>
        </div>
      </section>

      {isOwner && (
        <ShareLinksSection projectId={project.id} />
      )}

      {isOwner && (
        <>
          <section className="bg-orange-50/30 rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-orange-50 bg-orange-50/50">
              <h2 className="text-lg font-bold text-orange-900">Statut du projet</h2>
              <p className="text-xs text-orange-600 uppercase tracking-wider font-semibold mt-1">Actions de fin de vie</p>
            </div>
            <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-stone-900">Terminer & Archiver</p>
                <p className="text-xs text-stone-500 mt-1">Marquer le projet comme fini et le placer dans votre historique.</p>
              </div>
              <button 
                onClick={handleCompleteProject}
                className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Terminer le projet
              </button>
            </div>
          </section>

          <section className="bg-red-50/30 rounded-2xl border border-red-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-red-50 bg-red-50/50">
            <h2 className="text-lg font-bold text-red-900">Zone de danger</h2>
            <p className="text-xs text-red-600 uppercase tracking-wider font-semibold mt-1">Actions irréversibles</p>
          </div>
          <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-stone-900">Supprimer le projet</p>
              <p className="text-xs text-stone-500 mt-1">Cette action supprimera également toutes les tâches et fichiers associés.</p>
            </div>
            <button 
              onClick={handleDeleteProject}
              disabled={isDeleting}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isDeleting ? 'Suppression...' : 'Supprimer définitivement'}
            </button>
          </div>
          </section>
        </>
      )}

      {showMembersModal && (
        <ManageMembersModal 
          projectId={project.id} 
          onClose={() => setShowMembersModal(false)}
          onChanged={() => {}}
        />
      )}
    </div>
  );
}

function ShareLinksSection({ projectId }: { projectId: number }) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchLinks();
  }, [projectId]);

  async function fetchLinks() {
    try {
      const data = await api.get(`/projects/${projectId}/share-links`);
      setLinks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createLink() {
    setCreating(true);
    try {
      await api.post(`/projects/${projectId}/share-links`, { roleId: 3 });
      await fetchLinks();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(id: number) {
    if (!confirm('Révoquer ce lien ? Il ne sera plus utilisable.')) return;
    try {
      await api.delete(`/projects/share-links/${id}`);
      await fetchLinks();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function copyToClipboard(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url);
    alert('Lien copié dans le presse-papiers !');
  }

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-stone-900">Liens de partage</h2>
          <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold mt-1">Créez des accès rapides pour votre équipe</p>
        </div>
        <button 
          onClick={createLink}
          disabled={creating}
          className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
        >
          {creating ? '...' : (
            <>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              Générer un lien
            </>
          )}
        </button>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="h-20 bg-stone-50 animate-pulse rounded-xl" />
        ) : links.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm italic">
            Aucun lien de partage actif.
          </div>
        ) : (
          <div className="space-y-3">
            {links.map((link) => {
               const isExpired = new Date(link.expires_at) < new Date();
               return (
                <div key={link.id} className="flex flex-col sm:flex-row items-center justify-between p-4 bg-stone-50 border border-stone-100 rounded-2xl gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate">Token: {link.token.substring(0,8)}...</p>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                        Rôle: {link.role_name} • {isExpired ? 'Expiré' : `Expire ${formatDistanceToNow(new Date(link.expires_at), { addSuffix: true, locale: fr })}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isExpired && (
                      <button 
                        onClick={() => copyToClipboard(link.token)}
                        className="px-3 py-1.5 bg-white border border-stone-200 text-stone-600 hover:text-stone-900 rounded-lg text-xs font-bold transition-all"
                      >
                        Copier le lien
                      </button>
                    )}
                    <button 
                      onClick={() => revokeLink(link.id)}
                      className="px-3 py-1.5 bg-white border border-red-100 text-red-500 hover:bg-red-50 rounded-lg text-xs font-bold transition-all"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
               );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
