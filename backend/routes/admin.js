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
  const run = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, (err) => err ? reject(err) : resolve())
  );

  (async () => {
    try {
      // 1. Anonymiser les tâches créées / assignées
      await run('UPDATE tasks SET created_by = NULL WHERE created_by = ?', [targetId]);
      await run('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?', [targetId]);

      // 2. Remplacer les messages par un placeholder RGPD
      await run("UPDATE messages SET content = '[Message supprimé]', user_id = NULL WHERE user_id = ?", [targetId]);

      // 3. Supprimer les données liées (Nettoyage SQL & RGPD)
      await run('DELETE FROM activity_logs WHERE user_id = ?', [targetId]);
      await run('DELETE FROM notifications WHERE user_id = ?', [targetId]);
      await run('DELETE FROM ai_active_tasks WHERE user_id = ?', [targetId]);
      await run('DELETE FROM event_attendees WHERE user_id = ?', [targetId]);
      await run('DELETE FROM task_comments WHERE user_id = ?', [targetId]);
      await run('DELETE FROM support_tickets WHERE user_id = ?', [targetId]);
      await run('DELETE FROM chat_group_members WHERE user_id = ?', [targetId]);
      await run('UPDATE chat_groups SET created_by = NULL WHERE created_by = ?', [targetId]);

      // 4. Gérer les projets (Propriétaire)
      const ownedProjects = await new Promise((resolve, reject) =>
        db.all('SELECT id FROM projects WHERE owner_id = ?', [targetId], (err, rows) => err ? reject(err) : resolve(rows || []))
      );
      
      for (const project of ownedProjects) {
        // Trouver un successeur potentiel
        const successor = await new Promise((resolve, reject) =>
          db.get('SELECT user_id FROM project_members WHERE project_id = ? AND user_id != ? ORDER BY user_id ASC LIMIT 1',
            [project.id, targetId], (err, row) => err ? reject(err) : resolve(row))
        );
        
        if (successor) {
          await run('UPDATE projects SET owner_id = ? WHERE id = ?', [successor.user_id, project.id]);
          await run('UPDATE project_members SET role_id = 1 WHERE project_id = ? AND user_id = ?', [project.id, successor.user_id]);
        } else {
          await run("UPDATE projects SET status = 'deleted' WHERE id = ?", [project.id]);
        }
      }

      // 5. Nettoyer les adhésions aux projets
      await run('DELETE FROM project_members WHERE user_id = ?', [targetId]);

      // 6. Suppression finale de l'utilisateur
      await run('DELETE FROM users WHERE id = ?', [targetId]);

      res.json({ success: true, message: 'Utilisateur supprimé avec succès et données nettoyées.' });
    } catch (err) {
      console.error('❌ Erreur admin suppression utilisateur:', err);
      res.status(500).json({ error: 'Erreur lors de la suppression sécurisée de l\'utilisateur : ' + err.message });
    }
  })();
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
