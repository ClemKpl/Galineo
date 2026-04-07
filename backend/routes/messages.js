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

  db.run(`
    INSERT INTO messages (project_id, user_id, content)
    VALUES (?, ?, ?)
  `, [projectId, userId, content], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const messageId = this.lastID;

    // Parse @mentions and create notifications
    const mentions = content.match(/@([a-zA-Z0-9_]+)/g);
    if (mentions && mentions.length > 0) {
      const mentionNames = mentions.map(m => m.substring(1).toLowerCase());
      db.all(`
        SELECT u.id, u.name FROM users u
        JOIN project_members pm ON pm.user_id = u.id
        WHERE pm.project_id = ? AND u.id != ?
      `, [projectId, userId], (memberErr, members) => {
        if (!memberErr && members) {
          members.forEach(member => {
            if (mentionNames.includes(member.name.toLowerCase())) {
              db.run(`
                INSERT INTO notifications (user_id, type, title, message, project_id, from_user_id)
                VALUES (?, 'mention', ?, ?, ?, ?)
              `, [
                member.id,
                'Vous avez ete mentionne',
                req.user.name + ' vous a mentionne dans la discussion',
                projectId,
                userId
              ]);
            }
          });
        }
      });
    }

    res.json({ id: messageId, project_id: projectId, user_id: userId, content, author_name: req.user.name });
  });
});

// PATCH /projects/:projectId/messages/:id — Modifier un message
router.patch('/:id', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  
  if (!content || !content.trim()) return res.status(400).json({ error: 'Message vide' });

  db.run(`
    UPDATE messages 
    SET content = ? 
    WHERE id = ? AND project_id = ? AND user_id = ?
  `, [content, id, projectId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(403).json({ error: 'Non autorise ou message introuvable' });
    res.json({ message: 'Message modifie', content });
  });
});

// DELETE /projects/:projectId/messages/:id — Supprimer un message
router.delete('/:id', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user.id;

  db.run(`
    DELETE FROM messages 
    WHERE id = ? AND project_id = ? AND user_id = ?
  `, [id, projectId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(403).json({ error: 'Non autorise ou message introuvable' });
    res.json({ message: 'Message supprime' });
  });
});

module.exports = router;
