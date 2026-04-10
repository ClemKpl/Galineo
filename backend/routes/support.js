const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { sendSupportNotification, sendSupportReplyNotification } = require('../utils/mailer');
const { ADMIN_EMAILS } = require('../config/admins');

function isAdmin(user) {
  return ADMIN_EMAILS.includes(user.email?.toLowerCase());
}

// POST /support — Soumettre un ticket
router.post('/', authMiddleware, (req, res) => {
  const { subject, message } = req.body;
  const userId = req.user.id;

  if (!subject?.trim() || !message?.trim())
    return res.status(400).json({ error: 'Sujet et message requis' });

  db.get('SELECT plan, email, name FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });

    const priority = (user?.plan === 'premium' || user?.plan === 'unlimited') ? 'high' : 'normal';

    db.run(
      'INSERT INTO support_tickets (user_id, subject, message, priority) VALUES (?, ?, ?, ?)',
      [userId, subject.trim(), message.trim(), priority],
      function (insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });

        const ticketId = this.lastID;

        // Notifier les admins par email
        sendSupportNotification({
          ticketId,
          subject: subject.trim(),
          message: message.trim(),
          userName: user?.name,
          userEmail: user?.email,
          priority,
        }).catch(() => {});

        res.json({ id: ticketId, message: 'Ticket soumis avec succès' });
      }
    );
  });
});

// GET /support — Tickets de l'utilisateur connecté
router.get('/', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.all(
    'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// GET /support/admin — Tous les tickets (admin uniquement)
router.get('/admin', authMiddleware, (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Accès refusé' });

  db.all(
    `SELECT t.*, u.name as user_name, u.email as user_email, u.plan as user_plan
     FROM support_tickets t
     JOIN users u ON t.user_id = u.id
     ORDER BY CASE WHEN t.priority = 'high' THEN 0 ELSE 1 END, t.created_at DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// PATCH /support/admin/:id — Répondre ou changer le statut (admin uniquement)
router.patch('/admin/:id', authMiddleware, (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Accès refusé' });

  const { id } = req.params;
  const { admin_reply, status } = req.body;

  const updates = [];
  const values = [];

  if (admin_reply !== undefined) {
    updates.push('admin_reply = ?', 'replied_at = CURRENT_TIMESTAMP');
    values.push(admin_reply);
  }
  if (status) {
    updates.push('status = ?');
    values.push(status);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Rien à mettre à jour' });

  values.push(id);

  db.run(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`, values, function (err) {
    if (err) return res.status(500).json({ error: err.message });

    // Si réponse admin, notifier l'utilisateur par email
    if (admin_reply) {
      db.get(
        `SELECT t.subject, u.email, u.name FROM support_tickets t JOIN users u ON t.user_id = u.id WHERE t.id = ?`,
        [id],
        (e2, ticket) => {
          if (!e2 && ticket) {
            sendSupportReplyNotification({
              userEmail: ticket.email,
              userName: ticket.name,
              subject: ticket.subject,
              reply: admin_reply,
            }).catch(() => {});
          }
        }
      );
    }

    res.json({ message: 'Ticket mis à jour' });
  });
});
 
// DELETE /support/admin/:id — Supprimer un ticket (admin uniquement)
router.delete('/admin/:id', authMiddleware, (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Accès refusé' });
  const { id } = req.params;

  db.run('DELETE FROM support_tickets WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Ticket supprimé avec succès' });
  });
});

module.exports = router;
