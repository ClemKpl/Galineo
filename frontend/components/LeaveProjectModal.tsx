'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ProjectMember } from '../app/(app)/projects/[id]/ProjectContext';

interface LeaveProjectModalProps {
  projectId: number;
  projectTitle: string;
  isOwner: boolean;
  members: ProjectMember[];
  currentUserId: number;
  onClose: () => void;
}

export default function LeaveProjectModal({ 
  projectId, 
  projectTitle, 
  isOwner, 
  members, 
  currentUserId,
  onClose 
}: LeaveProjectModalProps) {
  const router = useRouter();
  const [successorId, setSuccessorId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherMembers = members.filter(m => m.id !== currentUserId);

  const handleLeave = async () => {
    if (isOwner && otherMembers.length > 0 && !successorId) {
      setError("Veuillez choisir un successeur avant de quitter le projet.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.post(`/projects/${projectId}/leave`, { successorId: successorId || undefined });
      window.dispatchEvent(new Event('projects-refresh'));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <h3 className="text-lg font-bold text-stone-900">Quitter le projet</h3>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
            <p className="text-sm text-orange-800 leading-relaxed font-medium">
              Voulez-vous vraiment quitter <strong className="text-orange-950">"{projectTitle}"</strong> ? Vous n'aurez plus accès à son contenu ni aux discussions.
            </p>
          </div>

          {isOwner && (
            <div className="space-y-4">
              {otherMembers.length > 0 ? (
                <>
                  <label className="block text-sm font-bold text-stone-700">Changer de propriétaire</label>
                  <p className="text-xs text-stone-500 mb-2">En tant que propriétaire, vous devez désigner un successeur pour continuer à gérer le projet.</p>
                  <select 
                    value={successorId}
                    onChange={(e) => setSuccessorId(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 text-stone-900 outline-none transition-all"
                  >
                    <option value="">Sélectionner un nouveau propriétaire...</option>
                    {otherMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.role_name})</option>
                    ))}
                  </select>
                </>
              ) : (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <p className="text-sm font-bold text-red-900">Suppression automatique</p>
                    <p className="text-xs text-red-700 mt-0.5">Vous êtes le seul membre. Quitter ce projet entraînera sa suppression définitive.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-xs font-bold text-red-500 text-center">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-stone-200 text-stone-600 rounded-xl font-bold hover:bg-stone-50 transition-colors"
            >
              Annuler
            </button>
            <button 
              onClick={handleLeave}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-sm shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Traitement...' : 'Déconfirmer le départ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
