const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /events/upcoming — Prochains événements de l'utilisateur
router.get('/upcoming', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const now = new Date().toISOString();
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // On récupère les événements à plat pour agréger les participants en JS
  const sql = `
    SELECT 
      e.*, 
      p.title as project_title,
      u.name as creator_name,
      u2.id as attendee_id,
      u2.name as attendee_name
    FROM calendar_events e
    JOIN projects p ON p.id = e.project_id
    JOIN event_attendees ea ON ea.event_id = e.id
    LEFT JOIN users u ON e.created_by = u.id
    LEFT JOIN event_attendees ea2 ON ea2.event_id = e.id
    LEFT JOIN users u2 ON ea2.user_id = u2.id
    WHERE ea.user_id = ? AND e.start_datetime >= ?
    ORDER BY e.start_datetime ASC
  `;

  db.all(sql, [userId, now], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const eventsMap = new Map();
    rows.forEach(row => {
      if (!eventsMap.has(row.id)) {
        eventsMap.set(row.id, {
          ...row,
          attendee_ids: [],
          attendee_names: []
        });
        delete eventsMap.get(row.id).attendee_id;
        delete eventsMap.get(row.id).attendee_name;
      }
      const ev = eventsMap.get(row.id);
      if (row.attendee_id) {
        if (!ev.attendee_ids.includes(row.attendee_id)) {
          ev.attendee_ids.push(row.attendee_id);
          ev.attendee_names.push(row.attendee_name);
        }
      }
    });

    const events = Array.from(eventsMap.values());

    // Notifications de rappel pour les événements dans les prochaines 24h
    const soonEvents = events.filter(e => e.start_datetime <= in24h);

    if (soonEvents.length > 0) {
      // Pour éviter les doublons de notifications, on pourrait vérifier mais ici on renvoie juste les datas
      // et le frontend peut gérer ou on ajoute une colonne notified dans event_attendees
    }

    res.json(events.slice(0, 10));
  });
});

module.exports = router;
