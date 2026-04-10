const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { ADMIN_EMAILS } = require('../config/admins');

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

// GET /users/search?q= — rechercher des utilisateurs
router.get('/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  const userId = req.user.id;
  if (!q || q.trim().length < 1) return res.json([]);

  db.all(
    'SELECT id, name, email, avatar FROM users WHERE (name LIKE ? OR email LIKE ?) AND id != ? LIMIT 10',
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
    
    db.get('SELECT id, name, email, avatar, plan, notif_project_updates, notif_added_to_project, notif_deadlines, notif_mentions, notif_task_completed, notif_ai_responses, notif_chat_messages, created_at FROM users WHERE id = ?', [userId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Utilisateur non trouvé' });
      
      // Override plan for whitelisted admins
      if (row && row.email && ADMIN_EMAILS.includes(row.email.toLowerCase())) {
        row.plan = 'unlimited';
      }
      
      row.isAdmin = req.user.isAdmin;
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
    req.body.notif_deadlines === undefined &&
    req.body.notif_mentions === undefined &&
    req.body.notif_task_completed === undefined &&
    req.body.notif_ai_responses === undefined &&
    req.body.notif_chat_messages === undefined
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
  if (req.body.notif_mentions !== undefined)          { updates.push('notif_mentions = ?');          values.push(req.body.notif_mentions ? 1 : 0); }
  if (req.body.notif_task_completed !== undefined)   { updates.push('notif_task_completed = ?');   values.push(req.body.notif_task_completed ? 1 : 0); }
  if (req.body.notif_ai_responses !== undefined)      { updates.push('notif_ai_responses = ?');      values.push(req.body.notif_ai_responses ? 1 : 0); }
  if (req.body.notif_chat_messages !== undefined)     { updates.push('notif_chat_messages = ?');     values.push(req.body.notif_chat_messages ? 1 : 0); }

  values.push(userId);

  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values, function (err) {
    if (err) {
      if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email déjà utilisé' });
      return res.status(500).json({ error: err.message });
    }
    db.get('SELECT id, name, email, avatar, plan, notif_project_updates, notif_added_to_project, notif_deadlines, notif_mentions, notif_task_completed, notif_ai_responses, notif_chat_messages FROM users WHERE id = ?', [userId], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      
      // Override plan for whitelisted admins
      if (row && row.email && ADMIN_EMAILS.includes(row.email.toLowerCase())) {
        row.plan = 'unlimited';
      }
      
      row.isAdmin = req.user.isAdmin;
      res.json(row);
    });
  });
});

// PATCH /users/me/password — changer le mot de passe
router.patch('/me/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Champs manquants' });
  if (!PASSWORD_REGEX.test(newPassword))
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre.' });

  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      logActivity(null, req.user.id, 'auth', null, 'password_changed', { ip: req.ip }).catch(() => {});
      res.json({ message: 'Mot de passe mis à jour' });
    });
  });
});

// GET /users/me/export — Export RGPD (Article 20)
router.get('/me/export', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.get('SELECT id, name, email, avatar, plan, created_at FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });

    const result = { user, projects: [], tasks: [], messages: [], events: [] };

    db.all(`SELECT p.id, p.title, p.description, p.created_at, pm.role_id
            FROM projects p
            JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?`, [userId], (e1, projects) => {
      if (!e1) result.projects = projects || [];

      db.all('SELECT id, title, description, status, priority, due_date, created_at FROM tasks WHERE assigned_to = ? OR created_by = ?', [userId, userId], (e2, tasks) => {
        if (!e2) result.tasks = tasks || [];

        db.all('SELECT id, project_id, content, created_at FROM messages WHERE user_id = ?', [userId], (e3, messages) => {
          if (!e3) result.messages = messages || [];

          db.all('SELECT id, project_id, title, description, start_date, end_date, created_at FROM calendar_events WHERE created_by = ?', [userId], (e4, events) => {
            if (!e4) result.events = events || [];

            res.setHeader('Content-Disposition', 'attachment; filename="galineo-export.json"');
            res.setHeader('Content-Type', 'application/json');
            res.json(result);
          });
        });
      });
    });
  });
});

// DELETE /users/me — supprimer son compte (cascade RGPD, Article 17)
router.delete('/me', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  const run = (sql, params = []) => new Promise((resolve, reject) =>
    db.run(sql, params, (err) => err ? reject(err) : resolve())
  );

  try {
    // Anonymiser les tâches créées / assignées
    await run('UPDATE tasks SET created_by = NULL WHERE created_by = ?', [userId]);
    await run('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?', [userId]);

    // Remplacer les messages par un placeholder RGPD
    await run("UPDATE messages SET content = '[Message supprimé]', user_id = NULL WHERE user_id = ?", [userId]);

    // Supprimer les logs d'activité liés à l'utilisateur
    await run('DELETE FROM activity_logs WHERE user_id = ?', [userId]);

    // Supprimer les notifications
    await new Promise((res) => db.run('DELETE FROM ai_active_tasks WHERE user_id = ?', [userId], res));
    await new Promise((res) => db.run('DELETE FROM event_attendees WHERE user_id = ?', [userId], res));
    await new Promise((res) => db.run('DELETE FROM notifications WHERE user_id = ? OR from_user_id = ?', [userId, userId], res));
    await new Promise((res) => db.run('DELETE FROM chat_group_members WHERE user_id = ?', [userId], res));
    await new Promise((res) => db.run('UPDATE chat_groups SET created_by = NULL WHERE created_by = ?', [userId], res));

    // Supprimer les tickets de support
    await new Promise((res) => db.run('DELETE FROM invitations WHERE inviter_id = ?', [userId], res));
    await new Promise((res) => db.run('DELETE FROM support_tickets WHERE user_id = ?', [userId], res));

    // Gérer les projets dont l'utilisateur est seul propriétaire
    const ownedProjects = await new Promise((resolve, reject) =>
      db.all('SELECT id FROM projects WHERE owner_id = ?', [userId], (err, rows) => err ? reject(err) : resolve(rows || []))
    );
    for (const project of ownedProjects) {
      const successor = await new Promise((resolve, reject) =>
        db.get('SELECT user_id FROM project_members WHERE project_id = ? AND user_id != ? ORDER BY user_id ASC LIMIT 1',
          [project.id, userId], (err, row) => err ? reject(err) : resolve(row))
      );
      if (successor) {
        await run('UPDATE projects SET owner_id = ? WHERE id = ?', [successor.user_id, project.id]);
        await run('UPDATE project_members SET role_id = 1 WHERE project_id = ? AND user_id = ?', [project.id, successor.user_id]);
      } else {
        await run("UPDATE projects SET status = 'deleted' WHERE id = ?", [project.id]);
      }
    }

    await run('DELETE FROM project_members WHERE user_id = ?', [userId]);
    await run('DELETE FROM users WHERE id = ?', [userId]);

    logActivity(null, userId, 'auth', null, 'account_deleted', { ip: req.ip }).catch(() => {});
    res.json({ message: 'Compte et données associées supprimés' });
  } catch (err) {
    console.error('❌ Erreur suppression compte:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /users/me/reset — Réinitialiser le compte ( quitter tous les projets )
router.post('/me/reset', authMiddleware, (req, res) => {
  const userId = req.user.id;
  
  // 1. Trouver tous les projets dont l'utilisateur est membre
  db.all('SELECT project_id, role_id FROM project_members WHERE user_id = ?', [userId], async (err, memberships) => {
    if (err) return res.status(500).json({ error: err.message });
    
    try {
      for (const m of memberships) {
        const projectId = m.project_id;
        
        // Si l'utilisateur est le propriétaire (role_id 1)
        if (m.role_id === 1) {
          // Trouver un successeur (le plus ancien membre non-propriétaire)
          await new Promise((resolve, reject) => {
            db.get(
              'SELECT user_id FROM project_members WHERE project_id = ? AND user_id != ? ORDER BY user_id ASC LIMIT 1',
              [projectId, userId],
              (succErr, successor) => {
                if (succErr) return reject(succErr);
                
                if (successor) {
                  // Transférer la propriété
                  db.run('UPDATE projects SET owner_id = ? WHERE id = ?', [successor.user_id, projectId], (updErr) => {
                    if (updErr) return reject(updErr);
                    // Mettre à jour son rôle en Propriétaire
                    db.run('UPDATE project_members SET role_id = 1 WHERE project_id = ? AND user_id = ?', [projectId, successor.user_id], (roleErr) => {
                       if (roleErr) return reject(roleErr);
                       logActivity(projectId, userId, 'project', projectId, 'ownership_transferred', { new_owner_id: successor.user_id }).catch(console.error);
                       resolve();
                    });
                  });
                } else {
                  // Personne d'autre : suppression du projet
                  db.run("UPDATE projects SET status = 'deleted' WHERE id = ?", [projectId], (delErr) => {
                    if (delErr) return reject(delErr);
                    resolve();
                  });
                }
              }
            );
          });
        }
        
        // Quitter le projet
        await new Promise((resolve, reject) => {
          db.run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId], (leaveErr) => {
            if (leaveErr) return reject(leaveErr);
            resolve();
          });
        });
      }
      
      res.json({ message: 'Compte réinitialisé : vous avez quitté tous vos projets.' });
    } catch (loopErr) {
      console.error('❌ Erreur reset account:', loopErr);
      res.status(500).json({ error: 'Une erreur est survenue lors de la réinitialisation.' });
    }
  });
});

// GET /users — liste de tous les utilisateurs
router.get('/', authMiddleware, (_req, res) => {
  db.all('SELECT id, name, email, avatar, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /users/me/ai-settings — Voir les préférences IA (Durée historique)
router.get('/me/ai-settings', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.get('SELECT ai_history_duration FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || { ai_history_duration: 60 });
  });
});

// PATCH /users/me/ai-settings — Modifier les préférences IA
router.patch('/me/ai-settings', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { ai_history_duration } = req.body;
  
  const val = parseInt(ai_history_duration);
  if (isNaN(val) || val < 1) return res.status(400).json({ error: "Durée d'historique invalide (minimum 1 min)." });

  db.run('UPDATE users SET ai_history_duration = ? WHERE id = ?', [val, userId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Préférences IA mises à jour." });
  });
});

module.exports = router;

