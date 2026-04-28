'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import Link from 'next/link';

function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [threshold]);
  return scrolled;
}

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { threshold: 0.12 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div ref={ref} className={className} style={{ opacity: inView ? 1 : 0, transform: inView ? 'translateY(0)' : 'translateY(24px)', transition: `opacity 0.65s cubic-bezier(.22,1,.36,1) ${delay}ms, transform 0.65s cubic-bezier(.22,1,.36,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

function Header({ user }: { user: any }) {
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = [
    { href: '#fonctionnalites', label: 'Fonctionnalités' },
    { href: '#pour-qui', label: 'Pour qui ?' },
    { href: '#faq', label: 'FAQ' },
  ];
  return (
    <header className="fixed top-0 inset-x-0 z-50 transition-all duration-300" style={{
      background: scrolled ? 'rgba(255,255,255,0.9)' : 'transparent',
      backdropFilter: scrolled ? 'blur(16px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(231,229,228,0.8)' : '1px solid transparent',
    }}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Logo size={20} className="text-orange-500" />
          <span className="font-bold tracking-tight text-stone-900" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
        </Link>
        <nav className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">{l.label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="px-4 py-2 bg-stone-900 hover:bg-stone-700 text-white text-sm font-semibold rounded-lg transition-colors">Accéder à l'app →</Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">Se connecter</Link>
              <Link href="/register" className="px-4 py-2 bg-stone-900 hover:bg-stone-700 text-white text-sm font-semibold rounded-lg transition-colors">Commencer gratuitement</Link>
            </>
          )}
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors">
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-white border-t border-stone-100 px-6 py-4 flex flex-col gap-3">
          {links.map(l => <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="text-sm font-medium text-stone-700">{l.label}</a>)}
          <div className="pt-3 border-t border-stone-100 flex flex-col gap-2">
            {user ? (
              <Link href="/dashboard" className="py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-lg text-center">Accéder à l'app</Link>
            ) : (
              <>
                <Link href="/login" className="py-2.5 border border-stone-200 text-stone-700 text-sm font-semibold rounded-lg text-center">Se connecter</Link>
                <Link href="/register" className="py-2.5 bg-stone-900 text-white text-sm font-semibold rounded-lg text-center">Commencer gratuitement</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

const FEATURES = [
  { icon: '✦', title: 'Wizard IA', desc: "Décrivez votre projet en langage naturel. L'IA génère automatiquement une structure complète : fonctionnalités, tâches, échéances.", badge: 'Essai gratuit inclus' },
  { icon: '⊞', title: 'Vues multiples', desc: 'Kanban, liste, GANTT ou calendrier. Basculez entre les vues en un clic selon votre mode de travail.', badge: null },
  { icon: '◎', title: 'Galineo Room', desc: "Un assistant IA dédié à chaque projet. Il connaît vos tâches et peut modifier votre projet en temps réel.", badge: 'Essai gratuit inclus' },
  { icon: '⬡', title: 'Collaboration', desc: 'Invitez votre équipe, assignez des rôles et discutez par projet. Tout le monde reste aligné.', badge: null },
  { icon: '◈', title: 'Suivi budgétaire', desc: "Gérez les dépenses et revenus de vos projets. Restez dans les clous financiers sans effort.", badge: null },
  { icon: '▦', title: 'Tableau de bord', desc: "Vue d'ensemble de vos projets, tâches assignées et activité récente en un coup d'œil.", badge: null },
];

const FOR_WHO = [
  { label: '01', title: 'Étudiants & lycéens', desc: "Projets de groupe, exposés, stages. Organisez votre travail d'équipe sans vous perdre dans les emails." },
  { label: '02', title: 'Startups & freelances', desc: "Lancez vos projets rapidement avec une structure IA. Concentrez-vous sur l'exécution, pas sur l'organisation." },
  { label: '03', title: 'PME & équipes', desc: 'Pilotez plusieurs projets en parallèle, gérez votre équipe et suivez les budgets depuis une seule plateforme.' },
  { label: '04', title: 'Créatifs & agences', desc: 'Briefs, livrables, révisions. Gardez le contrôle sur vos missions client avec des vues adaptées à votre workflow.' },
];

const FAQ_ITEMS = [
  { q: 'Galineo est-il vraiment gratuit ?', r: 'Oui, le plan gratuit est disponible sans carte bancaire. Il vous donne accès aux fonctionnalités essentielles pour démarrer.' },
  { q: 'Comment fonctionne le Wizard IA ?', r: "Décrivez votre projet en langage naturel. L'IA génère une structure complète (fonctionnalités, tâches, dates) que vous personnalisez avant de valider." },
  { q: 'La Galineo Room peut-elle modifier mes tâches ?', r: "Oui. L'assistant IA connaît l'état complet de votre projet et peut créer, modifier ou réorganiser vos tâches sur demande." },
  { q: 'Puis-je inviter des membres sans compte Galineo ?', r: 'Oui, par email. Ils reçoivent un lien pour créer leur compte et rejoindre directement votre projet.' },
  { q: "L'IA est-elle vraiment gratuite ?", r: "L'accès à l'IA (Wizard et Galineo Room) inclut un nombre de requêtes offertes à l'inscription pour tester sans engagement. Au-delà, les fonctionnalités IA nécessitent un abonnement payant." },
  { q: 'Mes données sont-elles sécurisées ?', r: 'Toutes les communications sont chiffrées (HTTPS). Vos données ne sont jamais partagées avec des tiers.' },
];

function FaqItem({ q, r, index }: { q: string; r: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-5 border-b border-stone-100 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-start justify-between gap-6 text-left group">
        <div className="flex items-start gap-4">
          <span className="text-xs font-bold text-stone-300 mt-0.5 tabular-nums w-5 shrink-0">{String(index + 1).padStart(2, '0')}</span>
          <span className="font-semibold text-stone-800 group-hover:text-stone-900 transition-colors text-sm leading-relaxed">{q}</span>
        </div>
        <span className="shrink-0 mt-0.5 text-stone-400 transition-transform duration-300" style={{ transform: open ? 'rotate(45deg)' : 'rotate(0)' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
      </button>
      <div style={{ maxHeight: open ? '200px' : '0', opacity: open ? 1 : 0, overflow: 'hidden', transition: 'max-height 0.4s ease, opacity 0.3s ease' }}>
        <p className="mt-3 ml-9 text-sm text-stone-500 leading-relaxed">{r}</p>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen bg-white">
      <div className="w-4 h-4 border-2 border-stone-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  const cta = { href: user ? '/dashboard' : '/register', label: user ? 'Accéder à mon espace' : 'Commencer gratuitement' };

  return (
    <div className="bg-white text-stone-900 overflow-x-hidden">
      <style>{`
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
      `}</style>

      <Header user={user} />

      {/* ── HERO ── */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full" style={{ background: 'radial-gradient(circle at 60% 40%, rgba(251,146,60,0.07) 0%, transparent 70%)' }} />
          <div className="absolute top-1/2 -left-40 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(231,229,228,0.5) 0%, transparent 70%)' }} />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="max-w-3xl">
            {/* Tag */}
            <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transition: 'all 0.6s ease' }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-stone-500 uppercase tracking-widest mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Gestion de projets propulsée par l'IA
            </div>

            {/* Headline */}
            <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.1s' }}>
              <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6 text-stone-900" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                De l'idée au projet<br />
                <span className="relative inline-block">
                  <span className="relative z-10 text-orange-500">structuré</span>
                  <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 12" fill="none" preserveAspectRatio="none" style={{ height: '8px' }}>
                    <path d="M0 8 Q75 2 150 8 Q225 14 300 8" stroke="var(--accent-500)" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.5"/>
                  </svg>
                </span>
                ,<br />en quelques secondes.
              </h1>
            </div>

            {/* Sub */}
            <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.2s' }}>
              <p className="text-lg text-stone-500 max-w-xl leading-relaxed mb-10">
                Galinéo combine la gestion de projet collaborative avec une IA qui comprend, organise et fait évoluer vos projets à votre place.
              </p>
            </div>

            {/* CTAs */}
            <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.3s' }}
              className="flex flex-wrap items-center gap-4">
              <Link href={cta.href} className="group inline-flex items-center gap-2 px-6 py-3.5 bg-stone-900 hover:bg-stone-700 text-white font-semibold rounded-xl transition-all duration-200 text-sm">
                {cta.label}
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="group-hover:translate-x-0.5 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </Link>
              {!user && (
                <Link href="/login" className="inline-flex items-center gap-2 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">
                  Déjà un compte ? Se connecter
                </Link>
              )}
            </div>

            <div style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease 0.45s' }}
              className="mt-6 flex items-center gap-5">
              {[
                { icon: '✓', text: 'Gratuit sans carte bancaire' },
                { icon: '✓', text: 'Essai IA inclus' },
                { icon: '✓', text: 'Aucun engagement' },
              ].map(item => (
                <span key={item.text} className="flex items-center gap-1.5 text-xs text-stone-400 font-medium">
                  <span className="text-orange-500 font-bold">{item.icon}</span>
                  {item.text}
                </span>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ── MARQUEE LOGOS (social proof placeholder) ── */}
      <div className="border-y border-stone-100 py-4 overflow-hidden bg-stone-50/60">
        <div className="flex items-center gap-12 whitespace-nowrap" style={{ animation: 'marquee 20s linear infinite', width: 'max-content' }}>
          {[...Array(2)].map((_, di) => (
            <div key={di} className="flex items-center gap-12">
              {['Étudiants', 'Startups', 'PME', 'Freelances', 'Agences créatives', 'Équipes produit', 'Développeurs'].map(label => (
                <span key={label} className="text-xs font-semibold text-stone-400 uppercase tracking-widest">{label}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section id="fonctionnalites" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal className="mb-16">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Fonctionnalités</p>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                Tout ce dont<br />votre équipe a besoin
              </h2>
              <p className="text-stone-500 max-w-xs text-sm leading-relaxed">Une plateforme complète qui élimine la friction entre l'idée et l'exécution.</p>
            </div>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-stone-100 rounded-2xl overflow-hidden border border-stone-100">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="bg-white p-7 hover:bg-stone-50 transition-colors duration-200 group h-full flex flex-col">
                  <div className="text-2xl text-orange-400 group-hover:text-orange-500 transition-colors duration-300 mb-5 font-light">{f.icon}</div>
                  <h3 className="font-bold text-stone-900 mb-2 text-base">{f.title}</h3>
                  <p className="text-stone-500 text-sm leading-relaxed">{f.desc}</p>
                  {f.badge && (
                    <span className="mt-4 self-start inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-orange-500 bg-orange-50 px-2 py-1 rounded-md">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      {f.badge}
                    </span>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOR WHO ── */}
      <section id="pour-qui" className="py-28 px-6 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <Reveal className="mb-16 text-center">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">Pour qui ?</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              Fait pour vous
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FOR_WHO.map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <div className="group bg-white rounded-2xl p-7 border border-stone-100 hover:border-stone-200 hover:shadow-[0_4px_24px_rgba(0,0,0,0.06)] transition-all duration-300 flex gap-5">
                  <span className="text-xs font-bold text-stone-300 tabular-nums mt-1 shrink-0">{item.label}</span>
                  <div>
                    <h3 className="font-bold text-stone-900 mb-2 group-hover:text-stone-700 transition-colors">{item.title}</h3>
                    <p className="text-stone-500 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section className="py-20 px-6">
        <Reveal>
          <div className="max-w-6xl mx-auto">
            <div className="bg-stone-900 rounded-3xl px-10 py-14 flex flex-col md:flex-row items-center justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Logo size={18} className="text-orange-500" />
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-widest" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white leading-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                  Prêt à transformer<br />votre façon de travailler ?
                </h2>
                <p className="text-stone-400 mt-3 text-sm max-w-md">Créez votre premier projet structuré par l'IA en moins de 2 minutes.</p>
              </div>
              <div className="shrink-0 flex flex-col items-center gap-3">
                <Link href={cta.href} className="group inline-flex items-center gap-2 px-7 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all duration-200 text-sm whitespace-nowrap">
                  {cta.label}
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="group-hover:translate-x-0.5 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                </Link>
                <span className="text-xs text-stone-600">Gratuit · Essai IA inclus · Sans engagement</span>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28 px-6 bg-stone-50">
        <div className="max-w-3xl mx-auto">
          <Reveal className="mb-12">
            <p className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-3">FAQ</p>
            <h2 className="text-4xl font-black tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>Questions fréquentes</h2>
          </Reveal>
          <Reveal delay={80}>
            <div className="bg-white rounded-2xl border border-stone-100 px-8">
              {FAQ_ITEMS.map((item, i) => <FaqItem key={item.q} q={item.q} r={item.r} index={i} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.08) 0%, transparent 70%)' }} />
        <Reveal className="relative max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 mb-8">
            <Logo size={28} className="text-orange-500" />
          </div>
          <h2 className="text-5xl md:text-6xl font-black tracking-tight mb-5 leading-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            Commencez<br />dès maintenant
          </h2>
          <p className="text-stone-500 text-lg mb-10">De l'idée au projet structuré, en quelques secondes.</p>
          <Link href={cta.href} className="group inline-flex items-center gap-2 px-8 py-4 bg-stone-900 hover:bg-stone-700 text-white font-bold rounded-xl transition-all duration-200">
            {cta.label}
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" className="group-hover:translate-x-0.5 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
          <p className="mt-4 text-xs text-stone-400">Gratuit sans carte bancaire</p>
        </Reveal>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-stone-100 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={16} className="text-orange-500" />
            <span className="text-sm font-bold text-stone-700 tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
          </Link>
          <div className="flex items-center gap-5 text-xs text-stone-400">
            <Link href="/legal/mentions-legales" className="hover:text-stone-700 transition-colors">Mentions légales</Link>
            <Link href="/legal/cgu" className="hover:text-stone-700 transition-colors">CGU</Link>
            <Link href="/legal/confidentialite" className="hover:text-stone-700 transition-colors">Confidentialité</Link>
          </div>
          <p className="text-xs text-stone-400">© {new Date().getFullYear()} Galinéo</p>
        </div>
      </footer>
    </div>
  );
}
