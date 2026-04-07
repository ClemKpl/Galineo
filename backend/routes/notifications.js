const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /notifications — Get all notifications for the current user
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  
  db.all(`
    SELECT n.*, u.name as from_user_name, p.title as project_title
    FROM notifications n
    LEFT JOIN users u ON n.from_user_id = u.id
    LEFT JOIN projects p ON n.project_id = p.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /notifications/unread-count — Get unread count
router.get('/unread-count', authMiddleware, (req, res) => {
  const userId = req.user.id;
  
  db.get(`SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`, [userId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: row.count });
  });
});

// PATCH /notifications/:id/read — Mark one notification as read
router.patch('/:id/read', authMiddleware, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  db.run(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, [id, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Notification lue' });
  });
});

// PATCH /notifications/read-all — Mark all notifications as read
router.patch('/read-all', authMiddleware, (req, res) => {
  const userId = req.user.id;
  
  db.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, [userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Toutes les notifications ont été marquées comme lues', count: this.changes });
  });
});

// DELETE /notifications/:id — Delete a notification
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  db.run(`DELETE FROM notifications WHERE id = ? AND user_id = ?`, [id, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Notification supprimée' });
  });
});

module.exports = router;
