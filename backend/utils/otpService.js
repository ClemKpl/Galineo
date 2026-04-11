const db = require('../db');
const crypto = require('crypto');

/**
 * Génère un code à 6 chiffres
 */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Crée ou met à jour une vérification d'email pour un utilisateur.
 * Expire après 15 minutes.
 */
async function createVerificationCode(email) {
  const code = generateCode();
  const lowerEmail = email.toLowerCase();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return new Promise((resolve, reject) => {
    // Supprimer les anciens codes pour cet email (minuscules forcées)
    db.run('DELETE FROM email_verifications WHERE LOWER(email) = ?', [lowerEmail], (delErr) => {
      if (delErr) return reject(delErr);

      db.run(
        'INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)',
        [lowerEmail, code, expiresAt],
        function (err) {
          if (err) return reject(err);
          resolve(code);
        }
      );
    });
  });
}

/**
 * Vérifie si le code est valide pour l'email donné avec limite de tentatives
 */
async function verifyCode(email, code) {
  const MAX_ATTEMPTS = 5;

  return new Promise((resolve, reject) => {
    db.get(
      'SELECT id, code, attempts, expires_at FROM email_verifications WHERE LOWER(email) = ?',
      [email.toLowerCase()],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve({ valid: false, error: 'Aucun code de vérification trouvé pour cet email.' });

        // Vérification de l'expiration en JS (plus fiable que SQL selon l'heure serveur)
        const now = new Date();
        const expiresAt = new Date(row.expires_at);
        if (now > expiresAt) {
          db.run('DELETE FROM email_verifications WHERE id = ?', [row.id]);
          return resolve({ valid: false, error: 'Ce code a expiré (validité 15 min). Veuillez en demander un nouveau.' });
        }

        // Vérifier si trop de tentatives
        if (row.attempts >= MAX_ATTEMPTS) {
          db.run('DELETE FROM email_verifications WHERE id = ?', [row.id]);
          return resolve({ valid: false, error: 'Trop de tentatives infructueuses. Veuillez redemander un code.' });
        }

        if (row.code === code) {
          resolve({ valid: true });
        } else {
          // Incrémenter les tentatives
          const newAttempts = (row.attempts || 0) + 1;
          db.run('UPDATE email_verifications SET attempts = ? WHERE id = ?', [newAttempts, row.id], () => {
            if (newAttempts >= MAX_ATTEMPTS) {
              db.run('DELETE FROM email_verifications WHERE id = ?', [row.id]);
              resolve({ valid: false, error: 'Code erroné. Limite de tentatives atteinte, veuillez redemander un nouveau code.' });
            } else {
              resolve({ valid: false, error: `Code incorrect (${MAX_ATTEMPTS - newAttempts} tentatives restantes).` });
            }
          });
        }
      }
    );
  });
}

/**
 * Nettoie le code après utilisation réussie
 */
async function consumeCode(email) {
  return new Promise((resolve) => {
    db.run('DELETE FROM email_verifications WHERE email = ?', [email.toLowerCase()], () => resolve());
  });
}

module.exports = {
  createVerificationCode,
  verifyCode,
  consumeCode
};
