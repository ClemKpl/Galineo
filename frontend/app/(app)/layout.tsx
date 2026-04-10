'use client';
import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import CreateProjectModal from '@/components/CreateProjectModal';
import AiChat from '@/components/AiChat';
import PricingModal from '@/components/PricingModal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [user, isLoading, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleOpenPricing = () => setShowPricing(true);
    window.addEventListener('open-pricing', handleOpenPricing);
    return () => window.removeEventListener('open-pricing', handleOpenPricing);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-50">
        <div className="flex items-center gap-3 text-stone-400">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-orange-500 rounded-full animate-spin" />
          Chargement...
        </div>
      </div>
    );
  }

  if (!user) return null;

  const mobileTitle = pathname.startsWith('/projects/')
    ? 'Projet'
    : pathname === '/dashboard'
      ? 'Tableau de bord'
      : pathname === '/messages'
        ? 'Discussions'
        : pathname === '/history'
          ? 'Historique'
          : pathname === '/trash'
            ? 'Corbeille'
            : pathname === '/notifications'
      ? 'Notifications'
      : pathname === '/settings'
              ? 'Parametres'
              : 'Galineo';

  return (
    <div className="flex h-dvh min-h-0 bg-stone-50 overflow-hidden">
      <Sidebar
        onNewProject={() => setShowModal(true)}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-700 active:scale-95 transition-transform"
              aria-label="Ouvrir la navigation"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-stone-900 tracking-tight">{mobileTitle}</p>
              <p className="truncate text-[10px] text-stone-400 uppercase font-bold tracking-wider">{user.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-sm active:scale-95 transition-transform shadow-orange-200"
            aria-label="Creer un projet"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </header>

        <main className={`min-h-0 flex-1 overflow-x-hidden ${pathname.includes('/ai') || pathname.includes('/messages') || pathname.includes('/chat') ? 'overflow-hidden pb-0' : 'overflow-y-auto pb-24 lg:pb-0'}`}>
          {children}
        </main>

        <nav className="fixed inset-x-4 bottom-4 z-30 lg:hidden">
          <div className="bg-white/90 backdrop-blur-md border border-stone-200 shadow-xl shadow-stone-200/50 rounded-3xl p-1.5 grid grid-cols-5 gap-1">
            {[
              { href: '/dashboard', label: 'Accueil', icon: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" /> },
              { href: '/messages', label: 'Chats', icon: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" /> },
              { href: '/history', label: 'Historique', icon: <path d="M12 8v5l3 2M22 12A10 10 0 1 1 12 2a9.95 9.95 0 0 1 7 2.9M22 4v6h-6" /> },
              { href: '/trash', label: 'Corbeille', icon: <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0 1 14a1 1 0 0 0 1 .93h8a1 1 0 0 0 1-.93L19 6" /> },
            ].map((item) => {
              const active = pathname === item.href;
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => router.push(item.href)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 transition-all ${active ? 'bg-orange-500 text-white shadow-md shadow-orange-100' : 'text-stone-400 active:bg-stone-50'}`}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                    {item.icon}
                  </svg>
                  <span className="text-[9px] font-bold uppercase tracking-tight">{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-stone-400 active:bg-stone-50 transition-all font-medium"
            >
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
              <span className="text-[9px] font-bold uppercase tracking-tight">Plus</span>
            </button>
          </div>
        </nav>
      </div>

      {showModal && (
        <CreateProjectModal
          onClose={() => setShowModal(false)}
          onCreated={(newId) => {
            setShowModal(false);
            window.dispatchEvent(new Event('project-created'));
            if (newId) router.push(`/projects/${newId}`);
          }}
        />
      )}

      {showPricing && (
        <PricingModal
          onClose={() => setShowPricing(false)}
          currentPlan={user?.plan ?? 'free'}
        />
      )}
    </div>
  );
}
