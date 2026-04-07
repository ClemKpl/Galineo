'use client';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

export default function Sidebar({ onNewProject }: { onNewProject: () => void }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard', label: 'Tableau de bord', icon: <IconGrid /> },
    { href: '/settings', label: 'Paramètres', icon: <IconSettings /> },
  ];

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
      <div className="px-3 py-2.5 border-b border-stone-800">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors">
          <div className="relative">
            <IconBell />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold shadow">3</span>
          </div>
          <span className="text-sm font-medium">Notifications</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 flex flex-col gap-0.5 overflow-y-auto">
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
        <div className="mt-5 mb-2 px-3">
          <p className="text-stone-600 text-xs font-semibold uppercase tracking-wider">Projets</p>
        </div>

        <Link href="/dashboard"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${pathname === '/dashboard' ? 'text-stone-200 bg-stone-800' : 'text-stone-400 hover:text-stone-100 hover:bg-stone-800'}`}>
          <IconFolder />
          Mes projets
        </Link>

        <button onClick={onNewProject}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-colors text-sm font-medium w-full text-left">
          <IconPlus />
          Nouveau projet
        </button>

        {/* Espace extensible pour futures sections */}
        <div className="flex-1 min-h-8" />
      </nav>

      {/* Logout */}
      <div className="px-3 pb-5 pt-2 border-t border-stone-800">
        <button onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors text-sm font-medium">
          <IconLogout />
          Déconnexion
        </button>
      </div>
    </aside>
  );
}
