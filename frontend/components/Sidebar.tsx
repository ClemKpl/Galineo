'use client';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
// Toast est maintenant géré globalement via le contexte
import { useToast } from '@/contexts/ToastContext';
import Logo from './Logo';
// PricingModal est maintenant géré par le layout global via l'événement 'open-pricing'

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
const IconTrash = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6"/>
  </svg>
);
const IconChat = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
  </svg>
);
const IconShield = () => (
  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

function NotifIcon({ type, avatar, name }: { type: string, avatar?: string | null, name?: string }) {
  if (avatar) return (
    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-stone-100 shadow-sm">
      <img src={avatar} alt={name || ''} className="w-full h-full object-cover" />
    </div>
  );

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

export default function Sidebar({ 
  onNewProject, 
  mobileOpen, 
  onCloseMobile 
}: { 
  onNewProject: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifsLoading, setNotifsLoading] = useState(false);
  const { showToast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const notifInitialized = useRef(false);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await api.get('/notifications/unread-count');
      const newCount = data.count || 0;
      setUnreadCount(prev => {
        if (notifInitialized.current && newCount > prev) {
          window.dispatchEvent(new Event('new-notification'));
        }
        notifInitialized.current = true;
        return newCount;
      });
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
      } else if (notif.type === 'ai_response') {
        router.push(notif.project_id ? `/projects/${notif.project_id}/ai` : '/wizard');
      } else if (notif.type === 'project_invite') {
        router.push(`/projects/${notif.project_id}`);
      }
      setShowNotifs(false);
    }
  }

  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [groupByRole, setGroupByRole] = useState(true);

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

  async function handleToggleFavorite(e: React.MouseEvent, projectId: number) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await api.post(`/projects/${projectId}/toggle-favorite`, {});
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, is_favorite: res.is_favorite } : p));
      
      const project = projects.find(p => p.id === projectId);
      if (project) {
        showToast(
          res.is_favorite 
            ? `« ${project.title} » ajouté aux favoris` 
            : `« ${project.title} » retiré des favoris`,
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to toggle favorite', err);
      showToast("Erreur lors de la mise à jour des favoris", "error");
    }
  }

  useEffect(() => {
    fetchProjects();
    
    // Événements globaux pour rafraîchir la liste des projets
    window.addEventListener('project-created', fetchProjects);
    window.addEventListener('project-updated', fetchProjects);
    window.addEventListener('projects-refresh', fetchProjects);
    window.addEventListener('new-notification', fetchProjects); // Utile car une notif peut signaler un retrait d'un projet par ex.

    // Polling de sécurité toutes les 45 secondes (plus léger qu'une notif)
    const interval = setInterval(fetchProjects, 45000);

    return () => {
      window.removeEventListener('project-created', fetchProjects);
      window.removeEventListener('project-updated', fetchProjects);
      window.removeEventListener('projects-refresh', fetchProjects);
      window.removeEventListener('new-notification', fetchProjects);
      clearInterval(interval);
    };
  }, [fetchProjects]);

  const navItems = [
    { href: '/dashboard', label: 'Tableau de bord', icon: <IconGrid />, tourAttr: 'dashboard' },
    { href: '/messages', label: 'Discussions', icon: <IconChat />, tourAttr: 'sidebar-messages' },
    { href: '/history', label: 'Historique', icon: <IconFolder />, tourAttr: undefined },
    { href: '/trash', label: 'Corbeille', icon: <IconTrash />, tourAttr: 'sidebar-trash' },
    ...(user?.plan === 'unlimited' ? [{ href: '/admin', label: 'Panel Admin', icon: <IconShield />, tourAttr: undefined }] : []),
  ];

  const sortedProjects = [...projects].sort((a, b) => 
    (b.is_favorite || 0) - (a.is_favorite || 0) || 
    a.title.localeCompare(b.title)
  );

  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className={`fixed inset-0 bg-stone-950/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onCloseMobile}
      />

      <aside className={`fixed inset-y-0 left-0 w-72 lg:w-64 bg-stone-900 flex flex-col shrink-0 select-none z-50 transition-transform duration-300 transform lg:translate-x-0 lg:static h-full ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo & Close Button */}
        <div className="px-5 h-16 flex items-center justify-between border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <Logo size={22} className="text-orange-500" />
            <span className="text-white font-bold text-lg tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
            {user?.plan === 'unlimited' ? (
              <span className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md">
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.77 3.77z"/>
                </svg>
                Admin
              </span>
              ) : user?.plan === 'premium' ? (
                <span className="flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                  Premium
                </span>
            ) : (
              <span className="text-[10px] bg-stone-700/50 text-stone-400 px-2 py-0.5 rounded-full font-bold border border-stone-700/50">Gratuit</span>
            )}
          </div>
          <button 
            onClick={onCloseMobile}
            className="lg:hidden p-2 text-stone-500 hover:text-white transition-colors"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

      {/* User card */}
      <div className="px-3 py-3 border-b border-stone-800">
        <button
          type="button"
          onClick={() => router.push('/settings')}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-stone-800 transition-colors cursor-pointer group text-left"
        >
          <div className="w-8 h-8 rounded-xl bg-stone-800 border border-stone-700 flex items-center justify-center text-white font-semibold text-xs shrink-0 shadow-sm overflow-hidden">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              user ? initials(user.name) : '?'
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-stone-100 text-sm font-medium truncate leading-tight">{user?.name}</p>
            <p className="text-stone-500 text-xs truncate">{user?.email}</p>
          </div>
        </button>
      </div>

      {/* Notifications */}
      <div className="px-3 py-2.5 border-b border-stone-800 relative" ref={panelRef} data-tour="sidebar-notifications">
        <button
          onClick={() => {
            if (window.innerWidth < 1024) {
              router.push('/notifications');
              if (onCloseMobile) onCloseMobile();
            } else {
              setShowNotifs(!showNotifs);
            }
          }}
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
                    <div className="relative shrink-0">
                      <NotifIcon type={notif.type} avatar={notif.from_user_avatar} name={notif.from_user_name} />
                      {notif.from_user_avatar && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border border-stone-100 flex items-center justify-center text-[7px] shadow-sm">
                           {notif.type === 'mention' ? '🔔' : notif.type === 'task_assigned' ? '✅' : '📁'}
                        </div>
                      )}
                    </div>
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
              {...(item.tourAttr ? { 'data-tour': item.tourAttr } : {})}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${active ? 'bg-orange-500 text-white shadow-sm' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'}`}>
              {item.icon}
              {item.label}
            </Link>
          );
        })}

        {/* Projects section */}
        <div className="mt-6 mb-2 px-3 flex items-center justify-between group/title" data-tour="projects-nav">
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
                      {projects
                        .filter(p => p.owner_id === user?.id)
                        .sort((a, b) => (b.is_favorite || 0) - (a.is_favorite || 0))
                        .map(p => (
                        <Link key={p.id} href={`/projects/${p.id}`}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group/item ${pathname === `/projects/${p.id}` ? 'bg-stone-800 text-orange-400' : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'}`}>
                          <div className="w-5 h-5 rounded-md bg-stone-800 flex items-center justify-center text-[8px] font-bold text-stone-500 overflow-hidden shrink-0 border border-stone-700/50">
                            {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.title[0].toUpperCase()}
                          </div>
                          <span className="truncate flex-1">{p.title}</span>
                          <button 
                            onClick={(e) => handleToggleFavorite(e, p.id)}
                            className={`opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 hover:scale-110 active:scale-95 ${p.is_favorite ? 'opacity-100 text-amber-400' : 'text-stone-600 hover:text-stone-400'}`}
                          >
                            <svg width="14" height="14" fill={p.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                          </button>
                        </Link>
                      ))}
                    </div>
                  )}
                  {/* Membre */}
                  {projects.filter(p => p.owner_id !== user?.id).length > 0 && (
                    <div>
                      <p className="px-3 py-1 text-[9px] font-bold text-stone-500 uppercase tracking-widest">Invité</p>
                      {projects
                        .filter(p => p.owner_id !== user?.id)
                        .sort((a, b) => (b.is_favorite || 0) - (a.is_favorite || 0))
                        .map(p => (
                        <Link key={p.id} href={`/projects/${p.id}`}
                          className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group/item ${pathname === `/projects/${p.id}` ? 'bg-stone-800 text-orange-400' : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'}`}>
                          <div className="w-5 h-5 rounded-md bg-stone-800 flex items-center justify-center text-[8px] font-bold text-stone-500 overflow-hidden shrink-0 border border-stone-700/50">
                            {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.title[0].toUpperCase()}
                          </div>
                          <span className="truncate flex-1">{p.title}</span>
                          <button 
                            onClick={(e) => handleToggleFavorite(e, p.id)}
                            className={`opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 hover:scale-110 active:scale-95 ${p.is_favorite ? 'opacity-100 text-amber-400' : 'text-stone-600 hover:text-stone-400'}`}
                          >
                            <svg width="14" height="14" fill={p.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                          </button>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                sortedProjects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all group/item ${pathname === `/projects/${p.id}` ? 'bg-stone-800 text-orange-400' : 'text-stone-400 hover:text-stone-200 hover:bg-stone-800/50'}`}>
                    <div className="w-5 h-5 rounded-md bg-stone-800 flex items-center justify-center text-[8px] font-bold text-stone-500 overflow-hidden shrink-0 border border-stone-700/50">
                       {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.title[0].toUpperCase()}
                    </div>
                    <span className="truncate flex-1">{p.title}</span>
                    <button 
                      onClick={(e) => handleToggleFavorite(e, p.id)}
                      className={`opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 hover:scale-110 active:scale-95 ${p.is_favorite ? 'opacity-100 text-amber-400' : 'text-stone-600 hover:text-stone-400'}`}
                    >
                      <svg width="14" height="14" fill={p.is_favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                      </svg>
                    </button>
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

      {/* Upgrade CTA + Logout */}
      <div className="px-3 pb-5 pt-2 border-t border-stone-800 space-y-1">
        {(!user?.plan || user?.plan === 'free') && (
          <button
            onClick={() => window.dispatchEvent(new Event('open-pricing'))}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-all text-sm font-bold group active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="group-hover:scale-110 transition-transform font-black"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Passer à Premium
          </button>
        )}
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors text-sm font-medium">
          <IconLogout />
          Déconnexion
        </button>
      </div>

      {/* Le PricingModal a été déplacé dans le layout.tsx pour un affichage global */}

      <style jsx>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 10px; }
      `}</style>
    </aside>
    </>
  );
}
