const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { deleteProjectsPermanently } = require('../utils/projectDeleter');
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
      await run("UPDATE messages SET content = '[Message supprimé]', user_id = NULL WHERE user_id = ?", [targetId]);
      await run("UPDATE chat_group_messages SET content = '[Message supprimé]', user_id = NULL WHERE user_id = ?", [targetId]);

      // 3. Supprimer les données liées (Nettoyage SQL & RGPD)
      await run('DELETE FROM activity_logs WHERE user_id = ?', [targetId]);
      await run('DELETE FROM notifications WHERE user_id = ?', [targetId]);
      await run('DELETE FROM ai_active_tasks WHERE user_id = ?', [targetId]);
      await run('DELETE FROM event_attendees WHERE user_id = ?', [targetId]);
      await run('DELETE FROM task_comments WHERE user_id = ?', [targetId]);
      await run('DELETE FROM support_tickets WHERE user_id = ?', [targetId]);
      await run('DELETE FROM invitations WHERE inviter_id = ?', [targetId]);
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

// PATCH /admin/users/:id/ban — bannir ou débannir un utilisateur
router.patch('/users/:id/ban', authMiddleware, adminMiddleware, (req, res) => {
  const { banned } = req.body;
  if (typeof banned !== 'boolean') {
    return res.status(400).json({ error: 'Valeur banned invalide.' });
  }
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Impossible de vous bannir vous-même.' });
  }
  db.run('UPDATE users SET banned = ? WHERE id = ?', [banned ? 1 : 0, req.params.id], function (err) {
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

// DELETE /admin/projects/:id — placer un projet dans la corbeille
router.delete('/projects/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.run("UPDATE projects SET status = 'deleted' WHERE id = ?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Projet placé dans la corbeille' });
  });
});

// DELETE /admin/projects/:id/hard — supprimer DEFINITIVEMENT un projet
router.delete('/projects/:id/hard', authMiddleware, adminMiddleware, (req, res) => {
  deleteProjectsPermanently([req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Projet supprimé définitivement' });
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

// GET /admin/onboarding-stats — Statistiques marketing onboarding
router.get('/onboarding-stats', authMiddleware, adminMiddleware, (req, res) => {
  db.get('SELECT COUNT(*) as total FROM users', [], (err, total) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT COUNT(*) as answered FROM users WHERE onboarding_status >= 1", [], (err2, answered) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.get("SELECT COUNT(*) as completed FROM users WHERE onboarding_status >= 2", [], (err3, completed) => {
        if (err3) return res.status(500).json({ error: err3.message });
        db.all("SELECT marketing_source as value, COUNT(*) as count FROM users WHERE marketing_source IS NOT NULL GROUP BY marketing_source ORDER BY count DESC", [], (err4, sources) => {
          if (err4) return res.status(500).json({ error: err4.message });
          db.all("SELECT user_type as value, COUNT(*) as count FROM users WHERE user_type IS NOT NULL GROUP BY user_type ORDER BY count DESC", [], (err5, types) => {
            if (err5) return res.status(500).json({ error: err5.message });
            db.all("SELECT usage_intent as value, COUNT(*) as count FROM users WHERE usage_intent IS NOT NULL GROUP BY usage_intent ORDER BY count DESC", [], (err6, intents) => {
              if (err6) return res.status(500).json({ error: err6.message });
              res.json({
                total: total.total,
                answered: answered.answered,
                completed: completed.completed,
                sources,
                types,
                intents,
              });
            });
          });
        });
      });
    });
  });
});

// GET /admin/onboarding-export — Export CSV des réponses onboarding
router.get('/onboarding-export', authMiddleware, adminMiddleware, (req, res) => {
  db.all(
    `SELECT id, name, email, plan, onboarding_status, marketing_source, user_type, usage_intent, created_at
     FROM users ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const headers = ['id', 'name', 'email', 'plan', 'onboarding_status', 'marketing_source', 'user_type', 'usage_intent', 'created_at'];
      const escape = (v) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [
        headers.join(','),
        ...rows.map(r => headers.map(h => escape(r[h])).join(','))
      ].join('\n');

      res.setHeader('Content-Disposition', 'attachment; filename="galineo-onboarding-export.csv"');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send('\uFEFF' + csv); // BOM UTF-8 pour Excel
    }
  );
});

module.exports = router;
