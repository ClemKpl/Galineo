const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /projects — mes projets (propriétaire ou membre)
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.all(`
    SELECT DISTINCT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
      pm_me.role_id as my_role_id,
      r_me.name as my_role_name
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    LEFT JOIN project_members pm ON pm.project_id = p.id
    LEFT JOIN project_members pm_me ON pm_me.project_id = p.id AND pm_me.user_id = ?
    LEFT JOIN roles r_me ON r_me.id = pm_me.role_id
    WHERE (p.owner_id = ? OR pm.user_id = ?) AND p.status = 'active'
    ORDER BY p.created_at DESC
  `, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /projects — créer un projet
router.post('/', authMiddleware, (req, res) => {
  const { title, description, deadline, members, avatar } = req.body;
  const ownerId = req.user.id;
  if (!title) return res.status(400).json({ error: 'Titre requis' });

  db.run(
    'INSERT INTO projects (title, description, deadline, owner_id, avatar) VALUES (?, ?, ?, ?, ?)',
    [title, description || null, deadline || null, ownerId, avatar || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const projectId = this.lastID;

      // Ajouter le créateur comme Propriétaire (role id 1) puis répondre
      db.run(
        'INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
        [projectId, ownerId, 1],
        (errLink) => {
          if (errLink) console.error('❌ Erreur lien propriétaire:', errLink.message);

          // Ajouter les autres membres
          if (members && Array.isArray(members) && members.length > 0) {
            const stmt = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)');
            members.forEach(({ userId: memberId, roleId }) => {
              if (memberId !== ownerId) { // éviter doublon propriétaire
                stmt.run(projectId, memberId, roleId || 3);
              }
            });
            stmt.finalize();
          }

          res.status(201).json({ id: projectId, title, description, deadline, owner_id: ownerId, avatar });
        }
      );
    }
  );
});

// GET /projects/history — mes projets terminés
router.get('/history', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.all(`
    SELECT DISTINCT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE (p.owner_id = ? OR pm.user_id = ?) AND p.status = 'completed'
    ORDER BY p.created_at DESC
  `, [userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /projects/trash — corbeille (projets supprimés)
router.get('/trash', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.all(`
    SELECT DISTINCT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE (p.owner_id = ? OR pm.user_id = ?) AND p.status = 'deleted'
    ORDER BY p.updated_at DESC
  `, [userId, userId], (err, rows) => {
    // Si updated_at n'existe pas, on trie par created_at
    if (err) {
      db.all(`
        SELECT DISTINCT p.*, u.name as owner_name,
          (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
        FROM projects p
        LEFT JOIN users u ON p.owner_id = u.id
        LEFT JOIN project_members pm ON pm.project_id = p.id
        WHERE (p.owner_id = ? OR pm.user_id = ?) AND p.status = 'deleted'
        ORDER BY p.created_at DESC
      `, [userId, userId], (err2, rows2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(rows2);
      });
    } else {
      res.json(rows);
    }
  });
});

// GET /projects/:id/dashboard — synthèse du dashboard projet
router.get('/:id/dashboard', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = req.user.id;

  db.get(`
    SELECT DISTINCT p.id, p.title, p.deadline, p.status, p.avatar
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
  `, [projectId, userId, userId], (projectErr, project) => {
    if (projectErr) return res.status(500).json({ error: projectErr.message });
    if (!project) return res.status(404).json({ error: 'Projet non trouvé' });

    db.all(`
      SELECT
        t.id,
        t.parent_id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        t.assigned_to,
        u.name AS assignee_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      WHERE t.project_id = ?
      ORDER BY
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
        t.due_date ASC,
        t.created_at ASC
    `, [projectId], (tasksErr, tasks) => {
      if (tasksErr) return res.status(500).json({ error: tasksErr.message });

      db.all(`
        SELECT
          u.id,
          u.name,
          u.email,
          u.last_login_at,
          u.avatar,
          r.name AS role_name
        FROM project_members pm
        JOIN users u ON u.id = pm.user_id
        JOIN roles r ON r.id = pm.role_id
        WHERE pm.project_id = ?
        ORDER BY pm.role_id ASC, u.name ASC
      `, [projectId], (membersErr, members) => {
        if (membersErr) return res.status(500).json({ error: membersErr.message });

        const now = new Date();
        const normalizedTasks = Array.isArray(tasks) ? tasks : [];
        const features = normalizedTasks
          .filter((task) => task.parent_id == null)
          .map((task) => ({
            id: task.id,
            title: task.title
          }));
        const actionableTasks = normalizedTasks;

        const taskCounts = actionableTasks.reduce((acc, task) => {
          const status = task.status || 'todo';
          acc.total += 1;
          if (status === 'done') acc.done += 1;
          else if (status === 'in_progress') acc.in_progress += 1;
          else acc.todo += 1;

          const due = task.due_date ? new Date(task.due_date) : null;
          if (due && !Number.isNaN(due.getTime()) && due < now && status !== 'done') {
            acc.overdue += 1;
          }
          return acc;
        }, { total: 0, done: 0, in_progress: 0, todo: 0, overdue: 0 });

        const completionRate = taskCounts.total > 0
          ? Math.round((taskCounts.done / taskCounts.total) * 100)
          : 0;

        const urgentTasks = actionableTasks
          .filter((task) => task.due_date && (task.status || 'todo') !== 'done')
          .slice(0, 5)
          .map((task) => {
            const due = new Date(task.due_date);
            const isOverdue = !Number.isNaN(due.getTime()) && due < now;
            return {
              id: task.id,
              parent_id: task.parent_id,
              title: task.title,
              status: task.status || 'todo',
              priority: task.priority || 'normal',
              due_date: task.due_date,
              assigned_to: task.assigned_to,
              assignee_name: task.assignee_name,
              is_overdue: isOverdue
            };
          });

        const memberLoad = (Array.isArray(members) ? members : []).map((member) => {
          const assignedTasks = actionableTasks.filter((task) => task.assigned_to === member.id);
          const openTasks = assignedTasks.filter((task) => (task.status || 'todo') !== 'done');
          const overdueTasks = openTasks.filter((task) => {
            const due = task.due_date ? new Date(task.due_date) : null;
            return due && !Number.isNaN(due.getTime()) && due < now;
          });

          const doneTasks = assignedTasks.filter((task) => (task.status || 'todo') === 'done');
          const todoTasks = assignedTasks.filter((task) => (task.status || 'todo') !== 'done');
          const urgentTasksMember = todoTasks.filter((task) => (task.priority || 'normal').includes('urgent'));

          return {
            id: member.id,
            name: member.name,
            email: member.email,
            role_name: member.role_name,
            last_login_at: member.last_login_at,
            avatar: member.avatar,
            assigned_count: assignedTasks.length,
            done_count: doneTasks.length,
            todo_count: todoTasks.length,
            urgent_count: urgentTasksMember.length,
            overdue_count: overdueTasks.length
          };
        }).sort((a, b) => {
          if (b.open_count !== a.open_count) return b.open_count - a.open_count;
          if (b.overdue_count !== a.overdue_count) return b.overdue_count - a.overdue_count;
          return (a.name || '').localeCompare(b.name || '');
        });

        res.json({
          project,
          stats: {
            ...taskCounts,
            completion_rate: completionRate
          },
          features,
          urgent_tasks: urgentTasks,
          member_load: memberLoad
        });
      });
    });
  });
});

// PATCH /projects/:id/restore — restaurer un projet
router.patch('/:id/restore', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = req.user.id;

  canManageMembers(userId, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'Accès refusé' });

    db.run(
      "UPDATE projects SET status = 'active' WHERE id = ?",
      [projectId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Projet restauré' });
      }
    );
  });
});

// GET /projects/:id — détails d'un projet
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT p.*, u.name as owner_name, pm.role_id as my_role_id
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id 
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
    WHERE p.id = ?
  `, [req.user.id, id], (err, project) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!project) return res.status(404).json({ error: 'Projet non trouvé' });

    db.all(`
      SELECT u.id, u.name, u.email, u.last_login_at, r.name as role_name, r.id as role_id
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      JOIN roles r ON pm.role_id = r.id
      WHERE pm.project_id = ?
    `, [id], (err2, members) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ ...project, members });
    });
  });
});

function canManageMembers(userId, projectId, cb) {
  db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err) return cb(err);
    if (!project) return cb(null, { allowed: false, reason: 'Projet non trouvÃ©' });

    if (project.owner_id === userId) return cb(null, { allowed: true, isOwner: true });

    db.get(
      'SELECT role_id FROM project_members WHERE project_id = ? AND user_id = ?',
      [projectId, userId],
      (err2, member) => {
        if (err2) return cb(err2);
        const roleId = member?.role_id;
        const allowed = roleId === 1 || roleId === 2; // PropriÃ©taire ou Admin
        cb(null, { allowed, isOwner: false, roleId });
      }
    );
  });
}

// POST /projects/:id/members â€” ajouter un membre (admin/proprio)
router.post('/:id/members', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const currentUserId = req.user.id;
  const { userId, roleId } = req.body || {};

  if (!userId) return res.status(400).json({ error: 'userId requis' });

  canManageMembers(currentUserId, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'AccÃ¨s refusÃ©' });

    db.run(
      'INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
      [projectId, userId, roleId || 3],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Membre ajoutÃ©' });
      }
    );
  });
});

// PATCH /projects/:id/members/:userId â€” changer le rÃ´le (admin/proprio)
router.patch('/:id/members/:userId', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const currentUserId = req.user.id;
  const { roleId } = req.body || {};

  if (!roleId) return res.status(400).json({ error: 'roleId requis' });

  canManageMembers(currentUserId, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'AccÃ¨s refusÃ©' });

    db.run(
      'UPDATE project_members SET role_id = ? WHERE project_id = ? AND user_id = ?',
      [roleId, projectId, targetUserId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'RÃ´le mis Ã  jour' });
      }
    );
  });
});

// DELETE /projects/:id/members/:userId â€” retirer un membre (admin/proprio)
router.delete('/:id/members/:userId', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const targetUserId = Number(req.params.userId);
  const currentUserId = req.user.id;

  canManageMembers(currentUserId, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'AccÃ¨s refusÃ©' });

    db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId], (pErr, project) => {
      if (pErr) return res.status(500).json({ error: pErr.message });
      if (!project) return res.status(404).json({ error: 'Projet non trouvÃ©' });
      if (project.owner_id === targetUserId) return res.status(400).json({ error: 'Impossible de retirer le propriÃ©taire' });

      db.run(
        'DELETE FROM project_members WHERE project_id = ? AND user_id = ?',
        [projectId, targetUserId],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Membre retirÃ©' });
        }
      );
    });
  });
});



// PATCH /projects/:id/complete — terminer un projet
router.patch('/:id/complete', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = req.user.id;

  canManageMembers(userId, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'Accès refusé' });

    db.run(
      "UPDATE projects SET status = 'completed' WHERE id = ?",
      [projectId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Projet terminé et archivé' });
      }
    );
  });
});

// PATCH /projects/:id — modifier les informations du projet
router.patch('/:id', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = req.user.id;
  const { title, description, deadline, avatar } = req.body;

  canManageMembers(userId, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'Accès refusé' });

    const updates = [];
    const values = [];
    if (title !== undefined)       { updates.push('title = ?');       values.push(title); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (deadline !== undefined)    { updates.push('deadline = ?');    values.push(deadline); }
    if (avatar !== undefined)      { updates.push('avatar = ?');      values.push(avatar); }

    if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnée à modifier' });
    values.push(projectId);

    db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values, function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Projet mis à jour' });
    });
  });
});

// DELETE /projects/:id — supprimer un projet SOFT DELETE (Propriétaire uniquement)
router.delete('/:id', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = req.user.id;

  db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId], (pErr, project) => {
    if (pErr) return res.status(500).json({ error: pErr.message });
    if (!project) return res.status(404).json({ error: 'Projet non trouvé' });
    
    if (project.owner_id !== userId) {
      return res.status(403).json({ error: 'Seul le propriétaire peut supprimer le projet' });
    }

    // Soft delete
    db.run("UPDATE projects SET status = 'deleted' WHERE id = ?", [projectId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Projet placé dans la corbeille' });
    });
  });
});

// DELETE /projects/:id/hard — supprimer un projet DEFINITIVEMENT (Propriétaire uniquement)
router.delete('/:id/hard', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = req.user.id;

  db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId], (pErr, project) => {
    if (pErr) return res.status(500).json({ error: pErr.message });
    if (!project) return res.status(404).json({ error: 'Projet non trouvé' });
    
    if (project.owner_id !== userId) {
      return res.status(403).json({ error: 'Seul le propriétaire peut supprimer le projet' });
    }

    db.run('DELETE FROM projects WHERE id = ?', [projectId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('DELETE FROM project_members WHERE project_id = ?', [projectId]);
      res.json({ message: 'Projet supprimé définitivement' });
    });
  });
});

module.exports = router;
