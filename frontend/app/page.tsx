'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import Link from 'next/link';

/* ── Scroll hook ── */
function useScrolled(threshold = 20) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > threshold);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, [threshold]);
  return scrolled;
}

/* ── Intersection Observer hook ── */
function useInView(options = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setInView(true); obs.disconnect(); }
    }, { threshold: 0.15, ...options });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, inView };
}

/* ── Animated section wrapper ── */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(32px)',
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ── Header ── */
function Header({ user }: { user: any }) {
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = [
    { href: '#fonctionnalites', label: 'Fonctionnalités' },
    { href: '#pour-qui', label: 'Pour qui ?' },
    { href: '#faq', label: 'FAQ' },
  ];
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled ? 'rgba(255,255,255,0.92)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
        boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.05)' : 'none',
      }}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Logo size={22} className="text-orange-500 group-hover:scale-110 transition-transform duration-300" />
          <span className="text-stone-900 font-bold text-lg tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors duration-200 relative group">
              {label}
              <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-orange-500 rounded-full transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5 active:translate-y-0">
              Accéder à l'app →
            </Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors">Se connecter</Link>
              <Link href="/register" className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5">
                Commencer gratuitement
              </Link>
            </>
          )}
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-xl text-stone-600 hover:bg-stone-100 transition-colors">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
            }
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-b border-stone-100 px-6 py-5 flex flex-col gap-4 shadow-xl">
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} className="text-sm font-semibold text-stone-700 hover:text-orange-500 transition-colors">{label}</a>
          ))}
          <div className="flex flex-col gap-2 pt-3 border-t border-stone-100">
            {user ? (
              <Link href="/dashboard" className="py-3 bg-orange-500 text-white text-sm font-bold rounded-xl text-center">Accéder à l'app</Link>
            ) : (
              <>
                <Link href="/login" className="py-3 border border-stone-200 text-stone-700 text-sm font-semibold rounded-xl text-center">Se connecter</Link>
                <Link href="/register" className="py-3 bg-orange-500 text-white text-sm font-bold rounded-xl text-center">Commencer gratuitement</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

/* ── Feature data ── */
const FEATURES = [
  {
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>,
    title: 'Wizard IA',
    desc: "Décrivez votre projet en quelques mots. L'IA génère automatiquement une structure complète avec fonctionnalités, tâches et échéances.",
    gradient: 'from-orange-500 to-rose-500',
    bg: 'bg-orange-50',
  },
  {
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
    title: 'Vues multiples',
    desc: 'Kanban, liste, GANTT ou calendrier : visualisez vos projets dans le format qui vous correspond le mieux.',
    gradient: 'from-blue-500 to-indigo-500',
    bg: 'bg-blue-50',
  },
  {
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>,
    title: 'Galineo Room',
    desc: "Un assistant IA dédié à chaque projet. Il connaît vos tâches, vos membres et peut modifier votre projet en temps réel.",
    gradient: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
  },
  {
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
    title: 'Collaboration',
    desc: 'Invitez votre équipe, assignez des rôles, discutez par projet ou en groupe. Tout le monde reste aligné.',
    gradient: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
  },
  {
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
    title: 'Suivi budgétaire',
    desc: "Gérez les dépenses et revenus de vos projets. Restez toujours dans les clous financiers.",
    gradient: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
  },
  {
    icon: <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>,
    title: 'Tableau de bord',
    desc: "Vue d'ensemble de tous vos projets, tâches assignées et activité récente. Tout en un coup d'œil.",
    gradient: 'from-sky-500 to-blue-600',
    bg: 'bg-sky-50',
  },
];

const FOR_WHO = [
  { emoji: '🎓', title: 'Étudiants & lycéens', desc: "Projets de groupe, exposés, stages. Organisez votre travail d'équipe sans vous perdre dans les emails." },
  { emoji: '🚀', title: 'Startups & freelances', desc: "Lancez vos projets rapidement avec une structure générée par l'IA. Concentrez-vous sur l'exécution." },
  { emoji: '🏢', title: 'PME & équipes', desc: 'Pilotez plusieurs projets en parallèle, gérez votre équipe et suivez les budgets depuis une seule plateforme.' },
  { emoji: '🎨', title: 'Créatifs & agences', desc: 'Briefs, livrables, révisions. Gardez le contrôle sur vos missions client avec des vues adaptées à votre workflow.' },
];

const FAQ_ITEMS = [
  { q: 'Galineo est-il vraiment gratuit ?', r: 'Oui, le plan gratuit est disponible sans carte bancaire. Il vous donne accès aux fonctionnalités essentielles pour démarrer.' },
  { q: 'Comment fonctionne le Wizard IA ?', r: "Décrivez votre projet en langage naturel. L'IA analyse votre demande et génère une structure complète (fonctionnalités, tâches, dates) que vous pouvez personnaliser avant de valider." },
  { q: 'La Galineo Room peut-elle vraiment modifier mes tâches ?', r: "Oui. L'assistant IA de chaque projet connaît l'état complet de votre projet et peut créer, modifier ou réorganiser vos tâches sur demande." },
  { q: 'Puis-je inviter des membres sans compte Galineo ?', r: 'Oui, vous pouvez inviter des collaborateurs par email. Ils recevront un lien pour créer leur compte et rejoindre directement votre projet.' },
  { q: 'Mes données sont-elles sécurisées ?', r: 'Toutes les communications sont chiffrées (HTTPS). Vos données sont stockées de manière sécurisée et ne sont jamais partagées avec des tiers.' },
];

function FaqItem({ q, r }: { q: string; r: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-800/60 last:border-0 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left gap-4 group">
        <span className="font-semibold text-white group-hover:text-orange-400 transition-colors duration-200">{q}</span>
        <span
          className="shrink-0 w-7 h-7 rounded-full bg-stone-800 flex items-center justify-center text-stone-400 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300"
          style={{ transform: open ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease, background 0.2s, color 0.2s' }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </span>
      </button>
      <div
        style={{
          maxHeight: open ? '200px' : '0',
          opacity: open ? 1 : 0,
          transition: 'max-height 0.4s ease, opacity 0.3s ease',
          overflow: 'hidden',
        }}
      >
        <p className="pb-5 text-stone-400 text-sm leading-relaxed">{r}</p>
      </div>
    </div>
  );
}

/* ── Floating orbs animation ── */
function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #f97316, transparent)', animation: 'floatOrb1 8s ease-in-out infinite' }} />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #f97316, transparent)', animation: 'floatOrb2 10s ease-in-out infinite' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5 blur-3xl"
        style={{ background: 'radial-gradient(circle, #fb923c, transparent)', animation: 'floatOrb3 12s ease-in-out infinite' }} />
    </div>
  );
}

/* ── Dot grid background ── */
function DotGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none opacity-[0.035]"
      style={{
        backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    />
  );
}

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const [heroVisible, setHeroVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-950">
        <div className="w-5 h-5 border-2 border-stone-700 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const ctaHref = user ? '/dashboard' : '/register';
  const ctaLabel = user ? 'Accéder à mon espace' : 'Commencer gratuitement';

  return (
    <div className="bg-stone-950 text-white overflow-x-hidden">
      <style>{`
        @keyframes floatOrb1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px, 40px) scale(1.1); } }
        @keyframes floatOrb2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px, -30px) scale(0.9); } }
        @keyframes floatOrb3 { 0%,100% { transform: translate(-50%,-50%) scale(1); } 50% { transform: translate(-50%,-50%) scale(1.05); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes badgePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.4); } 50% { box-shadow: 0 0 0 8px rgba(249,115,22,0); } }
        @keyframes heroFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        .gradient-text {
          background: linear-gradient(135deg, #f97316, #fb923c, #fbbf24, #f97316);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: gradientShift 4s ease infinite;
        }
        .card-glow:hover { box-shadow: 0 0 0 1px rgba(249,115,22,0.3), 0 20px 60px rgba(249,115,22,0.08); }
        .btn-glow:hover { box-shadow: 0 0 30px rgba(249,115,22,0.4), 0 8px 20px rgba(249,115,22,0.3); }
      `}</style>

      <Header user={user} />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-stone-950" />
        <DotGrid />
        <FloatingOrbs />

        {/* Grid lines decoration */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '80px 80px',
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
              transition: 'opacity 0.8s ease, transform 0.8s ease',
              animation: heroVisible ? 'badgePulse 3s ease-in-out 1s infinite' : 'none',
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-sm font-medium mb-8"
          >
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Propulsé par l'intelligence artificielle
          </div>

          {/* Wordmark */}
          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s',
            }}
          >
            <div className="flex items-center justify-center gap-4 mb-3">
              <Logo size={52} className="text-orange-500" style={{ animation: 'heroFloat 4s ease-in-out infinite' }} />
              <span className="text-6xl md:text-8xl font-bold tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
            </div>
          </div>

          {/* Tagline */}
          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease 0.3s, transform 0.8s ease 0.3s',
            }}
          >
            <h1 className="text-3xl md:text-5xl font-black leading-tight tracking-tight mb-6" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              De l'idée au projet <span className="gradient-text">structuré</span>,<br />
              en quelques secondes.
            </h1>
          </div>

          {/* Description */}
          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease 0.45s, transform 0.8s ease 0.45s',
            }}
          >
            <p className="text-lg text-stone-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Galineo combine la gestion de projet collaborative avec une IA qui comprend, organise et fait évoluer vos projets à votre place.
            </p>
          </div>

          {/* CTAs */}
          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transform: heroVisible ? 'translateY(0)' : 'translateY(30px)',
              transition: 'opacity 0.8s ease 0.6s, transform 0.8s ease 0.6s',
            }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href={ctaHref}
              className="btn-glow relative px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-lg transition-all duration-300 hover:-translate-y-1 active:translate-y-0 overflow-hidden group"
            >
              <span className="relative z-10">{ctaLabel} →</span>
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Link>
            {!user && (
              <Link href="/login" className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold rounded-2xl text-lg transition-all duration-300 hover:-translate-y-1 backdrop-blur-sm">
                Se connecter
              </Link>
            )}
          </div>

          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transition: 'opacity 0.8s ease 0.75s',
            }}
          >
            <p className="mt-5 text-sm text-stone-600">Gratuit sans carte bancaire · Aucun engagement</p>
          </div>

          {/* Scroll indicator */}
          <div
            style={{
              opacity: heroVisible ? 1 : 0,
              transition: 'opacity 0.8s ease 1.2s',
              animation: heroVisible ? 'floatOrb2 2s ease-in-out infinite' : 'none',
            }}
            className="mt-20 flex flex-col items-center gap-2"
          >
            <span className="text-xs text-stone-600 font-medium uppercase tracking-widest">Découvrir</span>
            <div className="w-px h-12 bg-gradient-to-b from-stone-600 to-transparent" />
          </div>
        </div>
      </section>

      {/* ── Stats band ── */}
      <section className="relative border-y border-stone-800/50 bg-stone-900/50 backdrop-blur-sm py-10 px-6 overflow-hidden">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-4 divide-x divide-stone-800">
          {[
            { value: '100%', label: 'Propulsé par IA' },
            { value: '5 vues', label: 'Kanban, Liste, GANTT…' },
            { value: '< 2 min', label: 'Pour créer un projet' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 100} className="text-center px-4">
              <div className="text-3xl font-black gradient-text mb-1" style={{ fontFamily: "'Archivo Black', sans-serif" }}>{s.value}</div>
              <div className="text-xs text-stone-500 font-medium uppercase tracking-wider">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section id="fonctionnalites" className="py-28 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-5 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-4">Fonctionnalités</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              Tout ce dont votre équipe a besoin
            </h2>
            <p className="mt-4 text-stone-400 text-lg max-w-2xl mx-auto">Une plateforme complète qui élimine la friction entre l'idée et l'exécution.</p>
          </Reveal>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 80}>
                <div className="card-glow group relative p-6 rounded-2xl border border-stone-800 bg-stone-900 hover:bg-stone-800/70 transition-all duration-300 hover:-translate-y-1 cursor-default overflow-hidden">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: `radial-gradient(circle at top left, ${f.gradient.includes('orange') ? 'rgba(249,115,22,0.06)' : f.gradient.includes('blue') ? 'rgba(59,130,246,0.06)' : f.gradient.includes('violet') ? 'rgba(139,92,246,0.06)' : f.gradient.includes('emerald') ? 'rgba(16,185,129,0.06)' : 'rgba(249,115,22,0.06)'}, transparent)` }} />
                  <div className={`w-11 h-11 rounded-xl ${f.bg} flex items-center justify-center mb-4 bg-gradient-to-br ${f.gradient} p-0.5 group-hover:scale-110 transition-transform duration-300`}>
                    <div className="w-full h-full rounded-[10px] bg-stone-900 flex items-center justify-center">
                      <span className={`bg-gradient-to-br ${f.gradient} bg-clip-text`} style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        {f.icon}
                      </span>
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-white mb-2 group-hover:text-orange-400 transition-colors duration-200">{f.title}</h3>
                  <p className="text-stone-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pour qui ── */}
      <section id="pour-qui" className="py-28 px-6 bg-stone-900/30 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-5 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f97316, transparent)' }} />
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-4">Pour qui ?</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              Fait pour vous,<br />quelle que soit votre équipe
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FOR_WHO.map((item, i) => (
              <Reveal key={item.title} delay={i * 100}>
                <div className="card-glow group p-6 rounded-2xl border border-stone-800 bg-stone-900 hover:bg-stone-800/70 transition-all duration-300 hover:-translate-y-2 cursor-default">
                  <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform duration-300 inline-block">{item.emoji}</span>
                  <h3 className="font-bold text-white mb-2 group-hover:text-orange-400 transition-colors duration-200">{item.title}</h3>
                  <p className="text-stone-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-24 px-6 relative overflow-hidden">
        <Reveal>
          <div className="max-w-4xl mx-auto relative rounded-3xl overflow-hidden">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #ea580c, #f97316, #fb923c)', backgroundSize: '200% 200%', animation: 'gradientShift 5s ease infinite' }} />
            <div className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="relative px-8 py-16 text-center">
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
                Prêt à transformer votre façon de travailler ?
              </h2>
              <p className="text-orange-100/90 mb-8 text-lg max-w-xl mx-auto">
                Rejoignez Galinéo et créez votre premier projet structuré par l'IA en moins de 2 minutes.
              </p>
              <Link
                href={ctaHref}
                className="inline-block px-8 py-4 bg-white hover:bg-orange-50 text-orange-600 font-bold rounded-2xl text-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-900/40"
              >
                {ctaLabel} →
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-28 px-6 relative overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <Reveal className="text-center mb-16">
            <p className="text-orange-500 font-bold uppercase tracking-widest text-xs mb-4">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
              Questions fréquentes
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="rounded-2xl border border-stone-800 bg-stone-900/60 backdrop-blur-sm px-8 divide-y divide-stone-800/60">
              {FAQ_ITEMS.map((item) => <FaqItem key={item.q} q={item.q} r={item.r} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-28 px-6 relative overflow-hidden">
        <FloatingOrbs />
        <DotGrid />
        <Reveal className="relative max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-3xl bg-orange-500/10 border border-orange-500/20" style={{ animation: 'badgePulse 3s ease-in-out infinite' }}>
              <Logo size={44} className="text-orange-500" />
            </div>
          </div>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-white" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
            Commencez<br /><span className="gradient-text">dès maintenant</span>
          </h2>
          <p className="text-stone-400 text-lg mb-10">De l'idée au projet structuré, en quelques secondes.</p>
          <Link
            href={ctaHref}
            className="btn-glow inline-block px-12 py-5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-xl transition-all duration-300 hover:-translate-y-1 active:translate-y-0"
          >
            {ctaLabel} →
          </Link>
          <p className="mt-5 text-sm text-stone-600">Gratuit sans carte bancaire</p>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-800/60 py-10 px-6 bg-stone-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Logo size={20} className="text-orange-500 group-hover:scale-110 transition-transform" />
            <span className="font-bold text-white tracking-tight" style={{ fontFamily: "'Archivo Black', sans-serif" }}>GALINÉO</span>
          </Link>
          <div className="flex items-center gap-6 text-sm text-stone-500">
            <Link href="/legal/mentions-legales" className="hover:text-stone-300 transition-colors">Mentions légales</Link>
            <Link href="/legal/cgu" className="hover:text-stone-300 transition-colors">CGU</Link>
            <Link href="/legal/confidentialite" className="hover:text-stone-300 transition-colors">Confidentialité</Link>
          </div>
          <p className="text-sm text-stone-600">© {new Date().getFullYear()} Galinéo. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
