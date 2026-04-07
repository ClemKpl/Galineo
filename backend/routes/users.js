const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /users/search?q= — rechercher des utilisateurs
router.get('/search', authMiddleware, (req, res) => {
  const { q } = req.query;
  const userId = req.user.id;
  if (!q || q.trim().length < 1) return res.json([]);

  db.all(
    'SELECT id, name, email FROM users WHERE (name LIKE ? OR email LIKE ?) AND id != ? LIMIT 10',
    [`%${q}%`, `%${q}%`, userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET /users — liste de tous les utilisateurs
router.get('/', authMiddleware, (req, res) => {
  db.all('SELECT id, name, email, created_at FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

module.exports = router;
