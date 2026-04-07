const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /projects/:projectId/messages — Liste des messages du projet
router.get('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  
  db.all(`
    SELECT m.*, u.name as author_name, u.avatar
    FROM messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.project_id = ?
    ORDER BY m.created_at ASC
  `, [projectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /projects/:projectId/messages — Poster un message
router.post('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content || !content.trim()) return res.status(400).json({ error: 'Message vide' });

  // 1. Sauvegarder le message
  db.run(`
    INSERT INTO messages (project_id, user_id, content)
    VALUES (?, ?, ?)
  `, [projectId, userId, content], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const messageId = this.lastID;
    
    // Pour la V1, on gère les mentions de façon simple : 
    // le front enverra une regex, mais l'idéal en V2 serait de parser le contenu backend
    // et insérer dans une table 'notifications'.
    res.json({ id: messageId, project_id: projectId, user_id: userId, content, author_name: req.user.name });
  });
});

module.exports = router;
