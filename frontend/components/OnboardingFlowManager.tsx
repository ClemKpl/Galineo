'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/Logo';

// ─── Types ───────────────────────────────────────────────────────────────────

type Phase = 0 | 1 | 2 | 'done';

const SOURCES = ['Réseaux sociaux', 'Un ami', 'Recherche Google', 'Publicité', 'Autre'];
const TYPES   = ['Particulier', 'Entreprise'];
const INTENTS = ['Gestion projets perso', 'Travail d\'équipe', 'Freelance', 'Apprentissage', 'Autre'];

// ─── Sub-components ──────────────────────────────────────────────────────────

function OptionButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
        selected
          ? 'border-orange-500 bg-orange-50 text-orange-700'
          : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
      }`}
    >
      {label}
    </button>
  );
}

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current ? 'w-4 bg-orange-500' : i === current ? 'w-4 bg-orange-300' : 'w-1.5 bg-stone-200'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Phase 0 : Questionnaire ─────────────────────────────────────────────────

function QuestionnaireModal({ onDone, onSkip }: { onDone: (data: { source: string; type: string; intent: string }) => void; onSkip: () => void }) {
  const [step, setStep] = useState(0); // 0=source, 1=type, 2=intent
  const [source, setSource] = useState('');
  const [userType, setUserType] = useState('');
  const [intent, setIntent] = useState('');

  const questions = [
    {
      label: 'Comment avez-vous entendu parler de Galineo ?',
      options: SOURCES,
      value: source,
      set: setSource,
    },
    {
      label: 'Vous utilisez Galineo en tant que...',
      options: TYPES,
      value: userType,
      set: setUserType,
    },
    {
      label: 'Quel est votre objectif principal ?',
      options: INTENTS,
      value: intent,
      set: setIntent,
    },
  ];

  const current = questions[step];
  const canNext = !!current.value;

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      onDone({ source, type: userType, intent });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-7 pt-8 pb-4">
          <div className="flex items-center gap-2 mb-5">
            <Logo size={16} style={{ color: 'var(--accent-500)' }} />
            <span className="text-stone-400 text-[11px] font-bold uppercase tracking-widest">Galineo</span>
          </div>
          <h2 className="text-[26px] font-black text-stone-900 leading-tight">
            Dites-nous{' '}
            <span style={{ color: 'var(--accent-500)' }}>en plus</span>{' '}
            sur vous&nbsp;✨
          </h2>
          <p className="text-stone-400 text-sm mt-2 font-medium">{current.label}</p>
          <div className="mt-5">
            <ProgressDots current={step} total={3} />
          </div>
        </div>

        {/* Options */}
        <div className="p-6 space-y-2.5">
          {current.options.map((opt) => (
            <OptionButton key={opt} label={opt} selected={current.value === opt} onClick={() => current.set(opt)} />
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-stone-400 hover:text-stone-600 transition-colors"
          >
            Passer
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canNext}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
          >
            {step < 2 ? 'Suivant' : 'Terminer'}
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 1 : Choix du guide ─────────────────────────────────────────────────

function TourChoiceModal({ userName, onStart, onSkip }: { userName: string; onStart: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-stone-900 to-stone-800 px-6 py-8 text-center">
          <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Logo size={32} className="text-white" />
          </div>
          <h2 className="text-white text-xl font-bold mb-2">Bienvenue, {userName.split(' ')[0]} !</h2>
          <p className="text-stone-400 text-sm leading-relaxed">
            Voulez-vous une visite guidée de Galineo pour maîtriser l&apos;application en 2 minutes ?
          </p>
        </div>
        <div className="p-5 space-y-3">
          <button
            type="button"
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-colors shadow-md shadow-orange-100"
          >
            <span>C&apos;est parti !</span>
            <span>🚀</span>
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="w-full px-4 py-3 border border-stone-200 text-stone-600 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            Découvrir seul
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phase 2 : Tour Driver.js ─────────────────────────────────────────────────

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement('script');
    s.id = id; s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function runOnboardingTour(router: ReturnType<typeof useRouter>, onDone: () => void) {
  if (typeof window === 'undefined') return;

  // Inject driver.js CSS from public folder
  if (!document.getElementById('driver-css')) {
    const link = document.createElement('link');
    link.id = 'driver-css'; link.rel = 'stylesheet'; link.href = '/driver.css';
    document.head.appendChild(link);
  }

  // Load driver.js via CDN script tag (avoids Turbopack static analysis)
  await loadScript('https://cdn.jsdelivr.net/npm/driver.js@1.4.0/dist/driver.js.iife.js', 'driver-js');

  // IIFE exposes as window.driver.js.driver (vite iife name = "driver.js")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  const driver = w?.driver?.js?.driver ?? w?.driver?.driver ?? w?.driver;

  // ── 1. Naviguer sur le dashboard ────────────────────────────────────────
  if (!window.location.pathname.includes('/dashboard')) {
    router.push('/dashboard');
    await new Promise((r) => setTimeout(r, 800));
  }

  // ── 2. État du projet démo ───────────────────────────────────────────────
  let demoProjectId: number | null = null;

  const createAndEnterDemoProject = async () => {
    try {
      const res = await api.post('/projects', {
        title: '🎯 Projet Démo — Didacticiel',
        description: 'Projet temporaire créé automatiquement pour la visite guidée.',
      });
      demoProjectId = res.id;
      window.dispatchEvent(new Event('projects-refresh'));
      router.push(`/projects/${demoProjectId}`);
      await new Promise((r) => setTimeout(r, 2000));
    } catch (e) {
      console.warn('Impossible de créer le projet démo.', e);
    }
  };

  // ── 3. Cleanup ───────────────────────────────────────────────────────────
  const cleanup = async () => {
    window.dispatchEvent(new Event('close-create-project'));
    if (demoProjectId) {
      try {
        await api.delete(`/projects/${demoProjectId}`);
        await api.delete(`/projects/${demoProjectId}/hard`);
        window.dispatchEvent(new Event('projects-refresh'));
      } catch {}
      demoProjectId = null;
    }
    router.push('/dashboard');
    onDone();
  };

  // ── 4. Lancer le tour ───────────────────────────────────────────────────
  const SIDEBAR_TOUR_ATTRS = new Set([
    'dashboard', 'projects-nav', 'sidebar-notifications',
    'sidebar-messages', 'create-project-btn',
  ]);

  const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 1024;
  let sidebarIsOpen = false;

  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'Suivant →',
    prevBtnText: '← Retour',
    doneBtnText: 'Terminer ✓',
    animate: true,
    overlayOpacity: 0.6,
    smoothScroll: true,
    allowClose: false,
    disableActiveInteraction: true,
    onHighlightStarted: (el: Element | undefined) => {
      const attr = el?.getAttribute('data-tour') ?? '';
      const needsSidebar = SIDEBAR_TOUR_ATTRS.has(attr);
      if (needsSidebar && !sidebarIsOpen && isMobile()) {
        // Sidebar fermée → ouvrir et laisser l'animation se terminer avant le popover
        window.dispatchEvent(new Event('open-sidebar'));
        sidebarIsOpen = true;
        // Décaler le popover pour laisser la sidebar s'ouvrir (300ms anim + marge)
        const popover = document.querySelector('.driver-popover') as HTMLElement | null;
        if (popover) { popover.style.visibility = 'hidden'; }
        setTimeout(() => {
          if (popover) { popover.style.visibility = ''; }
        }, 380);
      } else if (!needsSidebar) {
        window.dispatchEvent(new Event('close-sidebar'));
        sidebarIsOpen = false;
      }
    },
    onDestroyStarted: () => {
      driverObj.destroy();
      cleanup();
    },
    steps: [
      // ── Dashboard ────────────────────────────────────────────────────
      {
        element: '[data-tour="dashboard"]',
        popover: {
          title: '📊 Tableau de bord',
          description: 'Votre centre de contrôle : statistiques globales, activité récente et accès rapide à tous vos projets.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="projects-nav"]',
        popover: {
          title: '📁 Vos Projets',
          description: 'Retrouvez et gérez tous vos projets depuis la barre latérale.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="sidebar-notifications"]',
        popover: {
          title: '🔔 Notifications',
          description: 'Restez informé de toutes les activités : assignations, mentions, deadlines et messages d\'équipe.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="sidebar-messages"]',
        popover: {
          title: '💬 Discussions',
          description: 'Échangez en direct avec vos collaborateurs via des messages privés ou des groupes de discussion.',
          side: 'right',
        },
      },
      // ── Création de projet ───────────────────────────────────────────
      {
        element: '[data-tour="create-project-btn"]',
        popover: {
          title: '✨ Créer un projet',
          description: 'Ce bouton ouvre le panneau de création de projet. Deux modes sont disponibles : l\'Assistant IA ou la saisie manuelle.',
          side: 'right',
          onNextClick: () => {
            window.dispatchEvent(new Event('open-create-project'));
            setTimeout(() => driverObj.moveNext(), 400);
          },
        },
      },
      {
        element: '[data-tour="create-ai"]',
        popover: {
          title: '🤖 Assistant de création IA',
          description: 'Décrivez votre projet en quelques mots. L\'IA génère automatiquement la structure, les tâches et les paramètres pour vous.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="create-manual"]',
        popover: {
          title: '📝 Saisie manuelle',
          description: 'Vous avez déjà tout en tête ? Remplissez le formulaire classique et configurez votre projet à votre rythme.',
          side: 'top',
          onNextClick: async () => {
            window.dispatchEvent(new Event('close-create-project'));
            await createAndEnterDemoProject();
            driverObj.moveNext();
          },
        },
      },
      // ── Projet démo ──────────────────────────────────────────────────
      {
        popover: {
          title: '🚀 Bienvenue dans votre projet démo !',
          description: 'Nous avons ouvert un projet temporaire pour vous faire découvrir toutes les fonctionnalités disponibles à l\'intérieur d\'un projet.',
        },
      },
      {
        element: '[data-tour="project-tab-dashboard"]',
        popover: {
          title: '🏠 Vue d\'ensemble',
          description: 'Le dashboard projet centralise l\'avancement global, les membres actifs et les dernières activités de l\'équipe.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="project-tab-tasks"]',
        popover: {
          title: '✅ Gestion des Tâches (WBS)',
          description: 'Organisez vos tâches en hiérarchies, assignez-les à votre équipe et suivez leur avancement en temps réel.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="project-tab-gantt"]',
        popover: {
          title: '📅 Planning GANTT',
          description: 'Visualisez votre projet sur une timeline interactive. Gérez les deadlines et exportez votre planning en CSV.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="project-tab-ai"]',
        popover: {
          title: '🧠 Galineo Room',
          description: 'L\'IA dédiée à votre projet. Elle connaît vos tâches et vos membres, et peut agir directement sur votre projet.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="project-tab-chat"]',
        popover: {
          title: '💬 Chat d\'équipe',
          description: 'Communiquez en temps réel avec tous les membres du projet. Partagez des fichiers et coordonnez votre travail.',
          side: 'bottom',
        },
      },
      {
        element: '[data-tour="project-tab-settings"]',
        popover: {
          title: '👥 Membres & Paramètres',
          description: 'Gérez les membres de votre équipe, leurs rôles et les paramètres du projet depuis cet onglet.',
          side: 'bottom',
        },
      },
      // ── Final ────────────────────────────────────────────────────────
      {
        popover: {
          title: '🎉 Vous êtes prêt !',
          description: 'Vous connaissez maintenant l\'essentiel de Galineo. Le projet démo sera supprimé automatiquement. À vous de jouer !',
        },
      },
    ],
  });

  // Sur mobile, pré-ouvrir la sidebar avant le premier step sidebar
  if (isMobile()) {
    window.dispatchEvent(new Event('open-sidebar'));
    sidebarIsOpen = true;
    await new Promise((r) => setTimeout(r, 700));
  }

  driverObj.drive();
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export default function OnboardingFlowManager() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('done');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    const status = user.onboarding_status ?? 0;
    if (status === 0) setPhase(0);
    else if (status === 1) setPhase(1);
    else setPhase('done');
    setReady(true);
  }, [user]);

  const updateOnboarding = useCallback(async (data: Record<string, unknown>) => {
    try {
      await api.patch('/users/me/onboarding', data);
      await refreshUser();
    } catch (e) {
      console.error('Onboarding update failed:', e);
    }
  }, [refreshUser]);

  const handleQuestionnaireDone = async (answers: { source: string; type: string; intent: string }) => {
    await updateOnboarding({
      onboarding_status: 1,
      marketing_source: answers.source,
      user_type: answers.type,
      usage_intent: answers.intent,
    });
    setPhase(1);
  };

  const handleQuestionnaireSkip = async () => {
    await updateOnboarding({ onboarding_status: 1 });
    setPhase(1);
  };

  const handleTourStart = async () => {
    await updateOnboarding({ onboarding_status: 2 });
    setPhase('done');
    runOnboardingTour(router, () => {});
  };

  const handleTourSkip = async () => {
    await updateOnboarding({ onboarding_status: 2 });
    setPhase('done');
  };

  // Listen for manual tour trigger from settings
  useEffect(() => {
    const handleManualTour = () => runOnboardingTour(router, () => {});
    window.addEventListener('galineo:start-tour', handleManualTour);
    return () => window.removeEventListener('galineo:start-tour', handleManualTour);
  }, [router]);

  if (!ready || phase === 'done') return null;

  if (phase === 0) {
    return (
      <QuestionnaireModal
        onDone={handleQuestionnaireDone}
        onSkip={handleQuestionnaireSkip}
      />
    );
  }

  if (phase === 1) {
    return (
      <TourChoiceModal
        userName={user?.name ?? 'vous'}
        onStart={handleTourStart}
        onSkip={handleTourSkip}
      />
    );
  }

  return null;
}
