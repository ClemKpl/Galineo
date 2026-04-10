const dns = require('dns').promises;

const DISPOSABLE_DOMAINS = [
  'yopmail.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 
  'sharklasers.com', 'mailinator.com', 'dispostable.com', 'getnada.com',
  'maildrop.cc', 'temp-mail.org', 'fake-mail.com', 'trashmail.com'
];

/**
 * Vérifie si une adresse email est techniquement capable de recevoir des messages.
 * 1. Vérifie le format
 * 2. Bloque les domaines temporaires connus
 * 3. Vérifie l'existence des enregistrements MX du domaine (DNS)
 */
async function verifyEmailExistence(email) {
  if (!email || typeof email !== 'string') return { valid: false, error: 'Email manquant' };
  
  const trimmedEmail = email.trim().toLowerCase();
  
  // 1. Regex de base
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(trimmedEmail)) {
    return { valid: false, error: 'Format d\'email invalide.' };
  }

  const domain = trimmedEmail.split('@')[1];

  // 2. Blocage des emails jetables
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return { valid: false, error: 'Email jetable détecté. Veuillez créer un compte avec une adresse email valide.' };
  }

  // 3. Vérification DNS (Enregistrements MX)
  try {
    const mx = await dns.resolveMx(domain);
    if (!mx || mx.length === 0) {
      return { valid: false, error: 'Cette adresse email semble inexistante ou ne peut pas recevoir de messages.' };
    }
  } catch (err) {
    return { valid: false, error: 'Le domaine de votre email est invalide ou introuvable.' };
  }

  return { valid: true };
}

module.exports = { verifyEmailExistence };
