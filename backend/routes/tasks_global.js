const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /tasks/assigned — tâches assignées à moi (tous projets)
router.get('/assigned', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.all(
    `
      SELECT
        t.*,
        p.title AS project_title,
        p.id AS project_id,
        u1.name as creator_name,
        u2.name as assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u1 ON t.created_by = u1.id
      LEFT JOIN users u2 ON t.assigned_to = u2.id
      WHERE t.assigned_to = ?
        AND p.status = 'active'
      ORDER BY
        CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
        t.due_date ASC,
        t.created_at DESC
    `,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

module.exports = router;

