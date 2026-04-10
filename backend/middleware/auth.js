const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);

    // Ajout du flag isAdmin pour simplifier les contrôles d'accès ultérieurs
    const { ADMIN_EMAILS } = require('../config/admins');
    req.user.isAdmin = !!(req.user.email && ADMIN_EMAILS.includes(req.user.email.toLowerCase()));

    // Vérification du ban (sauf pour les admins)
    if (!req.user.isAdmin) {
      const db = require('../db');
      const row = await new Promise((resolve, reject) =>
        db.get('SELECT banned FROM users WHERE id = ?', [req.user.id], (err, r) => err ? reject(err) : resolve(r))
      );
      if (row?.banned) {
        return res.status(403).json({ error: 'Votre compte a été suspendu. Contactez le support.' });
      }
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
