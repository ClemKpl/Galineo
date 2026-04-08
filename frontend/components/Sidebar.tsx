'use client';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const IconGrid = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
    <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
  </svg>
);
const IconFolder = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
  </svg>
);
const IconPlus = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);
const IconBell = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);
const IconLogout = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
  </svg>
);
const IconSettings = () => (
  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

function NotifIcon({ type }: { type: string }) {
  if (type === 'mention') return (
    <div className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/></svg>
    </div>
  );
  if (type === 'task_assigned') return (
    <div className="w-8 h-8 rounded-full bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full bg-stone-500/15 text-stone-500 flex items-center justify-center shrink-0">
      <IconBell />
    </div>
  );
}

function timeAgo(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "A l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Il y a ${diffD}j`;
}

export default function Sidebar({ onNewProject }: { onNewProject: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.get('/notifications/unread-count');
      setUnreadCount(data.count || 0);
    } catch { }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setNotifsLoading(true);
    try {
      const data = await api.get('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch {
      setNotifications([]);
    } finally {
      setNotifsLoading(false);
    }
  }, []);

  // Poll unread count every 10s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 10000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Load notifications when panel opens
  useEffect(() => {
    if (showNotifs) fetchNotifications();
  }, [showNotifs, fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    }
    if (showNotifs) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotifs]);

  async function markAllRead() {
    try {
      await api.patch('/notifications/read-all', {});
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch { }
  }

  async function markOneRead(id: number) {
    try {
      await api.patch(`/notifications/${id}/read`, {});
      setUnreadCount(c => Math.max(0, c - 1));
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch { }
  }

  async function deleteNotif(id: number) {
    try {
      await api.delete(`/notifications/${id}`);
      const deleted = notifications.find(n => n.id === id);
      if (deleted && !deleted.is_read) setUnreadCount(c => Math.max(0, c - 1));
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
      }
      setShowNotifs(false);
    }
  }

  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [groupByRole, setGroupByRole] = useState(false);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const data = await api.get('/projects');
      setProjects(Array.isArray(data) ? data : []);
    } catch {
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    window.addEventListener('project-created', fetchProjects);
    return () => window.removeEventListener('project-created', fetchProjects);
  }, [fetchProjects]);

  const navItems = [
    { href: '/dashboard', label: 'Tableau de bord', icon: <IconGrid /> },
    { href: '/settings', label: 'Paramètres', icon: <IconSettings /> },
  ];

  const sortedProjects = [...projects].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <aside className="w-64 h-screen bg-stone-900 flex flex-col shrink-0 select-none">
      {/* Logo */}
      <div className="px-5 h-16 flex items-center border-b border-stone-800">
        <span className="text-white font-bold text-lg tracking-tight">Galineo</span>
        <span className="ml-2 text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-md font-medium">v1</span>
      </div>

      {/* User card */}
      <div className="px-3 py-3 border-b border-stone-800">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-stone-800 transition-colors cursor-pointer group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-semibold text-xs shrink-0 shadow-sm">
            {user ? initials(user.name) : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-stone-100 text-sm font-medium truncate leading-tight">{user?.name}</p>
            <p className="text-stone-500 text-xs truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="px-3 py-2.5 border-b border-stone-800 relative" ref={panelRef}>
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${showNotifs ? 'bg-stone-800 text-white' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'}`}
        >
          <div className="relative">
            <IconBell />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold shadow animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-sm font-medium">Notifications</span>
        </button>

        {/* Notification Panel */}
        {showNotifs && (
          <div className="absolute left-full top-0 ml-2 w-96 bg-white rounded-2xl shadow-2xl border border-stone-200 z-[100] overflow-hidden animate-[slideIn_0.2s_ease-out]">
            {/* Panel header */}
            <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Notifications</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">{unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Tout est lu'}</p>
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs font-semibold text-orange-600 hover:text-orange-700 transition-colors px-2 py-1 rounded-lg hover:bg-orange-50">
                  Tout marquer lu
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-stone-100">
              {notifsLoading ? (
                <div className="p-8 text-center">
                  <div className="w-5 h-5 border-2 border-stone-200 border-t-orange-500 rounded-full animate-spin mx-auto"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg width="24" height="24" fill="none" stroke="#a8a29e" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                  </div>
                  <p className="text-sm text-stone-500 font-medium">Aucune notification</p>
                  <p className="text-xs text-stone-400 mt-1">Vous serez notifie lors de mentions ou assignations.</p>
                </div>
              ) : (
                notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors group ${
                      notif.is_read ? 'bg-white hover:bg-stone-50' : 'bg-orange-50/40 hover:bg-orange-50/70'
                    }`}
                    onClick={() => handleNotifClick(notif)}
                  >
                    <NotifIcon type={notif.type} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${notif.is_read ? 'text-stone-600' : 'text-stone-900 font-semibold'}`}>
                          {notif.title}
                        </p>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotif(notif.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 rounded transition-all shrink-0"
                          title="Supprimer"
                        >
                          <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                      {notif.message && <p className="text-xs text-stone-500 mt-0.5 line-clamp-2">{notif.message}</p>}
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-stone-400">{timeAgo(notif.created_at)}</span>
                        {notif.project_title && (
                          <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded font-medium">{notif.project_title}</span>
                        )}
                        {!notif.is_read && <span className="w-2 h-2 rounded-full bg-orange-500"></span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-orange-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'}`}>
              {item.icon}
              {item.label}
            </Link>
          );
        })}

        {/* Projects section */}
        <div className="mt-6 mb-2 px-3 flex items-center justify-between group/title">
          <p className="text-stone-600 text-[10px] font-bold uppercase tracking-[0.2em]">Mes Projets</p>
          <button 
            onClick={() => setGroupByRole(!groupByRole)}
            title={groupByRole ? "Passer en vue liste" : "Grouper par rôle"}
            className="opacity-0 group-hover/title:opacity-100 text-stone-500 hover:text-stone-300 transition-all"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
        </div>

        <div className="space-y-0.5 max-h-[350px] overflow-y-auto pr-1">
          {projectsLoading && projects.length === 0 ? (
            <div className="px-3 py-2 space-y-2">
              <div className="h-3 bg-stone-800 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-stone-800 rounded animate-pulse w-1/2" />
            </div>
          ) : (
            <>
              {groupByRole ? (
                <>
                  {/* Propriétaire */}
                  {projects.filter(p => p.owner_id === user?.id).length > 0 && (
                    <div className="mb-2">
                      <p className="px-3 py-1 text-[9px] font-bold text-stone-500 uppercase tracking-widest">Propriétaire</p>
                      {projects.filter(p => p.owner_id === user?.id).map(p => (
                        <Link key={p.id} href={`/projects/${p.id}`}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${pathname === `/projects/${p.id}` ? 'bg-stone-800 text-orange-400' : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                          <span className="truncate">{p.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {/* Membre */}
                  {projects.filter(p => p.owner_id !== user?.id).length > 0 && (
                    <div>
                      <p className="px-3 py-1 text-[9px] font-bold text-stone-500 uppercase tracking-widest">Invité</p>
                      {projects.filter(p => p.owner_id !== user?.id).map(p => (
                        <Link key={p.id} href={`/projects/${p.id}`}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${pathname === `/projects/${p.id}` ? 'bg-stone-800 text-orange-400' : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-600 shrink-0" />
                          <span className="truncate">{p.title}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                sortedProjects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${pathname === `/projects/${p.id}` ? 'bg-stone-800 text-orange-400' : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'}`}>
                    <IconFolder />
                    <span className="truncate">{p.title}</span>
                  </Link>
                ))
              )}
            </>
          )}
        </div>

        <button onClick={onNewProject}
          className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-500 hover:text-stone-100 hover:bg-stone-800 transition-colors text-sm font-medium w-full text-left border border-dashed border-stone-800 hover:border-stone-700">
          <IconPlus />
          Nouveau projet
        </button>
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 pt-2 border-t border-stone-800">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors text-sm font-medium">
          <IconLogout />
          Déconnexion
        </button>
      </div>

      <style jsx>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </aside>
  );
}
