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
    WHERE p.owner_id = ? OR pm.user_id = ?
    ORDER BY p.created_at DESC
  `, [userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /projects — créer un projet
router.post('/', authMiddleware, (req, res) => {
  const { title, description, deadline, members } = req.body;
  const ownerId = req.user.id;
  if (!title) return res.status(400).json({ error: 'Titre requis' });

  db.run(
    'INSERT INTO projects (title, description, deadline, owner_id) VALUES (?, ?, ?, ?)',
    [title, description || null, deadline || null, ownerId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const projectId = this.lastID;
      console.log('🚀 Nouveau projet créé avec ID:', projectId);

      // Ajouter le créateur comme Propriétaire (role id 1)
      console.log('👤 Ajout du propriétaire:', { projectId, ownerId, roleId: 1 });
      db.run('INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
        [projectId, ownerId, 1], (errLink) => {
          if (errLink) console.error('❌ Erreur lien propriétaire:', errLink.message);
          else console.log('✅ Propriétaire lié avec succès');
        });

      // Ajouter les autres membres
      if (members && Array.isArray(members)) {
        console.log('👥 Ajout des autres membres:', members.length);
        const stmt = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)');
        members.forEach(({ userId, roleId }) => {
          console.log(' - Membre:', { userId, roleId });
          stmt.run(projectId, userId, roleId || 3);
        });
        stmt.finalize();
      }

      res.status(201).json({ id: projectId, title, description, deadline, owner_id: ownerId });
    }
  );
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

// PATCH /projects/:id — modifier les informations du projet
router.patch('/:id', authMiddleware, (req, res) => {
  const projectId = Number(req.params.id);
  const userId = req.user.id;
  const { title, description, deadline } = req.body;

  canManageMembers(userId, projectId, (permErr, perm) => {
    if (permErr) return res.status(500).json({ error: permErr.message });
    if (!perm.allowed) return res.status(403).json({ error: 'Accès refusé' });

    db.run(
      'UPDATE projects SET title = ?, description = ?, deadline = ? WHERE id = ?',
      [title, description || null, deadline || null, projectId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Projet mis à jour' });
      }
    );
  });
});

// DELETE /projects/:id — supprimer un projet (Propriétaire uniquement)
router.delete('/:id', authMiddleware, (req, res) => {
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
      // Supprimer aussi les membres (normalement géré par CASCADE mais on assure le coup)
      db.run('DELETE FROM project_members WHERE project_id = ?', [projectId]);
      res.json({ message: 'Projet supprimé' });
    });
  });
});

module.exports = router;
