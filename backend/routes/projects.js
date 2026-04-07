const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /projects — mes projets (propriétaire ou membre)
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.all(`
    SELECT DISTINCT p.*, u.name as owner_name,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count
    FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id
    LEFT JOIN project_members pm ON pm.project_id = p.id
    WHERE p.owner_id = ? OR pm.user_id = ?
    ORDER BY p.created_at DESC
  `, [userId, userId], (err, rows) => {
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

      // Ajouter le créateur comme Propriétaire (role id 1)
      db.run('INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)',
        [projectId, ownerId, 1]);

      // Ajouter les autres membres
      if (members && members.length > 0) {
        const stmt = db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)');
        members.forEach(({ userId, roleId }) => stmt.run(projectId, userId, roleId || 3));
        stmt.finalize();
      }

      res.json({ id: projectId, title, description, deadline, owner_id: ownerId });
    }
  );
});

// GET /projects/:id — détails d'un projet
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.get(`
    SELECT p.*, u.name as owner_name FROM projects p
    LEFT JOIN users u ON p.owner_id = u.id WHERE p.id = ?
  `, [id], (err, project) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!project) return res.status(404).json({ error: 'Projet non trouvé' });

    db.all(`
      SELECT u.id, u.name, u.email, r.name as role_name, r.id as role_id
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

module.exports = router;
