'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

function IconBell() {
  return (
    <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'mention') return (
    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/></svg>
    </div>
  );
  if (type === 'task_assigned') return (
    <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
      <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    </div>
  );
  return (
    <div className="w-10 h-10 rounded-2xl bg-stone-500/10 text-stone-500 flex items-center justify-center shrink-0">
      <IconBell />
    </div>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all', {});
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch { }
  }

  async function markOneRead(id: number) {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch { }
  }

  async function deleteNotif(id: number) {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { }
  }

  function handleNotifClick(notif: any) {
    if (!notif.is_read) markOneRead(notif.id);
    if (notif.project_id) {
      if (notif.type === 'mention') {
        router.push(`/projects/${notif.project_id}/chat`);
      } else if (notif.type === 'task_assigned') {
        router.push(`/projects/${notif.project_id}/tasks`);
      } else if (notif.type === 'ai_response') {
        router.push(notif.project_id ? `/projects/${notif.project_id}/ai` : '/wizard');
      } else if (notif.type === 'project_invite') {
        router.push(`/projects/${notif.project_id}`);
      }
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="flex flex-col h-full bg-stone-50 animate-fadeIn">
      {/* Header */}
      <div className="px-6 py-6 bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-stone-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-stone-200">
               <IconBell />
            </div>
            <div>
              <h1 className="text-2xl font-black text-stone-900 tracking-tight uppercase">Notifications</h1>
              <p className="text-stone-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                {unreadCount > 0 ? `${unreadCount} message(s) non lu(s)` : 'Tout est à jour'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button 
              onClick={markAllRead}
              className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-100 transition-colors"
            >
              Tout marquer lu
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-stone-200 border-t-orange-500 rounded-full animate-spin" />
            <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Chargement...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fadeUp">
            <div className="w-20 h-20 bg-white rounded-3xl border border-stone-200 flex items-center justify-center shadow-sm mb-6 text-stone-200">
               <IconBell />
            </div>
            <h3 className="text-stone-900 font-black uppercase tracking-widest">Aucune notification</h3>
            <p className="text-stone-400 text-xs mt-2 max-w-[240px] leading-relaxed">
              Vous recevrez une alerte lors de mentions ou d'assignations de tâches.
            </p>
          </div>
        ) : (
          notifications.map((notif, i) => (
            <div
              key={notif.id}
              onClick={() => handleNotifClick(notif)}
              className={`flex items-start gap-4 p-5 rounded-[2rem] border transition-all animate-fadeUp group relative ${
                notif.is_read 
                  ? 'bg-white border-stone-100 text-stone-600' 
                  : 'bg-white border-orange-200 shadow-lg shadow-orange-500/5 text-stone-900'
              }`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <NotifIcon type={notif.type} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 mb-1">
                  <p className={`text-sm leading-snug ${notif.is_read ? 'font-medium' : 'font-black uppercase tracking-tight'}`}>
                    {notif.title}
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
                    className="p-1.5 text-stone-300 hover:text-red-500 transition-colors shrink-0"
                  >
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </button>
                </div>
                {notif.message && <p className="text-xs text-stone-500 leading-relaxed mb-3 line-clamp-2">{notif.message}</p>}
                
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: fr })}
                  </span>
                  {notif.project_title && (
                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-stone-100 text-stone-400 rounded-md">
                      {notif.project_title}
                    </span>
                  )}
                  {!notif.is_read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
