'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Activity {
  id: number;
  user_id: number;
  user_name: string;
  entity_type: string;
  entity_id: number;
  action_type: string;
  details: string;
  created_at: string;
}

interface Props {
  projectId: number;
}

export default function ProjectActivityLog({ projectId }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchActivities();
  }, [projectId]);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/projects/${projectId}/activities`);
      setActivities(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des activités');
    } finally {
      setLoading(false);
    }
  };

  const renderActivityText = (a: Activity) => {
    const details = a.details ? JSON.parse(a.details) : {};
    const userName = <span className="font-bold text-stone-900">{a.user_name || 'Système'}</span>;
    
    switch (a.entity_type) {
      case 'project':
        if (a.action_type === 'created') return <>{userName} a créé le projet <span className="italic">"{details.title}"</span></>;
        if (a.action_type === 'updated') return <>{userName} a mis à jour les paramètres du projet</>;
        if (a.action_type === 'completed') return <>{userName} a marqué le projet comme <span className="text-green-600 font-bold">Terminé</span></>;
        if (a.action_type === 'cleared_all_tasks') return <>{userName} a <span className="text-red-600 font-bold">supprimé toutes les tâches</span> du projet</>;
        break;
      case 'task':
        if (a.action_type === 'created') return <>{userName} a créé la tâche <span className="font-medium text-orange-600">"{details.title}"</span></>;
        if (a.action_type === 'updated') {
            if (details.status) return <>{userName} a passé une tâche en <span className="font-bold uppercase text-[10px] bg-stone-100 px-1.5 py-0.5 rounded">{details.status}</span></>;
            if (details.assigned_to) return <>{userName} a réassigné une tâche</>;
            return <>{userName} a modifié une tâche</>;
        }
        if (a.action_type === 'deleted') return <>{userName} a supprimé une tâche</>;
        break;
      case 'member':
        if (a.action_type === 'added') return <>{userName} a ajouté un nouveau membre au projet</>;
        if (a.action_type === 'added_or_updated') return <>{userName} a géré l'accès d'un membre</>;
        if (a.action_type === 'role_updated') return <>{userName} a modifié le rôle d'un membre</>;
        if (a.action_type === 'removed') return <>{userName} a retiré un membre du projet</>;
        break;
      case 'comment':
        if (a.action_type === 'added') return <>{userName} a ajouté un commentaire sur une tâche</>;
        break;
    }
    return <>{userName} a effectué une action ({a.action_type} sur {a.entity_type})</>;
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'project': return '📁';
      case 'task': return '✅';
      case 'member': return '👤';
      case 'comment': return '💬';
      default: return '📍';
    }
  };

  if (loading) return (
    <div className="flex flex-col gap-4 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-16 bg-stone-50 animate-pulse rounded-2xl border border-stone-100" />
      ))}
    </div>
  );

  if (error) return (
    <div className="p-8 text-center bg-red-50 rounded-3xl border border-red-100">
      <p className="text-red-600 font-medium">{error}</p>
      <p className="text-red-400 text-sm mt-2">Vous n'avez peut-être pas les droits requis pour voir ces logs.</p>
    </div>
  );

  if (activities.length === 0) return (
    <div className="p-12 text-center bg-stone-50 rounded-3xl border border-dashed border-stone-200">
      <p className="text-stone-400 font-medium">Aucune activité enregistrée pour le moment.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-sm font-black uppercase tracking-widest text-stone-400">Journal d'activités</h3>
        <button onClick={fetchActivities} className="text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors flex items-center gap-1">
          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Actualiser
        </button>
      </div>

      <div className="relative group/scroll flex flex-col gap-3">
        {activities.map((a, idx) => (
          <div key={a.id} className="relative flex items-start gap-4 p-4 bg-white border border-stone-100 rounded-2xl hover:border-orange-200 hover:shadow-sm transition-all animate-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 0.05}s` }}>
            <div className="w-10 h-10 rounded-xl bg-stone-50 flex items-center justify-center text-lg shrink-0 border border-stone-50">
              {getIcon(a.entity_type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-stone-600 leading-relaxed">
                {renderActivityText(a)}
              </p>
              <p className="text-[10px] font-bold text-stone-300 uppercase mt-1 tracking-tighter">
                {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: fr })}
              </p>
            </div>
          </div>
        ))}
      </div>
      
      <p className="text-center text-[10px] text-stone-300 font-medium uppercase tracking-widest pt-4">Fin du journal récent</p>
    </div>
  );
}
