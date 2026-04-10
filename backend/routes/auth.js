const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const ADMIN_EMAILS = ['capelleclem@gmail.com', 'flgherardi@gmail.com'];

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
const MAX_LOGIN_ATTEMPTS = 10;
const LOCK_DURATION_MS = 30 * 60 * 1000; // 30 minutes

// POST /auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Champs manquants' });

  if (!PASSWORD_REGEX.test(password))
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.' });

  try {
    const hash = await bcrypt.hash(password, 10);
    db.run(
      'INSERT INTO users (name, email, password_hash, last_login_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [name, email, hash],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE'))
            return res.status(409).json({ error: 'Email déjà utilisé' });
          return res.status(500).json({ error: err.message });
        }
        const token = jwt.sign({ id: this.lastID, name, email }, JWT_SECRET, { expiresIn: '7d' });
        const newUserId = this.lastID;

            // Auto-join projects if invited
            db.all('SELECT * FROM invitations WHERE email = ? AND status = ?', [email, 'pending'], (invErr, invites) => {
              if (!invErr && invites && invites.length > 0) {
                const stmt = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)');
                const updateStmt = db.prepare('UPDATE invitations SET status = ? WHERE id = ?');
                const notifStmt = db.prepare('INSERT INTO notifications (user_id, type, title, message, project_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?)');
                
                invites.forEach(inv => {
                  stmt.run(inv.project_id, newUserId, inv.role_id);
                  updateStmt.run('accepted', inv.id);
                  
                  // Récupérer le nom du projet pour la notification interne
                  db.get('SELECT title, owner_id FROM projects WHERE id = ?', [inv.project_id], (pErr, project) => {
                    if (project) {
                      notifStmt.run(newUserId, 'project_invite', 'Projet rejoint', `Bienvenue ! Vous avez rejoint le projet "${project.title}"`, inv.project_id, inv.inviter_id || project.owner_id);
                    }
                  });
                });
                
                stmt.finalize();
                updateStmt.finalize();
               // note: notifStmt is async and might finish after response, but ok for this simple use case
              }
              const plan = ADMIN_EMAILS.includes(email.toLowerCase()) ? 'unlimited' : 'free';
              res.json({ token, user: { id: newUserId, name, email, avatar: null, plan } });
            });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Champs manquants' });

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) {
      logActivity(null, null, 'auth', null, 'login_failed', { email, ip: req.ip, reason: 'user_not_found' }).catch(() => {});
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérification du verrouillage de compte
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      return res.status(423).json({ error: 'Compte temporairement verrouillé. Réessayez dans 30 minutes.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.login_attempts || 0) + 1;
      const lock = attempts >= MAX_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MS).toISOString()
        : user.locked_until;
      db.run('UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?', [attempts, lock, user.id]);
      logActivity(null, user.id, 'auth', null, 'login_failed', { ip: req.ip, attempts }).catch(() => {});
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP, login_attempts = 0, locked_until = NULL WHERE id = ?', [user.id], () => {
      const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          plan: (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) ? 'unlimited' : (user.plan || 'free'),
          notif_project_updates: user.notif_project_updates,
          notif_added_to_project: user.notif_added_to_project,
          notif_deadlines: user.notif_deadlines,
        },
      });
    });
  });
});

module.exports = router;
