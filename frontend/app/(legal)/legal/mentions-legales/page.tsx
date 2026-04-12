import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mentions légales — Galinéo',
};

export default function MentionsLegalesPage() {
  return (
    <article className="prose prose-stone max-w-none">
      <h1 className="text-3xl font-black text-stone-900 uppercase tracking-tight mb-2" style={{ fontFamily: "'Archivo Black', sans-serif" }}>
        Mentions légales
      </h1>
      <p className="text-stone-400 text-sm mb-10">Dernière mise à jour : janvier 2025</p>

      <Section title="1. Éditeur du site">
        <p>Le site Galinéo est édité par :</p>
        <ul>
          <li><strong>Raison sociale :</strong> <span className="text-orange-500">[Nom ou raison sociale à compléter]</span></li>
          <li><strong>Forme juridique :</strong> <span className="text-orange-500">[Ex : Auto-entrepreneur, SAS, SARL…]</span></li>
          <li><strong>SIRET :</strong> <span className="text-orange-500">[Numéro SIRET à compléter]</span></li>
          <li><strong>Adresse :</strong> <span className="text-orange-500">[Adresse complète à compléter]</span></li>
          <li><strong>Email :</strong> contact@flavien-gherardi.fr</li>
        </ul>
      </Section>

      <Section title="2. Directeur de la publication">
        <p><span className="text-orange-500">[Nom du directeur de publication à compléter]</span></p>
      </Section>

      <Section title="3. Hébergement">
        <p>Le site et ses services sont hébergés par :</p>
        <ul>
          <li><strong>Frontend :</strong> Vercel Inc. — 340 Pine Street, Suite 701, San Francisco, CA 94104, USA — <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">vercel.com</a></li>
          <li><strong>Backend / Base de données :</strong> Render Services Inc. — 525 Brannan St, Suite 300, San Francisco, CA 94107, USA — <a href="https://render.com" target="_blank" rel="noopener noreferrer">render.com</a></li>
        </ul>
      </Section>

      <Section title="4. Propriété intellectuelle">
        <p>
          L'ensemble du contenu du site Galinéo (textes, graphismes, logo, icônes, interface) est la propriété exclusive de l'éditeur et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.
        </p>
        <p>
          Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans autorisation préalable écrite de l'éditeur.
        </p>
      </Section>

      <Section title="5. Limitation de responsabilité">
        <p>
          Galinéo s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur ce site. Toutefois, Galinéo ne peut garantir l'exactitude, la complétude ou l'actualité des informations diffusées.
        </p>
        <p>
          Galinéo se réserve le droit de modifier les contenus du site à tout moment et sans préavis.
        </p>
      </Section>

      <Section title="6. Cookies">
        <p>
          Le site Galinéo utilise des cookies strictement nécessaires au fonctionnement du service (authentification, session). Aucun cookie publicitaire ou de traçage tiers n'est déposé sans votre consentement.
        </p>
        <p>
          Pour en savoir plus, consultez notre <a href="/legal/confidentialite">Politique de confidentialité</a>.
        </p>
      </Section>

      <Section title="7. Droit applicable">
        <p>
          Les présentes mentions légales sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.
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
