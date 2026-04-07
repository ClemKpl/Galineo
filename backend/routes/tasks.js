const express = require('express');
const router = express.Router({ mergeParams: true }); // Permet d'utiliser /projects/:projectId/tasks
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /projects/:projectId/tasks — Liste des tâches
router.get('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  
  db.all(`
    SELECT t.*, u1.name as creator_name, u2.name as assignee_name
    FROM tasks t
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.assigned_to = u2.id
    WHERE t.project_id = ?
    ORDER BY t.created_at ASC
  `, [projectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /projects/:projectId/tasks — Créer une tâche
router.post('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { title, description, parent_id, phase, priority, start_date, due_date, assigned_to } = req.body;
  const createdBy = req.user.id;

  if (!title) return res.status(400).json({ error: 'Titre de la tâche requis' });

  db.run(`
    INSERT INTO tasks (project_id, parent_id, title, description, phase, priority, start_date, due_date, created_by, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    projectId, parent_id || null, title, description || null, phase || null, 
    priority || 'normal', start_date || null, due_date || null, createdBy, assigned_to || null
  ], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, ...req.body, project_id: projectId });
  });
});

// PATCH /projects/:projectId/tasks/:id — Modifier une tâche
router.patch('/:id', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  const updates = [];
  const values = [];

  const fields = ['title', 'description', 'status', 'priority', 'phase', 'start_date', 'due_date', 'assigned_to', 'parent_id'];
  
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  });

  if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à modifier' });

  values.push(id, projectId);

  db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`, values, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tâche modifiée' });
  });
});

// DELETE /projects/:projectId/tasks/:id — Supprimer une tâche
router.delete('/:id', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  db.run('DELETE FROM tasks WHERE id = ? AND project_id = ?', [id, projectId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tâche supprimée' });
  });
});

module.exports = router;
