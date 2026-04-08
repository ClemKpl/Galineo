const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /events/upcoming — Events where current user is an attendee, in the future
// Also triggers notifications for events happening within 24h
router.get('/upcoming', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const now = new Date().toISOString();
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  db.all(
    `SELECT e.*, p.title as project_title, u.name as creator_name,
      (SELECT GROUP_CONCAT(u2.name) FROM event_attendees ea2 JOIN users u2 ON ea2.user_id = u2.id WHERE ea2.event_id = e.id) as attendee_names,
      (SELECT COUNT(*) FROM event_attendees ea3 WHERE ea3.event_id = e.id) as attendee_count
     FROM calendar_events e
    JOIN projects p ON p.id = e.project_id
    JOIN event_attendees ea ON ea.event_id = e.id
    LEFT JOIN users u ON e.created_by = u.id
    WHERE ea.user_id = ? AND e.start_datetime >= ?
    ORDER BY e.start_datetime ASC
    LIMIT 10
  `, [userId, now], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const events = rows || [];

      // Send notifications for events within 24h that haven't been notified yet
      const soonEvents = events.filter(
        (e) => e.start_datetime >= now && e.start_datetime <= in24h
      );

      if (soonEvents.length > 0) {
        db.all(
          `SELECT ea.event_id FROM event_attendees ea
           JOIN notifications n ON n.type = 'event_reminder' AND n.task_id = ea.event_id AND n.user_id = ?
           WHERE ea.user_id = ?`,
          [userId, userId],
          (nErr, alreadyNotified) => {
            const notifiedIds = new Set((alreadyNotified || []).map((r) => r.event_id));

            for (const event of soonEvents) {
              if (!notifiedIds.has(event.id)) {
                const startDate = new Date(event.start_datetime);
                const timeStr = startDate.toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                db.run(
                  `INSERT INTO notifications (user_id, type, title, message, project_id, task_id)
                   VALUES (?, 'event_reminder', ?, ?, ?, ?)`,
                  [
                    userId,
                    `Rappel : ${event.title}`,
                    `L'événement "${event.title}" commence le ${timeStr} dans ${event.project_title}`,
                    event.project_id,
                    event.id,
                  ],
                  () => {}
                );
              }
            }
          }
        );
      }

      res.json(events);
    }
  );
});

module.exports = router;
