import Link from 'next/link';
import Logo from '@/components/Logo';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shadow shadow-orange-500/20 group-hover:bg-orange-600 transition-colors">
              <Logo size={18} className="text-white" />
            </div>
            <span className="font-black text-stone-900 uppercase tracking-tight text-lg" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-semibold text-stone-500">
            <Link href="/legal/mentions-legales" className="hover:text-stone-900 transition-colors">Mentions légales</Link>
            <Link href="/legal/cgu" className="hover:text-stone-900 transition-colors">CGU</Link>
            <Link href="/legal/confidentialite" className="hover:text-stone-900 transition-colors">Confidentialité</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {children}
      </main>

      <footer className="border-t border-stone-200 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-stone-400">
          <span>© {new Date().getFullYear()} Galinéo. Tous droits réservés.</span>
          <div className="flex gap-4">
            <Link href="/legal/mentions-legales" className="hover:text-stone-600 transition-colors">Mentions légales</Link>
            <Link href="/legal/cgu" className="hover:text-stone-600 transition-colors">CGU</Link>
            <Link href="/legal/confidentialite" className="hover:text-stone-600 transition-colors">Confidentialité</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
