const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { projectMemberMiddleware } = require('../middleware/projectMember');

const dbGet = (sql, p) => new Promise((res, rej) => db.get(sql, p, (e, r) => e ? rej(e) : res(r)));
const dbAll = (sql, p) => new Promise((res, rej) => db.all(sql, p, (e, r) => e ? rej(e) : res(r)));
const dbRun = (sql, p) => new Promise((res, rej) => db.run(sql, p, function(e) { e ? rej(e) : res({ lastID: this.lastID }); }));

// GET /projects/:projectId/milestones
router.get('/', authMiddleware, projectMemberMiddleware, async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT * FROM milestones WHERE project_id = ? ORDER BY date ASC',
      [req.params.projectId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /projects/:projectId/milestones
router.post('/', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { title, date, color } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Titre et date requis.' });
  try {
    const result = await dbRun(
      'INSERT INTO milestones (project_id, title, date, color) VALUES (?, ?, ?, ?)',
      [req.params.projectId, title, date, color || '#f97316']
    );
    const row = await dbGet('SELECT * FROM milestones WHERE id = ?', [result.lastID]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /projects/:projectId/milestones/:id
router.patch('/:id', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { title, date, color } = req.body;
  const fields = []; const params = [];
  if (title) { fields.push('title = ?'); params.push(title); }
  if (date)  { fields.push('date = ?');  params.push(date); }
  if (color) { fields.push('color = ?'); params.push(color); }
  if (fields.length === 0) return res.status(400).json({ error: 'Aucun champ à modifier.' });
  params.push(req.params.id, req.params.projectId);
  try {
    await dbRun(`UPDATE milestones SET ${fields.join(', ')} WHERE id = ? AND project_id = ?`, params);
    const row = await dbGet('SELECT * FROM milestones WHERE id = ?', [req.params.id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /projects/:projectId/milestones/:id
router.delete('/:id', authMiddleware, projectMemberMiddleware, async (req, res) => {
  try {
    await dbRun('DELETE FROM milestones WHERE id = ? AND project_id = ?', [req.params.id, req.params.projectId]);
    res.json({ message: 'Jalon supprimé.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
