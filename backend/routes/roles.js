const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /roles — liste des rôles
router.get('/', authMiddleware, (req, res) => {
  db.all('SELECT * FROM roles ORDER BY is_default DESC, id ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /roles/permissions — liste des permissions
router.get('/permissions', authMiddleware, (req, res) => {
  db.all('SELECT * FROM permissions', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /roles — créer un rôle custom
router.post('/', authMiddleware, (req, res) => {
  const { name, permissionIds } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom du rôle requis' });

  db.run('INSERT INTO roles (name, is_default) VALUES (?, 0)', [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const roleId = this.lastID;

    if (permissionIds && permissionIds.length > 0) {
      const stmt = db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      permissionIds.forEach((pid) => stmt.run(roleId, pid));
      stmt.finalize();
    }

    res.json({ id: roleId, name, is_default: 0 });
  });
});

module.exports = router;
