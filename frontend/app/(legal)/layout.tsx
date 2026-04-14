import Link from 'next/link';
import Logo from '@/components/Logo';

const NAV_LINKS = [
  { href: '/legal/mentions-legales', label: 'Mentions légales' },
  { href: '/legal/cgu',              label: 'CGU' },
  { href: '/legal/confidentialite',  label: 'Confidentialité' },
  { href: '/legal/mes-donnees',      label: 'Mes données' },
];

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group w-fit">
            <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shadow shadow-orange-500/20 group-hover:bg-orange-600 transition-colors">
              <Logo size={18} className="text-white" />
            </div>
            <span className="font-black text-stone-900 uppercase tracking-tight text-lg" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
          </Link>
          <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-semibold text-stone-500 overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="hover:text-stone-900 transition-colors whitespace-nowrap">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {children}
      </main>

      <footer className="border-t border-stone-200 mt-12 sm:mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between text-xs text-stone-400">
          <span>© {new Date().getFullYear()} Galinéo. Tous droits réservés.</span>
          <div className="flex flex-wrap gap-3 sm:gap-4">
            {NAV_LINKS.map(l => (
              <Link key={l.href} href={l.href} className="hover:text-stone-600 transition-colors">
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
