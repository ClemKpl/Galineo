/**
 * Configuration des administrateurs de la plateforme Galineo.
 * Les adresses email listées ici bénéficient automatiquement du plan 'unlimited'
 * et ont accès au Panel Admin ainsi qu'aux notifications de support.
 */

const ADMIN_EMAILS = [
  'capelleclem@gmail.com',
  'flgherardi@gmail.com'
];

module.exports = {
  ADMIN_EMAILS: ADMIN_EMAILS.map(email => email.toLowerCase())
};
