import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Conditions Générales d\'Utilisation — Galinéo',
};

export default function CguPage() {
  return (
    <article className="prose prose-stone max-w-none">
      <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-2" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Conditions Générales d'Utilisation
      </h1>
      <p className="text-stone-400 text-sm mb-10">Dernière mise à jour : janvier 2025</p>

      <Section title="1. Objet">
        <p>
          Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme Galinéo, accessible à l'adresse <strong>galineo.vercel.app</strong>, éditée par <span className="text-orange-500">[Nom ou raison sociale]</span>.
        </p>
        <p>
          Toute utilisation du service implique l'acceptation pleine et entière des présentes CGU. Si vous n'acceptez pas ces conditions, vous ne devez pas utiliser le service.
        </p>
      </Section>

      <Section title="2. Description du service">
        <p>
          Galinéo est une plateforme collaborative de gestion de projets permettant à ses utilisateurs de :
        </p>
        <ul>
          <li>Créer et gérer des projets et des tâches</li>
          <li>Collaborer avec des membres d'équipe</li>
          <li>Visualiser des plannings via un diagramme de Gantt</li>
          <li>Utiliser un assistant IA pour automatiser certaines actions</li>
        </ul>
        <p>
          Le service est proposé en deux formules : <strong>Gratuite</strong> et <strong>Premium</strong> (10 €/mois TTC).
        </p>
      </Section>

      <Section title="3. Inscription et compte">
        <p>
          L'accès au service nécessite la création d'un compte avec une adresse email valide. L'utilisateur s'engage à :
        </p>
        <ul>
          <li>Fournir des informations exactes et à jour</li>
          <li>Maintenir la confidentialité de ses identifiants</li>
          <li>Ne pas partager son compte avec des tiers</li>
          <li>Notifier Galinéo immédiatement en cas d'utilisation non autorisée</li>
        </ul>
        <p>
          Galinéo se réserve le droit de suspendre ou supprimer tout compte en cas de violation des présentes CGU.
        </p>
      </Section>

      <Section title="4. Abonnement et paiement">
        <p>
          L'abonnement Premium est facturé <strong>10 € TTC par mois</strong>, prélevé automatiquement via Stripe. L'abonnement est sans engagement et résiliable à tout moment depuis les paramètres du compte.
        </p>
        <p>
          En cas de résiliation, l'accès Premium reste actif jusqu'à la fin de la période déjà facturée. Aucun remboursement au prorata n'est effectué, sauf obligation légale contraire.
        </p>
        <p>
          Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation de 14 jours ne s'applique pas si l'exécution du service a commencé avant l'expiration de ce délai, avec votre accord préalable exprès.
        </p>
      </Section>

      <Section title="5. Utilisation acceptable">
        <p>L'utilisateur s'engage à ne pas utiliser Galinéo pour :</p>
        <ul>
          <li>Diffuser des contenus illicites, offensants ou portant atteinte aux droits de tiers</li>
          <li>Tenter d'accéder à des données d'autres utilisateurs sans autorisation</li>
          <li>Perturber ou surcharger les serveurs de Galinéo</li>
          <li>Contourner les mesures de sécurité du service</li>
          <li>Utiliser le service à des fins commerciales de revente sans accord préalable</li>
        </ul>
      </Section>

      <Section title="6. Données et contenu utilisateur">
        <p>
          L'utilisateur conserve la propriété de toutes les données et contenus qu'il crée sur Galinéo. En utilisant le service, il accorde à Galinéo une licence limitée, non exclusive, nécessaire au fonctionnement technique du service (stockage, sauvegarde, affichage).
        </p>
        <p>
          Galinéo ne revendique aucun droit sur vos projets, tâches ou données.
        </p>
      </Section>

      <Section title="7. Assistant IA">
        <p>
          Galinéo intègre un assistant basé sur l'intelligence artificielle (Google Gemini). Les réponses générées sont fournies à titre indicatif. L'utilisateur reste seul responsable des actions réalisées sur la base des suggestions de l'IA.
        </p>
        <p>
          Les échanges avec l'assistant peuvent être utilisés pour améliorer la qualité du service, dans le respect de la politique de confidentialité.
        </p>
      </Section>

      <Section title="8. Disponibilité du service">
        <p>
          Galinéo s'efforce d'assurer la disponibilité du service 24h/24 et 7j/7, mais ne peut garantir une disponibilité ininterrompue. Des interruptions pour maintenance ou en cas d'incident technique peuvent survenir.
        </p>
        <p>
          Galinéo ne saurait être tenu responsable des dommages résultant d'une indisponibilité du service.
        </p>
      </Section>

      <Section title="9. Limitation de responsabilité">
        <p>
          Dans les limites autorisées par la loi, Galinéo ne pourra être tenu responsable des dommages indirects, pertes de données ou pertes de bénéfices résultant de l'utilisation ou de l'impossibilité d'utiliser le service.
        </p>
      </Section>

      <Section title="10. Modification des CGU">
        <p>
          Galinéo se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle par email ou notification dans l'application. La poursuite de l'utilisation du service après notification vaut acceptation des nouvelles CGU.
        </p>
      </Section>

      <Section title="11. Résiliation">
        <p>
          L'utilisateur peut supprimer son compte à tout moment depuis les paramètres. La suppression entraîne la suppression définitive de toutes ses données dans un délai de <span className="text-orange-500">[30 jours à compléter]</span>.
        </p>
        <p>
          Galinéo peut résilier un compte sans préavis en cas de violation grave des présentes CGU.
        </p>
      </Section>

      <Section title="12. Droit applicable et litiges">
        <p>
          Les présentes CGU sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité. À défaut d'accord, les tribunaux compétents de <span className="text-orange-500">[Ville à compléter]</span> seront saisis.
        </p>
        <p>
          Conformément aux dispositions du Code de la consommation, vous pouvez recourir à un médiateur de la consommation en cas de litige non résolu : <span className="text-orange-500">[Nom du médiateur à compléter]</span>.
        </p>
      </Section>

      <Section title="13. Contact">
        <p>
          Pour toute question relative aux présentes CGU : <a href="mailto:contact@flavien-gherardi.fr">contact@flavien-gherardi.fr</a>
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
