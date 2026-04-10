'use client';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface Invitation {
  id: number;
  project_id: number;
  project_title: string;
  project_avatar?: string | null;
  inviter_name: string;
  role_name: string;
}

export default function ProjectInvites({ onRefresh }: { onRefresh: () => void }) {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = async () => {
    try {
      const data = await api.get('/projects/invitations/pending');
      setInvites(data);
    } catch (err) {
      console.error('Failed to fetch invites', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
  }, []);

  const handleAction = async (id: number, action: 'accept' | 'decline') => {
    try {
      await api.post(`/projects/invitations/${id}/${action}`, {});
      setInvites(prev => prev.filter(i => i.id !== id));
      if (action === 'accept') {
        onRefresh();
        window.dispatchEvent(new Event('projects-refresh'));
      }
    } catch (err) {
      console.error(`Failed to ${action} invite`, err);
    }
  };

  if (loading || invites.length === 0) return null;

  return (
    <div className="mb-8 space-y-3 animate-fadeUp">
      <h2 className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em] px-1">Invitations en attente</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {invites.map((invite) => (
          <div key={invite.id} className="bg-white/60 backdrop-blur-md border border-orange-100 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0 overflow-hidden">
                {invite.project_avatar ? (
                  <img src={invite.project_avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  invite.project_title[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 truncate">
                  {invite.project_title}
                </p>
                <p className="text-[11px] text-stone-500 truncate">
                  Invité par <span className="font-semibold">{invite.inviter_name}</span> • {invite.role_name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handleAction(invite.id, 'decline')}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-stone-500 hover:bg-stone-100 transition-colors"
              >
                Décliner
              </button>
              <button 
                onClick={() => handleAction(invite.id, 'accept')}
                className="px-4 py-1.5 rounded-lg text-[11px] font-bold bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-200 transition-all active:scale-95"
              >
                Accepter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
