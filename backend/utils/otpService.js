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
 * Vérifie si le code est valide pour l'email donné
 */
async function verifyCode(email, code) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM email_verifications WHERE email = ? AND code = ? AND expires_at > CURRENT_TIMESTAMP',
      [email.toLowerCase(), code],
      (err, row) => {
        if (err) return reject(err);
        if (row) {
          // Code valide
          resolve(true);
        } else {
          resolve(false);
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
