const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { sendNotificationEmail } = require('../utils/mailer');
const { createNotification } = require('../utils/notifService');

// Middleware pour verifier si l'utilisateur est membre du groupe
function memberMiddleware(req, res, next) {
  const groupId = req.params.groupId || req.params.id;
  const userId = req.user.id;

  db.get('SELECT role FROM chat_group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], (err, member) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!member) return res.status(403).json({ error: 'Vous ne faites pas partie de ce groupe' });
    req.groupRole = member.role;
    next();
  });
}

// Middleware pour verifier si l'utilisateur est ADMIN du groupe
function adminMiddleware(req, res, next) {
  if (req.groupRole === 'admin') return next();
  res.status(403).json({ error: 'Droits administrateur requis' });
}

// GET /chat-groups — Liste des groupes de l'utilisateur
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.all(`
    SELECT g.*, gm.role,
      (SELECT COUNT(*) FROM chat_group_members WHERE group_id = g.id) as member_count
    FROM chat_groups g
    JOIN chat_group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY g.created_at DESC
  `, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /chat-groups — Creer un groupe
router.post('/', authMiddleware, (req, res) => {
  const { title, description, avatar, initialMembers } = req.body;
  const userId = req.user.id;

  if (!title) return res.status(400).json({ error: 'Titre requis' });

  db.run(`
    INSERT INTO chat_groups (title, description, avatar, created_by)
    VALUES (?, ?, ?, ?)
  `, [title, description || null, avatar || null, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const groupId = this.lastID;

    // Ajouter le createur comme admin
    db.run(`
      INSERT INTO chat_group_members (group_id, user_id, role)
      VALUES (?, ?, 'admin')
    `, [groupId, userId], (errMember) => {
      if (errMember) console.error('Error adding group creator:', errMember.message);

      // Ajouter les membres initiaux
      if (initialMembers && Array.isArray(initialMembers)) {
        const stmt = db.prepare('INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role) VALUES (?, ?, ?)');
        initialMembers.forEach(mId => {
          if (mId !== userId) {
            stmt.run(groupId, mId, 'member');
            const notifMsg = `${req.user.name} vous a ajouté au groupe "${title}"`;
            createNotification({
              userId: mId,
              type: 'group_added',
              title: 'Nouveau groupe de discussion',
              message: notifMsg,
              groupId: groupId,
              fromUserId: userId
            }).catch(console.error);
          }
        });
        stmt.finalize();
      }

      res.status(201).json({ id: groupId, title, description, avatar });
    });
  });
});

// GET /chat-groups/:id — Details du groupe (incluant membres)
router.get('/:id', authMiddleware, memberMiddleware, (req, res) => {
  const groupId = req.params.id;
  db.get('SELECT * FROM chat_groups WHERE id = ?', [groupId], (err, group) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.all(`
      SELECT u.id, u.name, u.email, u.avatar, gm.role, gm.joined_at
      FROM chat_group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = ?
      ORDER BY gm.role DESC, u.name ASC
    `, [groupId], (errMembers, members) => {
      if (errMembers) return res.status(500).json({ error: errMembers.message });
      res.json({ ...group, members, myRole: req.groupRole });
    });
  });
});

// PATCH /chat-groups/:id — Modifier le groupe (admin)
router.patch('/:id', authMiddleware, memberMiddleware, adminMiddleware, (req, res) => {
  const groupId = req.params.id;
  const { title, description, avatar } = req.body;

  const updates = [];
  const params = [];
  if (title) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }

  if (updates.length === 0) return res.status(400).json({ error: 'Aucune donnee a modifier' });
  params.push(groupId);

  db.run(`UPDATE chat_groups SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Groupe mis a jour' });
  });
});

// POST /chat-groups/:id/members — Ajouter un membre
router.post('/:id/members', authMiddleware, memberMiddleware, adminMiddleware, (req, res) => {
  const groupId = req.params.id;
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId requis' });

  db.run(`
    INSERT OR IGNORE INTO chat_group_members (group_id, user_id, role)
    VALUES (?, ?, 'member')
  `, [groupId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Notification pour le membre ajouté
    db.get('SELECT title FROM chat_groups WHERE id = ?', [groupId], (errGroup, group) => {
      if (!errGroup && group) {
        const notifMsg = `${req.user.name} vous a ajouté au groupe "${group.title}"`;
        createNotification({
          userId: userId,
          type: 'group_added',
          title: 'Ajouté à un groupe',
          message: notifMsg,
          groupId: Number(groupId),
          fromUserId: req.user.id
        }).catch(console.error);
      }
    });

    res.json({ message: 'Membre ajoute' });
  });
});

// DELETE /chat-groups/:id/members/:userId — Retirer un membre
router.delete('/:id/members/:userId', authMiddleware, memberMiddleware, adminMiddleware, (req, res) => {
  const { id: groupId, userId } = req.params;
  
  db.run(`
    DELETE FROM chat_group_members 
    WHERE group_id = ? AND user_id = ? AND role != 'admin'
  `, [groupId, userId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(400).json({ error: 'Impossible de retirer ce membre (peut-etre un admin)' });
    res.json({ message: 'Membre retire' });
  });
});

// GET /chat-groups/:id/messages — Messages du groupe
router.get('/:id/messages', authMiddleware, memberMiddleware, (req, res) => {
  const groupId = req.params.id;
  db.all(`
    SELECT m.*, u.name as author_name, u.avatar as author_avatar
    FROM chat_group_messages m
    JOIN users u ON m.user_id = u.id
    WHERE m.group_id = ?
    ORDER BY m.created_at ASC
  `, [groupId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /chat-groups/:id/messages — Poster un message
router.post('/:id/messages', authMiddleware, memberMiddleware, (req, res) => {
  const groupId = req.params.id;
  const { content, attachment_url, attachment_name, attachment_type } = req.body;
  const userId = req.user.id;

  if ((!content || !content.trim()) && !attachment_url) return res.status(400).json({ error: 'Message vide' });

  db.run(`
    INSERT INTO chat_group_messages (group_id, user_id, content, attachment_url, attachment_name, attachment_type)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [groupId, userId, content || '', attachment_url || null, attachment_name || null, attachment_type || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const messageId = this.lastID;

    // TODO: Mentions notifications if needed (similar to messages.js but global)
    const mentions = content.match(/@([a-zA-Z0-9_]+)/g);
    if (mentions && mentions.length > 0) {
      const mentionNames = mentions.map(m => m.substring(1).toLowerCase());
      db.all(`SELECT id, name FROM users WHERE id != ?`, [userId], (errUsers, users) => {
        if (!errUsers && users) {
          users.forEach(u => {
            if (mentionNames.includes(u.name.toLowerCase())) {
              const notifMsg = req.user.name + ' vous a mentionné dans un groupe de discussion';
              createNotification({
                userId: u.id,
                type: 'mention',
                title: 'Mention dans un groupe',
                message: notifMsg,
                groupId: Number(groupId),
                fromUserId: userId
              }).catch(console.error);
            }
          });
        }
      });
    }

    res.json({
      id: messageId,
      group_id: groupId,
      user_id: userId,
      content: content || '',
      attachment_url: attachment_url || null,
      attachment_name: attachment_name || null,
      attachment_type: attachment_type || null,
      author_name: req.user.name,
      author_avatar: req.user.avatar,
      created_at: new Date().toISOString()
    });
  });
});

// POST /chat-groups/:id/leave — Quitter le groupe
router.post('/:id/leave', authMiddleware, memberMiddleware, (req, res) => {
  const groupId = req.params.id;
  const userId = req.user.id;

  // Verifier si c'est le dernier admin
  db.all('SELECT user_id, role FROM chat_group_members WHERE group_id = ?', [groupId], (err, members) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const admins = members.filter(m => m.role === 'admin');
    const isMeAdmin = admins.some(a => a.user_id === userId);

    if (isMeAdmin && admins.length === 1 && members.length > 1) {
      return res.status(400).json({ error: 'Vous êtes le dernier administrateur. Nommez un autre admin avant de partir.' });
    }

    db.run('DELETE FROM chat_group_members WHERE group_id = ? AND user_id = ?', [groupId, userId], function(errDel) {
      if (errDel) return res.status(500).json({ error: errDel.message });
      res.json({ message: 'Vous avez quitte le groupe' });
    });
  });
});

// DELETE /chat-groups/:id — Supprimer le groupe (admin)
router.delete('/:id', authMiddleware, memberMiddleware, adminMiddleware, (req, res) => {
  const groupId = req.params.id;

  // Supprimer dans l'ordre pour respecter (potentiellement) les contraintes
  db.serialize(() => {
    db.run('DELETE FROM chat_group_messages WHERE group_id = ?', [groupId]);
    db.run('DELETE FROM chat_group_members WHERE group_id = ?', [groupId]);
    db.run('DELETE FROM chat_groups WHERE id = ?', [groupId], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Groupe supprime definitivement' });
    });
  });
});

module.exports = router;
