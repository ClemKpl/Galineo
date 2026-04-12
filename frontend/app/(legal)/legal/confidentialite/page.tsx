import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — Galinéo',
};

export default function ConfidentialitePage() {
  return (
    <article className="prose prose-stone max-w-none">
      <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-2" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Politique de confidentialité
      </h1>
      <p className="text-stone-400 text-sm mb-10">Dernière mise à jour : janvier 2025</p>

      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-10 text-sm text-orange-800">
        Galinéo respecte votre vie privée et s'engage à protéger vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD — UE 2016/679) et à la loi Informatique et Libertés.
      </div>

      <Section title="1. Responsable du traitement">
        <ul>
          <li><strong>Identité :</strong> <span className="text-orange-500">[Nom ou raison sociale à compléter]</span></li>
          <li><strong>Adresse :</strong> <span className="text-orange-500">[Adresse à compléter]</span></li>
          <li><strong>Email DPO / Contact RGPD :</strong> <a href="mailto:contact@flavien-gherardi.fr">contact@flavien-gherardi.fr</a></li>
        </ul>
      </Section>

      <Section title="2. Données collectées">
        <p>Nous collectons les catégories de données suivantes :</p>

        <h3 className="font-bold text-stone-800 mt-4 mb-2">Données d'identification et de compte</h3>
        <ul>
          <li>Nom, adresse email, mot de passe (hashé — jamais stocké en clair)</li>
          <li>Photo de profil (optionnelle)</li>
          <li>Date d'inscription et de dernière connexion</li>
        </ul>

        <h3 className="font-bold text-stone-800 mt-4 mb-2">Données d'utilisation du service</h3>
        <ul>
          <li>Projets, tâches, commentaires et fichiers créés sur la plateforme</li>
          <li>Historique des échanges avec l'assistant IA</li>
          <li>Préférences et paramètres de l'application</li>
          <li>Logs d'activité (actions réalisées dans les projets)</li>
        </ul>

        <h3 className="font-bold text-stone-800 mt-4 mb-2">Données de paiement</h3>
        <ul>
          <li>Les paiements sont traités exclusivement par <strong>Stripe</strong>. Galinéo ne stocke aucune donnée bancaire. Seuls les identifiants Stripe (customer_id, subscription_id) sont conservés.</li>
        </ul>

        <h3 className="font-bold text-stone-800 mt-4 mb-2">Données techniques</h3>
        <ul>
          <li>Adresse IP (logs serveur, conservation limitée)</li>
          <li>Type de navigateur et système d'exploitation</li>
        </ul>
      </Section>

      <Section title="3. Finalités et bases légales">
        <table className="w-full text-sm border-collapse mt-2">
          <thead>
            <tr className="bg-stone-100">
              <th className="text-left p-3 font-semibold border border-stone-200">Finalité</th>
              <th className="text-left p-3 font-semibold border border-stone-200">Base légale</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Fournir et faire fonctionner le service', 'Exécution du contrat (art. 6.1.b RGPD)'],
              ['Gérer votre compte et authentification', 'Exécution du contrat'],
              ['Facturation et gestion des abonnements', 'Exécution du contrat + obligation légale'],
              ['Envoi d\'emails transactionnels (OTP, notifications)', 'Exécution du contrat'],
              ['Amélioration du service et statistiques d\'usage', 'Intérêt légitime (art. 6.1.f RGPD)'],
              ['Sécurité et prévention des fraudes', 'Intérêt légitime'],
              ['Respect des obligations légales', 'Obligation légale (art. 6.1.c RGPD)'],
            ].map(([finalite, base], i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                <td className="p-3 border border-stone-200 text-stone-700">{finalite}</td>
                <td className="p-3 border border-stone-200 text-stone-500">{base}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="4. Sous-traitants et transferts de données">
        <p>Galinéo fait appel aux sous-traitants suivants :</p>
        <table className="w-full text-sm border-collapse mt-2">
          <thead>
            <tr className="bg-stone-100">
              <th className="text-left p-3 font-semibold border border-stone-200">Prestataire</th>
              <th className="text-left p-3 font-semibold border border-stone-200">Rôle</th>
              <th className="text-left p-3 font-semibold border border-stone-200">Localisation</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Vercel', 'Hébergement frontend', 'USA (clauses contractuelles types UE)'],
              ['Render', 'Hébergement backend & base de données', 'USA (clauses contractuelles types UE)'],
              ['Stripe', 'Paiement en ligne', 'USA (Privacy Shield / SCCs)'],
              ['Resend', 'Envoi d\'emails transactionnels', 'USA (clauses contractuelles types UE)'],
              ['Google (Gemini API)', 'Assistant IA', 'USA (clauses contractuelles types UE)'],
            ].map(([prestataire, role, loc], i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-stone-50'}>
                <td className="p-3 border border-stone-200 font-medium text-stone-800">{prestataire}</td>
                <td className="p-3 border border-stone-200 text-stone-700">{role}</td>
                <td className="p-3 border border-stone-200 text-stone-500">{loc}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-stone-500">
          Ces transferts hors UE sont encadrés par des clauses contractuelles types approuvées par la Commission européenne.
        </p>
      </Section>

      <Section title="5. Durée de conservation">
        <ul>
          <li><strong>Données de compte actif :</strong> Conservées pendant toute la durée d'utilisation du service</li>
          <li><strong>Après suppression du compte :</strong> Suppression définitive sous <span className="text-orange-500">[30 jours à compléter]</span></li>
          <li><strong>Données de paiement (Stripe) :</strong> 10 ans (obligation légale comptable)</li>
          <li><strong>Logs techniques :</strong> 12 mois maximum</li>
          <li><strong>Historique IA :</strong> Conservé tant que le compte est actif, supprimé avec le compte</li>
        </ul>
      </Section>

      <Section title="6. Vos droits">
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d'accès</strong> — Obtenir une copie de vos données personnelles</li>
          <li><strong>Droit de rectification</strong> — Corriger des données inexactes</li>
          <li><strong>Droit à l'effacement</strong> — Supprimer votre compte et vos données (disponible dans Paramètres → Supprimer mon compte)</li>
          <li><strong>Droit à la portabilité</strong> — Exporter vos données dans un format structuré</li>
          <li><strong>Droit d'opposition</strong> — Vous opposer à certains traitements basés sur l'intérêt légitime</li>
          <li><strong>Droit à la limitation</strong> — Demander la suspension temporaire d'un traitement</li>
        </ul>
        <p>
          Pour exercer ces droits : <a href="mailto:contact@flavien-gherardi.fr">contact@flavien-gherardi.fr</a>. Nous répondons dans un délai d'un mois maximum.
        </p>
        <p>
          Vous pouvez également introduire une réclamation auprès de la <strong>CNIL</strong> : <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer">cnil.fr</a>
        </p>
      </Section>

      <Section title="7. Cookies">
        <p>Galinéo utilise uniquement des cookies strictement nécessaires au fonctionnement du service :</p>
        <ul>
          <li><strong>Cookie de session / JWT</strong> — Maintien de votre connexion. Durée : session ou 7 jours selon votre choix.</li>
        </ul>
        <p>
          Aucun cookie publicitaire, de suivi ou analytique tiers n'est déposé sans votre consentement préalable.
        </p>
      </Section>

      <Section title="8. Sécurité des données">
        <p>Galinéo met en œuvre les mesures de sécurité suivantes :</p>
        <ul>
          <li>Chiffrement des mots de passe via bcrypt</li>
          <li>Communications chiffrées via HTTPS/TLS</li>
          <li>Authentification par token JWT avec expiration</li>
          <li>Vérification d'email obligatoire à l'inscription</li>
          <li>Contrôle d'accès par rôle sur tous les projets</li>
          <li>Journalisation des accès non autorisés</li>
        </ul>
      </Section>

      <Section title="9. Modification de la politique">
        <p>
          Cette politique peut être mise à jour pour refléter des évolutions du service ou de la réglementation. En cas de modification substantielle, vous serez notifié par email. La date de dernière mise à jour est indiquée en haut de ce document.
        </p>
      </Section>

      <Section title="10. Contact">
        <p>
          Pour toute question relative à la protection de vos données :{' '}
          <a href="mailto:contact@flavien-gherardi.fr">contact@flavien-gherardi.fr</a>
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
