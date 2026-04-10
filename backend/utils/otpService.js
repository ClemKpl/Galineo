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
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return new Promise((resolve, reject) => {
    // Supprimer les anciens codes pour cet email
    db.run('DELETE FROM email_verifications WHERE email = ?', [email], (delErr) => {
      if (delErr) return reject(delErr);

      db.run(
        'INSERT INTO email_verifications (email, code, expires_at) VALUES (?, ?, ?)',
        [email.toLowerCase(), code, expiresAt],
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
      'SELECT id, code, attempts FROM email_verifications WHERE email = ? AND expires_at > CURRENT_TIMESTAMP',
      [email.toLowerCase()],
      (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve({ valid: false, error: 'Code inexistant ou expiré.' });

        // Vérifier si trop de tentatives
        if (row.attempts >= MAX_ATTEMPTS) {
          db.run('DELETE FROM email_verifications WHERE id = ?', [row.id]);
          return resolve({ valid: false, error: 'Trop de tentatives infructueuses. Le code a été invalidé par sécurité.' });
        }

        if (row.code === code) {
          resolve({ valid: true });
        } else {
          // Incrémenter les tentatives
          db.run('UPDATE email_verifications SET attempts = attempts + 1 WHERE id = ?', [row.id], () => {
            if (row.attempts + 1 >= MAX_ATTEMPTS) {
              db.run('DELETE FROM email_verifications WHERE id = ?', [row.id]);
              resolve({ valid: false, error: 'Code erroné. Trop de tentatives, veuillez redemander un nouveau code.' });
            } else {
              resolve({ valid: false, error: `Code incorrect (${MAX_ATTEMPTS - (row.attempts + 1)} tentatives restantes).` });
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
