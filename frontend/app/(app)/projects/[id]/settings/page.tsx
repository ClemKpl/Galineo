'use client';

import { useState, useEffect } from 'react';
import { useProject } from '../ProjectContext';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import ManageMembersModal from '@/components/ManageMembersModal';
import LeaveProjectModal from '@/components/LeaveProjectModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
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
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [aiSettings, setAiSettings] = useState({ allow_create: 1, allow_modify: 1, allow_members: 1, allow_delete: 0, allow_invite: 1, allow_color: 1 });
  const [aiLoading, setAiLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function loadAiSettings() {
      try {
        const res = await api.get(`/projects/${project.id}/ai-settings`);
        setAiSettings(res);
      } catch (err) { console.error('Error loading AI settings', err); }
    }
    loadAiSettings();
  }, [project.id]);

  async function handleToggleAiPermission(key: string, value: number) {
    const newSettings = { ...aiSettings, [key]: value };
    setAiSettings(newSettings);
    try {
      await api.patch(`/projects/${project.id}/ai-settings`, newSettings);
      showToast("Permissions IA mises à jour", "success");
    } catch (err) {
      showToast("Erreur lors de la mise à jour des permissions IA", "error");
    }
  }

  async function handleUpdateProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/projects/${project.id}`, { title, description, deadline: deadline || null, avatar: projectAvatar || null });
      showToast('Paramètres mis à jour !', 'success');
      // On rafraîchit la page pour mettre à jour le context
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      showToast((err as Error).message, 'error');
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
        showToast("Projet supprimé", "info");
        // Déclencher le rafraîchissement global de la sidebar
        window.dispatchEvent(new Event('projects-refresh'));
        router.push('/dashboard');
      } catch (err) {
        showToast((err as Error).message, "error");
        setIsDeleting(false);
      }
    }
  }

  async function handleCompleteProject() {
    const confirmation = confirm('Voulez-vous marquer ce projet comme TERMINÉ ? Il sera déplacé dans l\'historique et ne sera plus modifiable.');
    if (confirmation) {
      try {
        await api.patch(`/projects/${project.id}/complete`, {});
        showToast("Projet archivé", "info");
        // Déclencher le rafraîchissement global de la sidebar
        window.dispatchEvent(new Event('projects-refresh'));
        router.push('/dashboard');
      } catch (err) {
        showToast((err as Error).message, "error");
      }
    }
  }

  const isOwner = project.my_role_id === 1 || project.owner_id === user?.id || user?.plan === 'unlimited';

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6 md:space-y-8 animate-[fadeIn_0.3s_ease-out]">
      <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-stone-100 bg-stone-50/50">
          <h2 className="text-lg font-bold text-stone-900">Informations générales</h2>
          <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold mt-1">Éditez les détails principaux du projet</p>
        </div>

        <form onSubmit={handleUpdateProject} className="p-4 md:p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-stone-700 mb-2">Titre du projet</label>
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                required
                disabled={!isOwner}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-stone-700 mb-2">Description</label>
              <textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                rows={4}
                disabled={!isOwner}
                className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 transition-all resize-none disabled:opacity-70 disabled:cursor-not-allowed"
                placeholder="Décrivez l'objectif du projet..."
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Date d'échéance principale</label>
              <input 
                type="date" 
                value={deadline} 
                onChange={(e) => setDeadline(e.target.value)}
                disabled={!isOwner}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-2">Avatar du projet (URL)</label>
              <input 
                type="url" 
                value={projectAvatar} 
                onChange={(e) => setProjectAvatar(e.target.value)}
                placeholder="https://votre-image.jpg"
                disabled={!isOwner}
                className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 text-stone-900 transition-all font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          
          {isOwner && (
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          )}
        </form>
      </section>

      {/* ── Assistant AI Permissions ── */}
      {isOwner && (
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-orange-50 to-white">
            <h2 className="text-lg font-bold text-stone-900 flex items-center gap-2">
              <span className="text-xl">🤖</span> Permissions de l'Assistant IA
            </h2>
            <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold mt-1">Contrôlez les actions autonomes autorisées</p>
          </div>

          <div className="p-4 md:p-6 space-y-4">
            <PermissionToggle 
              label="Créer des éléments" 
              description="Autoriser l'IA à créer des fonctionnalités et des tâches."
              active={aiSettings.allow_create === 1}
              onChange={(val) => handleToggleAiPermission('allow_create', val ? 1 : 0)}
            />
            <PermissionToggle 
              label="Modifier les tâches" 
              description="Autoriser l'IA à changer les dates, priorités et statuts."
              active={aiSettings.allow_modify === 1}
              onChange={(val) => handleToggleAiPermission('allow_modify', val ? 1 : 0)}
            />
            <PermissionToggle
              label="Gérer les membres"
              description="Autoriser l'IA à ajouter ou retirer des collaborateurs déjà inscrits."
              active={aiSettings.allow_members === 1}
              onChange={(val) => handleToggleAiPermission('allow_members', val ? 1 : 0)}
            />
            <PermissionToggle
              label="Invitations externes"
              description="Autoriser l'IA à envoyer des invitations par email à des personnes non inscrites."
              active={aiSettings.allow_invite === 1}
              onChange={(val) => handleToggleAiPermission('allow_invite', val ? 1 : 0)}
            />
            <PermissionToggle
              label="Changer les couleurs Gantt"
              description="Autoriser l'IA à modifier la couleur des tâches dans le diagramme de Gantt."
              active={aiSettings.allow_color === 1}
              onChange={(val) => handleToggleAiPermission('allow_color', val ? 1 : 0)}
            />
            <div className="pt-4 border-t border-stone-100">
              <PermissionToggle
                label="Supprimer des éléments"
                description="Action irréversible. L'IA pourra supprimer des tâches existantes."
                active={aiSettings.allow_delete === 1}
                isExperimental={true}
                onChange={(val) => handleToggleAiPermission('allow_delete', val ? 1 : 0)}
              />
            </div>
          </div>
        </section>
      )}

      <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Équipe & Membres</h2>
            <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold mt-1">Les collaborateurs actifs sur ce projet</p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowMembersModal(true)}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Gérer les membres
            </button>
          )}
        </div>
        <div className="p-4 md:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {project.members && project.members.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 p-3 bg-stone-50 border border-stone-100 rounded-2xl">
                <div className="w-10 h-10 rounded-full bg-white border border-stone-200 flex items-center justify-center text-stone-700 font-bold shadow-sm shrink-0 overflow-hidden">
                  {m.avatar ? <img src={m.avatar} alt="" className="w-full h-full object-cover" /> : m.name.substring(0,2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-stone-900 truncate">{m.name}</p>
                  <p className="text-[10px] font-bold text-orange-600 uppercase tracking-widest">{m.role_name}</p>
                </div>
              </div>
            ))}
            {project.invitations && project.invitations.map((inv: any) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 bg-orange-50/30 border border-orange-100 rounded-2xl">
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
            <div className="px-4 md:px-6 py-4 border-b border-orange-50 bg-orange-50/50">
              <h2 className="text-lg font-bold text-orange-900">Statut du projet</h2>
              <p className="text-xs text-orange-600 uppercase tracking-wider font-semibold mt-1">Actions de fin de vie</p>
            </div>
            <div className="p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-stone-900">Terminer & Archiver</p>
                <p className="text-xs text-stone-500 mt-1">Marquer le projet comme fini et le placer dans votre historique.</p>
              </div>
              <button
                onClick={handleCompleteProject}
                className="w-full sm:w-auto px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                Terminer le projet
              </button>
            </div>
          </section>

          <section className="bg-red-50/30 rounded-2xl border border-red-100 shadow-sm overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-red-50 bg-red-50/50">
              <h2 className="text-lg font-bold text-red-900">Zone de danger</h2>
              <p className="text-xs text-red-600 uppercase tracking-wider font-semibold mt-1">Actions irréversibles</p>
            </div>
            <div className="p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-stone-900">Supprimer le projet</p>
                <p className="text-xs text-stone-500 mt-1">Cette action supprimera également toutes les tâches et fichiers associés.</p>
              </div>
              <button
                onClick={handleDeleteProject}
                disabled={isDeleting}
                className="w-full sm:w-auto px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
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

function PermissionToggle({ label, description, active, onChange, isExperimental }: { label: string, description: string, active: boolean, onChange: (val: boolean) => void, isExperimental?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 group">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-stone-900 uppercase tracking-tight">{label}</h4>
          {isExperimental && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-black rounded uppercase tracking-widest animate-pulse border border-red-200">
              ⚠️ Expérimental
            </span>
          )}
        </div>
        <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <button 
        onClick={() => onChange(!active)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${active ? 'bg-orange-600' : 'bg-stone-200'}`}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${active ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}

function ShareLinksSection({ projectId }: { projectId: number }) {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();
 
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
      showToast("Lien de partage généré", "success");
      await fetchLinks();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function revokeLink(id: number) {
    if (!confirm('Révoquer ce lien ? Il ne sera plus utilisable.')) return;
    try {
      await api.delete(`/projects/share-links/${id}`);
      showToast("Lien révoqué", "info");
      await fetchLinks();
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  }

  function copyToClipboard(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    navigator.clipboard.writeText(url);
    showToast('Lien copié !', 'success');
  }

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="px-4 md:px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex flex-wrap items-center justify-between gap-3">
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
      <div className="p-4 md:p-6">
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
