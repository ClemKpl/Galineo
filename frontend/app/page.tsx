'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';
import Link from 'next/link';

function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return scrolled;
}

function Header({ user }: { user: any }) {
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const navLinks = [
    { href: '#fonctionnalites', label: 'Fonctionnalités' },
    { href: '#pour-qui', label: 'Pour qui ?' },
    { href: '#tarifs', label: 'Tarifs' },
    { href: '#faq', label: 'FAQ' },
  ];
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-stone-100' : 'bg-transparent'}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={28} className="text-orange-500" />
          <span className="font-black text-xl text-stone-900" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Galineo</span>
        </div>
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">{label}</a>
          ))}
        </nav>
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <Link href="/dashboard" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">Accéder à l'app</Link>
          ) : (
            <>
              <Link href="/login" className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Se connecter</Link>
              <Link href="/register" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-xl transition-colors">Commencer gratuitement</Link>
            </>
          )}
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-lg text-stone-600 hover:bg-stone-100">
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            {menuOpen
              ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
              : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
            }
          </svg>
        </button>
      </div>
      {menuOpen && (
        <div className="md:hidden bg-white border-b border-stone-100 px-6 py-4 flex flex-col gap-4">
          {navLinks.map(({ href, label }) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} className="text-sm font-medium text-stone-700">{label}</a>
          ))}
          <div className="flex flex-col gap-2 pt-2 border-t border-stone-100">
            {user ? (
              <Link href="/dashboard" className="px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl text-center">Accéder à l'app</Link>
            ) : (
              <>
                <Link href="/login" className="px-4 py-2.5 border border-stone-200 text-stone-700 text-sm font-semibold rounded-xl text-center">Se connecter</Link>
                <Link href="/register" className="px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl text-center">Commencer gratuitement</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

const FEATURES = [
  {
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    title: 'Wizard IA',
    desc: "Décrivez votre projet en quelques mots. L'IA génère automatiquement une structure complète avec fonctionnalités, tâches et échéances.",
  },
  {
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    title: 'Vues multiples',
    desc: 'Kanban, liste, GANTT ou calendrier : visualisez vos projets dans le format qui vous correspond le mieux.',
  },
  {
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    title: 'Galineo Room',
    desc: "Un assistant IA dédié à chaque projet. Il connaît vos tâches, vos membres et peut modifier votre projet en temps réel.",
  },
  {
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    title: 'Collaboration en temps réel',
    desc: 'Invitez votre équipe, assignez des rôles, discutez par projet ou en groupe. Tout le monde reste aligné.',
  },
  {
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    title: 'Suivi budgétaire',
    desc: "Gérez les dépenses et revenus de vos projets. L'IA vous alerte proactivement quand le budget approche de ses limites.",
  },
  {
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>,
    title: 'Tableau de bord',
    desc: "Vue d'ensemble de tous vos projets, tâches assignées, événements à venir et activité récente. Tout en un coup d'œil.",
  },
];

const FOR_WHO = [
  { emoji: '🎓', title: 'Étudiants & lycéens', desc: "Projets de groupe, exposés, stages. Organisez votre travail d'équipe sans vous perdre dans les emails." },
  { emoji: '🚀', title: 'Startups & freelances', desc: "Lancez vos projets rapidement avec une structure générée par l'IA. Concentrez-vous sur l'exécution, pas sur l'organisation." },
  { emoji: '🏢', title: 'PME & équipes', desc: 'Pilotez plusieurs projets en parallèle, gérez votre équipe et suivez les budgets depuis une seule plateforme.' },
  { emoji: '🎨', title: 'Créatifs & agences', desc: 'Briefs, livrables, révisions. Gardez le contrôle sur vos missions client avec des vues adaptées à votre workflow.' },
];

const PLANS = [
  {
    name: 'Gratuit', price: '0€', period: 'pour toujours', color: 'border-stone-200', badge: null,
    features: ['1 projet actif', "Jusqu'à 25 tâches par projet", 'Wizard IA (limité)', 'Galineo Room', "Collaboration jusqu'à 3 membres", 'Vues Kanban & Liste'],
  },
  {
    name: 'Premium', price: '7€', period: 'par mois', color: 'border-orange-400 ring-2 ring-orange-200', badge: 'Populaire',
    features: ['Projets illimités', 'Tâches illimitées', 'Wizard IA complet', 'Galineo Room avancée', 'Membres illimités', 'Toutes les vues (GANTT, Calendrier)', 'Suivi budgétaire', 'Support prioritaire'],
  },
  {
    name: 'Unlimited', price: '15€', period: 'par mois', color: 'border-stone-200', badge: null,
    features: ['Tout Premium', 'IA sans limites de quota', 'Export CSV / PDF', 'Accès API', 'Support dédié'],
  },
];

const FAQ_ITEMS = [
  { q: 'Galineo est-il vraiment gratuit ?', r: 'Oui, le plan gratuit est disponible sans carte bancaire. Il vous donne accès aux fonctionnalités essentielles pour démarrer.' },
  { q: 'Comment fonctionne le Wizard IA ?', r: "Décrivez votre projet en langage naturel. L'IA analyse votre demande et génère une structure complète (fonctionnalités, tâches, dates) que vous pouvez personnaliser avant de valider." },
  { q: 'La Galineo Room peut-elle vraiment modifier mes tâches ?', r: "Oui. L'assistant IA de chaque projet connaît l'état complet de votre projet et peut créer, modifier ou réorganiser vos tâches sur demande, avec votre confirmation." },
  { q: 'Puis-je inviter des membres sans compte Galineo ?', r: 'Oui, vous pouvez inviter des collaborateurs par email. Ils recevront un lien pour créer leur compte et rejoindre directement votre projet.' },
  { q: 'Mes données sont-elles sécurisées ?', r: 'Toutes les communications sont chiffrées (HTTPS). Vos données de projet sont stockées de manière sécurisée et ne sont jamais partagées avec des tiers.' },
  { q: 'Puis-je annuler mon abonnement à tout moment ?', r: 'Absolument. Aucun engagement. Vous pouvez annuler votre abonnement à tout moment depuis vos paramètres.' },
];

function FaqItem({ q, r }: { q: string; r: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100 last:border-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left gap-4">
        <span className="font-semibold text-stone-800">{q}</span>
        <span className={`shrink-0 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </span>
      </button>
      {open && <p className="pb-5 text-stone-500 text-sm leading-relaxed">{r}</p>}
    </div>
  );
}

export default function LandingPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-50">
        <div className="w-5 h-5 border-2 border-stone-300 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const ctaHref = user ? '/dashboard' : '/register';
  const ctaLabel = user ? "Accéder à mon espace" : 'Commencer gratuitement';

  return (
    <div className="bg-white text-stone-900 overflow-x-hidden">
      <Header user={user} />

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center px-6 pt-24 pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-white to-stone-50 pointer-events-none" />
        <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-orange-100/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-stone-100/60 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-50 border border-orange-100 rounded-full text-orange-600 text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            Propulsé par l'intelligence artificielle
          </div>
          <h1 className="text-5xl md:text-7xl font-black leading-tight tracking-tight mb-6" style={{ fontFamily: 'Archivo Black, sans-serif' }}>
            De l'idée au projet<br /><span className="text-orange-500">structuré</span>,<br />en quelques secondes.
          </h1>
          <p className="text-xl text-stone-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            Galineo combine la gestion de projet collaborative avec une IA qui comprend, organise et fait évoluer vos projets à votre place.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={ctaHref} className="px-8 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-lg transition-all shadow-lg shadow-orange-200 hover:shadow-orange-300 hover:-translate-y-0.5">
              {ctaLabel}
            </Link>
            {!user && (
              <Link href="/login" className="px-8 py-4 bg-white border border-stone-200 hover:border-stone-300 text-stone-700 font-semibold rounded-2xl text-lg transition-all hover:-translate-y-0.5">
                Se connecter
              </Link>
            )}
          </div>
          <p className="mt-4 text-sm text-stone-400">Gratuit sans carte bancaire · Aucun engagement</p>

          {/* App mockup */}
          <div className="mt-16">
            <div className="bg-white rounded-3xl border border-stone-200 shadow-2xl shadow-stone-200/60 overflow-hidden max-w-3xl mx-auto">
              <div className="bg-stone-50 border-b border-stone-100 px-4 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="ml-4 flex-1 bg-stone-200/60 rounded-md h-5 max-w-xs" />
              </div>
              <div className="p-6 bg-stone-50/50">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'En attente', count: 3, color: 'bg-orange-200' },
                    { label: 'En cours', count: 2, color: 'bg-blue-200' },
                    { label: 'Terminé', count: 4, color: 'bg-emerald-200' },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="bg-white rounded-2xl border border-stone-100 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-stone-400">{label}</span>
                        <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">{count}</span>
                      </div>
                      <div className="space-y-2">
                        {Array.from({ length: count }).map((_, j) => (
                          <div key={j} className="bg-stone-50 rounded-xl p-2.5 border border-stone-100">
                            <div className={`h-2 rounded-full mb-1.5 ${color}`} style={{ width: `${55 + j * 15}%` }} />
                            <div className="h-1.5 bg-stone-200 rounded-full w-2/3" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-stone-100 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Logo size={20} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-stone-700">Progression globale</span>
                      <span className="text-sm font-bold text-orange-500">64%</span>
                    </div>
                    <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: '64%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section id="fonctionnalites" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-bold uppercase tracking-widest text-sm mb-3">Fonctionnalités</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Tout ce dont votre équipe a besoin</h2>
            <p className="mt-4 text-stone-500 text-lg max-w-2xl mx-auto">Une plateforme complète qui élimine la friction entre l'idée et l'exécution.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="group p-6 rounded-3xl border border-stone-100 hover:border-orange-200 bg-white hover:bg-orange-50/30 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-100/50">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-500 mb-4 group-hover:bg-orange-100 transition-colors">{f.icon}</div>
                <h3 className="font-bold text-lg text-stone-900 mb-2">{f.title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pour qui ── */}
      <section id="pour-qui" className="py-24 px-6 bg-stone-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-bold uppercase tracking-widest text-sm mb-3">Pour qui ?</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Fait pour vous,<br />quelle que soit votre équipe</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FOR_WHO.map((item) => (
              <div key={item.title} className="bg-white rounded-3xl border border-stone-100 p-6 hover:shadow-md transition-all hover:-translate-y-1">
                <span className="text-4xl mb-4 block">{item.emoji}</span>
                <h3 className="font-bold text-stone-900 mb-2">{item.title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA intermédiaire ── */}
      <section className="py-20 px-6 bg-orange-500">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Prêt à transformer votre façon de travailler ?</h2>
          <p className="text-orange-100 mb-8 text-lg">Rejoignez Galineo et créez votre premier projet structuré par l'IA en moins de 2 minutes.</p>
          <Link href={ctaHref} className="inline-block px-8 py-4 bg-white hover:bg-orange-50 text-orange-600 font-bold rounded-2xl text-lg transition-all hover:-translate-y-0.5">{ctaLabel}</Link>
        </div>
      </section>

      {/* ── Tarifs ── */}
      <section id="tarifs" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-bold uppercase tracking-widest text-sm mb-3">Tarifs</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Simple et transparent</h2>
            <p className="mt-4 text-stone-500 text-lg">Commencez gratuitement. Évoluez quand vous en avez besoin.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`relative rounded-3xl border ${plan.color} p-8 bg-white`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full">{plan.badge}</span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-bold text-xl text-stone-900 mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-stone-900">{plan.price}</span>
                    <span className="text-stone-400 text-sm">/ {plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-stone-600">
                      <svg className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={ctaHref} className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${plan.badge ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-700'}`}>
                  {user ? "Accéder à l'app" : 'Commencer'}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 px-6 bg-stone-50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-orange-500 font-bold uppercase tracking-widest text-sm mb-3">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Questions fréquentes</h2>
          </div>
          <div className="bg-white rounded-3xl border border-stone-100 px-8">
            {FAQ_ITEMS.map((item) => <FaqItem key={item.q} q={item.q} r={item.r} />)}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <Logo size={48} className="text-orange-500" />
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Commencez dès maintenant</h2>
          <p className="text-stone-500 text-lg mb-8">De l'idée au projet structuré, en quelques secondes.</p>
          <Link href={ctaHref} className="inline-block px-10 py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-lg transition-all shadow-lg shadow-orange-200 hover:shadow-orange-300 hover:-translate-y-0.5">{ctaLabel}</Link>
          <p className="mt-4 text-sm text-stone-400">Gratuit sans carte bancaire</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-stone-100 py-10 px-6 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={20} className="text-orange-500" />
            <span className="font-black text-stone-900" style={{ fontFamily: 'Archivo Black, sans-serif' }}>Galineo</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-stone-400">
            <Link href="/legal/mentions-legales" className="hover:text-stone-600 transition-colors">Mentions légales</Link>
            <Link href="/login" className="hover:text-stone-600 transition-colors">Connexion</Link>
            <Link href="/register" className="hover:text-stone-600 transition-colors">Inscription</Link>
          </div>
          <p className="text-sm text-stone-400">© {new Date().getFullYear()} Galineo. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
