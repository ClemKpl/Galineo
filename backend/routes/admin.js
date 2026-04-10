const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const { ADMIN_EMAILS } = require('../config/admins');

function adminMiddleware(req, res, next) {
  const email = req.user?.email;
  if (!email || !ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: 'Accès refusé — réservé aux administrateurs.' });
  }
  next();
}

// GET /admin/users — liste tous les utilisateurs
router.get('/users', authMiddleware, adminMiddleware, (req, res) => {
  db.all(
    `SELECT id, name, email, plan, created_at, last_login_at,
      (SELECT COUNT(*) FROM project_members pm WHERE pm.user_id = users.id) as project_count
     FROM users ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// DELETE /admin/users/:id — supprimer un compte utilisateur
router.delete('/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const targetId = req.params.id;
  if (String(targetId) === String(req.user.id)) {
    return res.status(400).json({ error: 'Impossible de supprimer votre propre compte.' });
  }
  db.run('DELETE FROM users WHERE id = ?', [targetId], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// PATCH /admin/users/:id/plan — changer le plan d'un utilisateur
router.patch('/users/:id/plan', authMiddleware, adminMiddleware, (req, res) => {
  const { plan } = req.body;
  if (!['free', 'premium', 'unlimited'].includes(plan)) {
    return res.status(400).json({ error: 'Plan invalide.' });
  }
  db.run('UPDATE users SET plan = ? WHERE id = ?', [plan, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// GET /admin/projects — liste tous les projets
router.get('/projects', authMiddleware, adminMiddleware, (req, res) => {
  db.all(
    `SELECT p.id, p.title, p.status, p.created_at, u.name as owner_name, u.email as owner_email,
      (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
     FROM projects p
     LEFT JOIN users u ON p.owner_id = u.id
     ORDER BY p.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// DELETE /admin/projects/:id — supprimer définitivement un projet
router.delete('/projects/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.run("UPDATE projects SET status = 'deleted' WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// GET /admin/stats — stats globales
router.get('/stats', authMiddleware, adminMiddleware, (req, res) => {
  db.get('SELECT COUNT(*) as total FROM users', [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT COUNT(*) as total FROM users WHERE plan = 'premium'", [], (err2, premium) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.get("SELECT COUNT(*) as total FROM projects WHERE status != 'deleted'", [], (err3, projects) => {
        if (err3) return res.status(500).json({ error: err3.message });
        db.get('SELECT COUNT(*) as total FROM tasks', [], (err4, tasks) => {
          if (err4) return res.status(500).json({ error: err4.message });
          res.json({
            users: users.total,
            premium_users: premium.total,
            projects: projects.total,
            tasks: tasks.total,
          });
        });
      });
    });
  });
});

module.exports = router;
