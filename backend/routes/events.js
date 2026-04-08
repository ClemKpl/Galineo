const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

// GET /projects/:projectId/events?month=YYYY-MM
router.get('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { month } = req.query; // e.g. "2026-04"

  let sql = `
    SELECT e.*, u.name as creator_name,
      (SELECT GROUP_CONCAT(ea.user_id) FROM event_attendees ea WHERE ea.event_id = e.id) as attendee_ids,
      (SELECT GROUP_CONCAT(u2.name) FROM event_attendees ea2 JOIN users u2 ON ea2.user_id = u2.id WHERE ea2.event_id = e.id) as attendee_names
    FROM calendar_events e
    LEFT JOIN users u ON e.created_by = u.id
    WHERE e.project_id = ?
  `;
  const params = [projectId];

  if (month) {
    sql += ` AND (e.start_datetime LIKE ? OR e.end_datetime LIKE ?)`;
    params.push(`${month}%`, `${month}%`);
  }

  sql += ` ORDER BY e.start_datetime ASC`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const events = (rows || []).map((row) => ({
      ...row,
      attendee_ids: row.attendee_ids ? row.attendee_ids.split(',').map(Number) : [],
      attendee_names: row.attendee_names ? row.attendee_names.split(',') : [],
    }));
    res.json(events);
  });
});

// POST /projects/:projectId/events
router.post('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;
  const { title, description, start_datetime, end_datetime, location, attendee_ids } = req.body;

  if (!title || !start_datetime || !end_datetime) {
    return res.status(400).json({ error: 'Titre, date de début et date de fin requis' });
  }

  db.run(
    `INSERT INTO calendar_events (project_id, title, description, start_datetime, end_datetime, location, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectId, title, description || null, start_datetime, end_datetime, location || null, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const eventId = this.lastID;

      const attendees = Array.isArray(attendee_ids) ? attendee_ids : [];

      // Always add creator as attendee
      if (!attendees.includes(userId)) attendees.push(userId);

      if (attendees.length === 0) {
        return res.status(201).json({ id: eventId, message: 'Événement créé' });
      }

      // Get project title for notification
      db.get(`SELECT title FROM projects WHERE id = ?`, [projectId], (pErr, project) => {
        const projectTitle = project ? project.title : 'Projet';

        let done = 0;
        for (const attendeeId of attendees) {
          db.run(
            `INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)`,
            [eventId, attendeeId],
            () => {
              // Notify attendee (except creator who already knows)
              if (attendeeId !== userId) {
                db.run(
                  `INSERT INTO notifications (user_id, type, title, message, project_id, from_user_id)
                   VALUES (?, 'event_invite', ?, ?, ?, ?)`,
                  [
                    attendeeId,
                    `Nouvel événement : ${title}`,
                    `Tu as été invité à "${title}" le ${new Date(start_datetime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} dans ${projectTitle}`,
                    projectId,
                    userId,
                  ],
                  () => {}
                );
              }
              done++;
              if (done === attendees.length) {
                res.status(201).json({ id: eventId, message: 'Événement créé' });
              }
            }
          );
        }
      });
    }
  );
});

// PATCH /projects/:projectId/events/:id
router.patch('/:id', authMiddleware, (req, res) => {
  const { projectId, id } = req.params;
  const { title, description, start_datetime, end_datetime, location, attendee_ids } = req.body;

  db.get(
    `SELECT * FROM calendar_events WHERE id = ? AND project_id = ?`,
    [id, projectId],
    (err, event) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!event) return res.status(404).json({ error: 'Événement non trouvé' });

      db.run(
        `UPDATE calendar_events SET title = ?, description = ?, start_datetime = ?, end_datetime = ?, location = ?
         WHERE id = ? AND project_id = ?`,
        [
          title ?? event.title,
          description !== undefined ? description : event.description,
          start_datetime ?? event.start_datetime,
          end_datetime ?? event.end_datetime,
          location !== undefined ? location : event.location,
          id,
          projectId,
        ],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: updateErr.message });

          if (Array.isArray(attendee_ids)) {
            db.run(`DELETE FROM event_attendees WHERE event_id = ?`, [id], () => {
              const allAttendees = attendee_ids.includes(event.created_by)
                ? attendee_ids
                : [...attendee_ids, event.created_by];

              let done = 0;
              if (allAttendees.length === 0) return res.json({ message: 'Événement mis à jour' });
              for (const uid of allAttendees) {
                db.run(
                  `INSERT OR IGNORE INTO event_attendees (event_id, user_id) VALUES (?, ?)`,
                  [id, uid],
                  () => {
                    done++;
                    if (done === allAttendees.length) res.json({ message: 'Événement mis à jour' });
                  }
                );
              }
            });
          } else {
            res.json({ message: 'Événement mis à jour' });
          }
        }
      );
    }
  );
});

// DELETE /projects/:projectId/events/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const { projectId, id } = req.params;

  db.run(`DELETE FROM event_attendees WHERE event_id = ?`, [id], () => {
    db.run(
      `DELETE FROM calendar_events WHERE id = ? AND project_id = ?`,
      [id, projectId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Événement supprimé' });
      }
    );
  });
});

// GET /projects/:projectId/date-notes/:date
router.get('/date-notes/:date', authMiddleware, (req, res) => {
  const { projectId, date } = req.params;

  db.all(
    `SELECT n.*, u.name as author_name
     FROM calendar_date_notes n
     JOIN users u ON n.user_id = u.id
     WHERE n.project_id = ? AND n.date = ?
     ORDER BY n.created_at ASC`,
    [projectId, date],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// POST /projects/:projectId/date-notes/:date
router.post('/date-notes/:date', authMiddleware, (req, res) => {
  const { projectId, date } = req.params;
  const userId = req.user.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Contenu requis' });
  }

  db.run(
    `INSERT INTO calendar_date_notes (project_id, date, content, user_id) VALUES (?, ?, ?, ?)`,
    [projectId, date, content.trim(), userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Note ajoutée' });
    }
  );
});

// DELETE /projects/:projectId/date-notes/:noteId
router.delete('/date-notes/:noteId', authMiddleware, (req, res) => {
  const { projectId, noteId } = req.params;
  const userId = req.user.id;

  db.run(
    `DELETE FROM calendar_date_notes WHERE id = ? AND project_id = ? AND user_id = ?`,
    [noteId, projectId, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée ou non autorisé' });
      res.json({ message: 'Note supprimée' });
    }
  );
});

module.exports = router;
