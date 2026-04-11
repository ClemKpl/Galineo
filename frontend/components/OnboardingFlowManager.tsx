'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 pt-6 pb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
              <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 0 2-2h2a2 2 0 0 0 2 2" />
              </svg>
            </div>
            <span className="text-white/80 text-xs font-bold uppercase tracking-widest">Question {step + 1}/3</span>
          </div>
          <h2 className="text-white text-xl font-bold leading-snug">{current.label}</h2>
          <div className="mt-4">
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
          <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30">
            <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5Z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
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

async function runOnboardingTour(router: ReturnType<typeof useRouter>, onDone: () => void) {
  const { driver } = await import('driver.js');

  const driverObj = driver({
    showProgress: true,
    progressText: '{{current}} / {{total}}',
    nextBtnText: 'Suivant →',
    prevBtnText: '← Retour',
    doneBtnText: 'Terminer ✓',
    animate: true,
    overlayOpacity: 0.55,
    smoothScroll: true,
    allowClose: true,
    onDestroyStarted: () => {
      driverObj.destroy();
      onDone();
    },
    steps: [
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
          description: 'Retrouvez et gérez tous vos projets. Créez-en un nouveau avec le bouton + en haut.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="sidebar-notifications"]',
        popover: {
          title: '🔔 Notifications',
          description: 'Restez informé de toutes les activités : assignations, mentions, deadlines et messages.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="sidebar-messages"]',
        popover: {
          title: '💬 Chat Privé',
          description: 'Échangez en direct avec vos collaborateurs via des conversations privées ou des groupes.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="sidebar-trash"]',
        popover: {
          title: '🗑️ Corbeille',
          description: 'Retrouvez ici les projets supprimés. Vous avez 30 jours pour les restaurer.',
          side: 'right',
        },
      },
      {
        element: '[data-tour="global-ai"]',
        popover: {
          title: '🤖 Assistant IA',
          description: 'Votre conseiller intelligent disponible partout dans Galineo. Posez-lui vos questions sur la gestion de projets.',
          side: 'left',
        },
      },
      {
        popover: {
          title: '🏗️ Gestion des Tâches (WBS)',
          description: 'Dans chaque projet, l\'onglet WBS vous permet d\'organiser vos tâches en hiérarchies et de visualiser l\'avancement.',
        },
      },
      {
        popover: {
          title: '📅 Planification GANTT',
          description: 'Visualisez votre projet sur une timeline interactive. Exportez votre planning en CSV pour le partager.',
        },
      },
      {
        popover: {
          title: '🧠 Galineo Room',
          description: 'L\'IA dédiée à votre projet. Elle connaît vos tâches, vos membres et peut agir directement sur votre projet.',
        },
      },
      {
        popover: {
          title: '🎉 Vous êtes prêt !',
          description: 'Vous connaissez maintenant l\'essentiel de Galineo. Commencez par créer votre premier projet et invitez votre équipe !',
        },
      },
    ],
  });

  // Navigate to dashboard first if needed, then start
  if (!window.location.pathname.includes('/dashboard')) {
    router.push('/dashboard');
    await new Promise((r) => setTimeout(r, 800));
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
