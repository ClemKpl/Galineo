const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

function authMiddleware(req, res, next) {
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
    
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
