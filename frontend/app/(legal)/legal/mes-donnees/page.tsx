'use client';
import type { Metadata } from 'next';
import { useState } from 'react';
import { api } from '@/lib/api';

export default function MesDonneesPage() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/export`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'galineo-mes-donnees.json';
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      alert('Une erreur est survenue. Réessaie ou contacte le support.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="prose prose-stone max-w-none">
      <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-2" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Mes données personnelles
      </h1>
      <p className="text-stone-400 text-sm mb-10">Conformément au RGPD — Articles 15, 17 et 20</p>

      <Section title="Vos droits">
        <p>En tant qu'utilisateur de Galinéo, vous disposez des droits suivants sur vos données personnelles :</p>
        <ul>
          <li><strong>Droit d'accès (art. 15)</strong> — Obtenir une copie de toutes vos données</li>
          <li><strong>Droit à la portabilité (art. 20)</strong> — Exporter vos données dans un format lisible</li>
          <li><strong>Droit à l'effacement (art. 17)</strong> — Supprimer définitivement votre compte et vos données</li>
          <li><strong>Droit de rectification (art. 16)</strong> — Modifier vos informations depuis les <a href="/settings" className="text-orange-500 hover:underline">Paramètres</a></li>
        </ul>
      </Section>

      <Section title="Exporter mes données">
        <p>
          Téléchargez une copie complète de vos données au format JSON : profil, projets, tâches, messages et événements de calendrier.
        </p>
        <div className="not-prose mt-4">
          <button
            onClick={handleExport}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-3 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition-all disabled:opacity-60 shadow-sm"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Préparation de l'export...
              </>
            ) : (
              <>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                Télécharger mes données
              </>
            )}
          </button>
          {done && (
            <p className="mt-3 text-sm text-green-600 font-semibold">
              Export téléchargé avec succès.
            </p>
          )}
        </div>
        <p className="mt-4 text-sm text-stone-400">
          Le fichier contient vos données au format JSON. Il peut être ouvert avec n'importe quel éditeur de texte.
        </p>
      </Section>

      <Section title="Supprimer mon compte">
        <p>
          La suppression de votre compte est irréversible et entraîne la suppression définitive de toutes vos données personnelles.
        </p>
        <div className="not-prose mt-4">
          <a
            href="/settings"
            className="inline-flex items-center gap-2 px-5 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 transition-all text-sm"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m-9 0 1 14a1 1 0 0 0 1 .93h8a1 1 0 0 0 1-.93L19 6" />
            </svg>
            Accéder à la zone de suppression
          </a>
        </div>
        <p className="mt-3 text-sm text-stone-400">
          Disponible dans Paramètres → Zone de danger → Supprimer mon compte.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Pour toute demande relative à vos données :{' '}
          <a href="mailto:contact@flavien-gherardi.fr" className="text-orange-500 hover:underline">
            contact@flavien-gherardi.fr
          </a>
        </p>
        <p>
          Nous répondons dans un délai maximum de <strong>30 jours</strong> conformément au RGPD.
        </p>
        <p>
          Vous pouvez également déposer une réclamation auprès de la{' '}
          <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">
            CNIL
          </a>.
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-stone-900 mb-3 pb-2 border-b border-stone-100">{title}</h2>
      <div className="text-stone-600 leading-relaxed space-y-3">{children}</div>
    </section>
  );
}
