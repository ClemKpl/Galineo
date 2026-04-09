const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/auth');

// GET /users/search?q= — rechercher des utilisateurs
router.get('/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  const userId = req.user.id;
  if (!q || q.trim().length < 1) return res.json([]);

  db.all(
    'SELECT id, name, email FROM users WHERE (name LIKE ? OR email LIKE ?) AND id != ? LIMIT 10',
    [`%${q}%`, `%${q}%`, userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET /users/me — profil de l'utilisateur connecté
router.get('/me', authMiddleware, (req, res) => {
  const userId = req.user.id;
  // Mise à jour de la dernière connexion lors de la validation de session
  db.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId], (updateErr) => {
    if (updateErr) console.error('❌ Erreur update last_login_at:', updateErr.message);
    
    db.get('SELECT id, name, email, avatar, notif_project_updates, notif_added_to_project, notif_deadlines, created_at FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Utilisateur non trouvé' });
      res.json(row);
    });
  });
});

// PATCH /users/me — modifier profil
router.patch('/me', authMiddleware, (req, res) => {
  const { name, email } = req.body;
  const userId = req.user.id;

  if (
    !name && 
    !email && 
    req.body.avatar === undefined && 
    req.body.notif_project_updates === undefined &&
    req.body.notif_added_to_project === undefined &&
    req.body.notif_deadlines === undefined
  ) {
    return res.status(400).json({ error: 'Aucune donnée à modifier' });
  }

  const updates = [];
  const values = [];
  if (name)  { updates.push('name = ?');  values.push(name); }
  if (email) { updates.push('email = ?'); values.push(email); }
  if (req.body.avatar !== undefined) { updates.push('avatar = ?'); values.push(req.body.avatar); }
  
  // Notification settings
  if (req.body.notif_project_updates !== undefined)   { updates.push('notif_project_updates = ?');   values.push(req.body.notif_project_updates ? 1 : 0); }
  if (req.body.notif_added_to_project !== undefined)  { updates.push('notif_added_to_project = ?');  values.push(req.body.notif_added_to_project ? 1 : 0); }
  if (req.body.notif_deadlines !== undefined)         { updates.push('notif_deadlines = ?');         values.push(req.body.notif_deadlines ? 1 : 0); }

  values.push(userId);

  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email déjà utilisé' });
      return res.status(500).json({ error: err.message });
    }
    db.get('SELECT id, name, email, avatar, notif_project_updates, notif_added_to_project, notif_deadlines FROM users WHERE id = ?', [userId], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

// PATCH /users/me/password — changer le mot de passe
router.patch('/me/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Champs manquants' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (min. 6 caractères)' });

  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: 'Mot de passe mis à jour' });
    });
  });
});

// DELETE /users/me — supprimer son compte
router.delete('/me', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.run('DELETE FROM project_members WHERE user_id = ?', [userId]);
  db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Compte supprimé' });
  });
});

// GET /users — liste de tous les utilisateurs
router.get('/', authMiddleware, (req, res) => {
  db.all('SELECT id, name, email, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;

