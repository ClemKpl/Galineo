const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { sendMemberAdded, sendProjectInvitation } = require('../utils/mailer');
const crypto = require('crypto');

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
  const { title, description, deadline, members, avatar, start_date } = req.body;
  const ownerId = req.user.id;
  if (!title) return res.status(400).json({ error: 'Titre requis' });

  db.run(
    'INSERT INTO projects (title, description, deadline, owner_id, avatar, start_date) VALUES (?, ?, ?, ?, ?, ?)',
    [title, description || null, deadline || null, ownerId, avatar || null, start_date || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const projectId = this.lastID;

      // Ajouter le créateur comme Propriétaire (role id 1) puis répondre
      db.run(
        'INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
        [projectId, ownerId, 1],
        async (errLink) => {
          if (errLink) console.error('❌ Erreur lien propriétaire:', errLink.message);

          // Logger l'activité de création
          await logActivity(projectId, ownerId, 'project', projectId, 'created', { title });

          // Ajouter les autres membres et les notifier
          if (members && Array.isArray(members) && members.length > 0) {
            for (const { userId: memberId, roleId } of members) {
              if (memberId !== ownerId) {
                db.run(
                  'INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
                  [projectId, memberId, roleId || 3],
                  async (err) => {
                    if (err) return;
                    await logActivity(projectId, ownerId, 'member', memberId, 'added', { roleId: roleId || 3 });

                    // Envoyer notification par email
                    db.get('SELECT email, notif_added_to_project FROM users WHERE id = ?', [memberId], async (uErr, member) => {
                      if (member && member.notif_added_to_project !== 0) {
                        try {
                          await sendMemberAdded({
                            email: member.email,
                            projectName: title,
                            inviterName: req.user.name,
                            projectId: projectId
                          });
                          await logActivity(projectId, ownerId, 'system', memberId, 'email_sent', { text: `Email de notification envoyé à ${member.email} (Création projet)` });
                        } catch (mErr) {
                          console.error('❌ Erreur mail création projet:', mErr.message);
                          await logActivity(projectId, ownerId, 'system', memberId, 'email_error', { text: `Échec envoi email à ${member.email}: ${mErr.message}` });
                        }
                      }
                    });

                    // Notification dans l'application
                    db.run(
                      'INSERT INTO notifications (user_id, type, title, message, project_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?)',
                      [memberId, 'project_invite', 'Nouveau projet', `Vous avez été ajouté au projet "${title}"`, projectId, ownerId]
                    );
                  }
                );
              }
            }
          }

          res.status(201).json({ id: projectId, title, description, deadline, start_date, owner_id: ownerId, avatar });
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
        
        // Stats and actual task lists should only include sub-tasks
        const actionableTasks = normalizedTasks.filter((task) => task.parent_id != null);
        
        // Find features that are pending (have no sub-tasks)
        const pendingFeatures = normalizedTasks
          .filter((task) => {
            // It's a feature
            const isFeature = task.parent_id == null;
            if (!isFeature) return false;
            
            // Check if it has any children in the current tasks array
            const hasChildren = normalizedTasks.some(child => child.parent_id === task.id);
            return !hasChildren;
          })
          .map((task) => ({
            id: task.id,
            title: task.title,
            priority: task.priority || 'normal'
          }));

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
          return (a.name || '').localeCompare(b.name || '');
        });

        const myTasks = actionableTasks
          .filter((task) => task.assigned_to === userId && (task.status || 'todo') !== 'done')
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

        res.json({
          project,
          stats: {
            total: taskCounts.total,
            done: taskCounts.done,
            in_progress: taskCounts.in_progress,
            todo: taskCounts.todo,
            overdue: taskCounts.overdue,
            completion_rate: completionRate
          },
          features,
          pending_features: pendingFeatures,
          urgent_tasks: urgentTasks,
          my_tasks: myTasks,
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
      
      // Récupérer aussi les invitations en attente
      db.all(`
        SELECT i.id, i.email, r.name as role_name, r.id as role_id, 'pending' as status
        FROM invitations i
        JOIN roles r ON i.role_id = r.id
        WHERE i.project_id = ? AND i.status = 'pending'
      `, [id], (err3, invitations) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ ...project, members, invitations });
      });
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

// POST /projects/:id/members — ajouter un membre (admin/proprio) ou inviter par email
router.post('/:id/members', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const currentUserId = req.user.id;
  const { userId, roleId, email } = req.body || {};

  if (!userId && !email) return res.status(400).json({ error: 'userId ou email requis' });

  canManageMembers(currentUserId, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'Accès refusé' });

    db.get('SELECT title FROM projects WHERE id = ?', [projectId], async (projErr, project) => {
      if (projErr || !project) return res.status(404).json({ error: 'Projet non trouvé' });

      // CAS 1 : On a un userId (l'utilisateur existe déjà et a été sélectionné)
      if (userId) {
        db.run(
          'INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
          [projectId, userId, roleId || 3],
          async function (err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Envoyer email de notification si l'utilisateur l'a activé
            db.get('SELECT email, notif_added_to_project FROM users WHERE id = ?', [userId], async (uErr, user) => {
              if (user && user.notif_added_to_project !== 0) {
                try {
                  await sendMemberAdded({
                    email: user.email,
                    projectName: project.title,
                    inviterName: req.user.name,
                    projectId: projectId
                  });
                  await logActivity(projectId, currentUserId, 'system', userId, 'email_sent', { text: `Email de notification envoyé à ${user.email}` });
                } catch (mailErr) {
                  console.error('❌ Erreur email addition:', mailErr.message);
                  await logActivity(projectId, currentUserId, 'system', userId, 'email_error', { text: `Échec envoi email à ${user.email}: ${mailErr.message}` });
                }
              }
            });

            // Notification dans l'application
            db.run(
              'INSERT INTO notifications (user_id, type, title, message, project_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?)',
              [userId, 'project_invite', 'Invitation au projet', `Vous avez été ajouté au projet "${project.title}"`, projectId, currentUserId]
            );

            await logActivity(projectId, currentUserId, 'member', userId, 'added_or_updated', { roleId: roleId || 3 });
            res.json({ message: 'Membre ajouté et notifié.' });
          }
        );
      } 
      // CAS 2 : On a un email (invitation directe)
      else if (email) {
        // Vérifier si l'utilisateur existe déjà
        db.get('SELECT id FROM users WHERE email = ?', [email], (errSearch, userExists) => {
          if (userExists) {
            // L'utilisateur existe, on l'ajoute directement
            db.run(
              'INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
              [projectId, userExists.id, roleId || 3],
              async function (errAdd) {
                if (errAdd) return res.status(500).json({ error: errAdd.message });
                
                try {
                  await sendMemberAdded({
                    email: email,
                    projectName: project.title,
                    inviterName: req.user.name,
                    projectId: projectId
                  });
                  await logActivity(projectId, currentUserId, 'system', userExists.id, 'email_sent', { text: `Email de notification envoyé à ${email}` });
                } catch (mailErr) {
                  console.error('❌ Erreur email addition:', mailErr.message);
                  await logActivity(projectId, currentUserId, 'system', userExists.id, 'email_error', { text: `Échec envoi email à ${email}: ${mailErr.message}` });
                }

                // Notification interne si déjà inscrit
                db.run(
                  'INSERT INTO notifications (user_id, type, title, message, project_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?)',
                  [userExists.id, 'project_invite', 'Invitation au projet', `Vous avez été ajouté au projet "${project.title}"`, projectId, currentUserId]
                );

                await logActivity(projectId, currentUserId, 'member', userExists.id, 'added', { roleId: roleId || 3 });
                res.json({ message: 'Utilisateur trouvé et ajouté au projet.' });
              }
            );
          } else {
            // L'utilisateur n'existe pas, on crée une invitation
            const token = crypto.randomBytes(32).toString('hex');
            db.run(
              'INSERT INTO invitations (project_id, email, role_id, inviter_id, token) VALUES (?, ?, ?, ?, ?)',
              [projectId, email, roleId || 3, currentUserId, token],
              async function (errInvite) {
                if (errInvite) return res.status(500).json({ error: errInvite.message });
                
                try {
                  await sendProjectInvitation({
                    email: email,
                    projectName: project.title,
                    inviterName: req.user.name,
                    token: token
                  });
                  await logActivity(projectId, currentUserId, 'system', null, 'email_sent', { text: `Email d'invitation envoyé à ${email}` });
                } catch (mailErr) {
                  console.error('❌ Erreur email invitation:', mailErr.message);
                  await logActivity(projectId, currentUserId, 'system', null, 'email_error', { text: `Échec envoi invitation à ${email}: ${mailErr.message}` });
                }

                await logActivity(projectId, currentUserId, 'invitation', null, 'sent', { email, roleId: roleId || 3 });
                res.json({ message: 'Invitation envoyée par email.' });
              }
            );
          }
        });
      }
    });
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
      async function (err) {
        if (err) return res.status(500).json({ error: err.message });
        await logActivity(projectId, currentUserId, 'member', targetUserId, 'role_updated', { roleId });
        res.json({ message: 'Rôle mis à jour' });
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
        async function (err) {
          if (err) return res.status(500).json({ error: err.message });
          await logActivity(projectId, currentUserId, 'member', targetUserId, 'removed');
          res.json({ message: 'Membre retiré' });
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
      async function (err) {
        if (err) return res.status(500).json({ error: err.message });
        await logActivity(projectId, userId, 'project', projectId, 'completed');
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

    db.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, values, async function (err) {
      if (err) return res.status(500).json({ error: err.message });
      await logActivity(projectId, userId, 'project', projectId, 'updated', req.body);
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

// GET /projects/:id/activities — Journal d'activités (Accès restreint aux hauts privilèges)
router.get('/:id/activities', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = req.user.id;

  // Vérifier si l'utilisateur a la permission 'view_activities' (id 6)
  db.get(`
    SELECT pm.role_id, rp.permission_id
    FROM project_members pm
    LEFT JOIN role_permissions rp ON pm.role_id = rp.role_id AND rp.permission_id = 6
    WHERE pm.project_id = ? AND pm.user_id = ?
  `, [projectId, userId], (err, perm) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Si l'utilisateur est le propriétaire (déduit par la table projects) ou a le rôle Admin avec la permission 6
    db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId], (err2, project) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (!project) return res.status(404).json({ error: 'Projet non trouvé' });

      const isOwner = project.owner_id === userId;
      const hasPermission = perm && perm.permission_id === 6;

      if (!isOwner && !hasPermission) {
        return res.status(403).json({ error: 'Accès au journal d\'activités refusé (Hauts droits requis)' });
      }

      db.all(`
        SELECT al.*, COALESCE(u.name, 'Assistant IA') as user_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.project_id = ?
        ORDER BY al.created_at DESC
        LIMIT 100
      `, [projectId], (err3, activities) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json(activities);
      });
    });
  });
});

// --- SHARE LINKS ---

// POST /projects/:id/share-links — créer un lien de partage
router.post('/:id/share-links', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const { roleId } = req.body || {};

  canManageMembers(req.user.id, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'Accès refusé' });

    const token = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // Expire dans une semaine

    db.run(
      'INSERT INTO project_share_links (project_id, role_id, token, expires_at) VALUES (?, ?, ?, ?)',
      [projectId, roleId || 3, token, expiresAt.toISOString()],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, token, expires_at: expiresAt });
      }
    );
  });
});

// GET /projects/:id/share-links — lister les liens de partage
router.get('/:id/share-links', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);

  canManageMembers(req.user.id, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'Accès refusé' });

    db.all(
      'SELECT l.*, r.name as role_name FROM project_share_links l JOIN roles r ON l.role_id = r.id WHERE project_id = ? ORDER BY created_at DESC',
      [projectId],
      (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
      }
    );
  });
});

// DELETE /projects/share-links/:linkId — révoquer un lien
router.delete('/share-links/:linkId', authMiddleware, (req, res) => {
  const linkId = Number(req.params.linkId);
  
  db.get('SELECT project_id FROM project_share_links WHERE id = ?', [linkId], (err, link) => {
    if (err || !link) return res.status(404).json({ error: 'Lien non trouvé' });
    
    canManageMembers(req.user.id, link.project_id, (permErr, perm) => {
      if (permErr || !perm.allowed) return res.status(403).json({ error: 'Accès refusé' });
      
      db.run('DELETE FROM project_share_links WHERE id = ?', [linkId], (errDel) => {
        if (errDel) return res.status(500).json({ error: errDel.message });
        res.json({ message: 'Lien révoqué' });
      });
    });
  });
});

// POST /projects/join/:token (Public) — rejoindre un projet
router.post('/join/:token', authMiddleware, (req, res) => {
  const { token } = req.params;
  const userId = req.user.id;

  db.get('SELECT * FROM project_share_links WHERE token = ?', [token], (err, link) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!link) return res.status(404).json({ error: 'Lien invalide' });

    if (new Date(link.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Ce lien a expiré.' });
    }

    // Ajouter le membre
    db.run(
      'INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
      [link.project_id, userId, link.role_id],
      async function (errJoin) {
        if (errJoin) return res.status(500).json({ error: errJoin.message });
        
        // Notification interne
        db.get('SELECT title, owner_id FROM projects WHERE id = ?', [link.project_id], (pErr, project) => {
          if (project) {
            db.run(
              'INSERT INTO notifications (user_id, type, title, message, project_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?)',
              [userId, 'project_join', 'Projet rejoint', `Vous avez rejoint "${project.title}" via un lien`, link.project_id, project.owner_id]
            );
          }
        });

        await logActivity(link.project_id, userId, 'member', userId, 'joined_via_link');
        res.json({ message: 'Bienvenue dans le projet !', projectId: link.project_id });
      }
    );
  });
});

// DELETE /projects/:id/invitations/:invitationId — révoquer une invitation
router.delete('/:id/invitations/:invitationId', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const invitationId = Number(req.params.invitationId);

  canManageMembers(req.user.id, projectId, (permErr, perm) => {
    if (permErr || !perm.allowed) return res.status(403).json({ error: 'Accès refusé' });
    
    db.run('DELETE FROM invitations WHERE id = ? AND project_id = ?', [invitationId, projectId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Invitation révoquée' });
    });
  });
});

module.exports = router;
