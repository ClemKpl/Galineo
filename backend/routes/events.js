const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { ensureProjectActive } = require('../middleware/projectStatus');
const { sendNotificationEmail } = require('../utils/mailer');
const { createNotification } = require('../utils/notifService');

// GET /projects/:projectId/events?month=YYYY-MM
router.get('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { month } = req.query; // e.g. "2026-04"

  // On utilise une approche plus robuste : récupération à plat puis agrégation en JS
  let sql = `
    SELECT 
      e.*, 
      u.name as creator_name,
      u2.id as attendee_id,
      u2.name as attendee_name
    FROM calendar_events e
    LEFT JOIN users u ON e.created_by = u.id
    LEFT JOIN event_attendees ea ON ea.event_id = e.id
    LEFT JOIN users u2 ON ea.user_id = u2.id
    WHERE e.project_id = ?
  `;
  
  const id = Number(projectId);
  const params = [id];

  if (month) {
    sql += ` AND (e.start_datetime LIKE ? OR e.end_datetime LIKE ?)`;
    params.push(`${month}%`, `${month}%`);
  }

  sql += ` ORDER BY e.start_datetime ASC`;

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Agrégation des participants par évènement
    const eventsMap = new Map();
    
    rows.forEach(row => {
      if (!eventsMap.has(row.id)) {
        eventsMap.set(row.id, {
          ...row,
          attendee_ids: [],
          attendee_names: []
        });
        // Retirer les colonnes de jointure temporaires pour l'objet final
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

    res.json(Array.from(eventsMap.values()));
  });
});

// POST /projects/:projectId/events
router.post('/', authMiddleware, ensureProjectActive, (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;
  const { title, description, start_datetime, end_datetime, location, link, attendee_ids } = req.body;

  if (!title || !start_datetime || !end_datetime) {
    return res.status(400).json({ error: 'Titre, date de début et date de fin requis' });
  }

  db.run(
    `INSERT INTO calendar_events (project_id, title, description, start_datetime, end_datetime, location, link, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [Number(projectId), title, description || null, start_datetime, end_datetime, location || null, link || null, userId],
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
                const notifTitle = `Nouvel événement : ${title}`;
                const notifMsg = `Tu as été invité à "${title}" le ${new Date(start_datetime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} dans ${projectTitle}`;
                createNotification({
                  userId: attendeeId,
                  type: 'event_invite',
                  title: notifTitle,
                  message: notifMsg,
                  projectId: projectId,
                  fromUserId: userId
                }).catch(console.error);
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
router.patch('/:id', authMiddleware, ensureProjectActive, (req, res) => {
  const { projectId, id } = req.params;
  const { title, description, start_datetime, end_datetime, location, link, attendee_ids } = req.body;

  db.get(
    `SELECT * FROM calendar_events WHERE id = ? AND project_id = ?`,
    [id, Number(projectId)],
    (err, event) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!event) return res.status(404).json({ error: 'Événement non trouvé' });

      db.run(
        `UPDATE calendar_events SET title = ?, description = ?, start_datetime = ?, end_datetime = ?, location = ?, link = ?
         WHERE id = ? AND project_id = ?`,
        [
          title ?? event.title,
          description !== undefined ? description : event.description,
          start_datetime ?? event.start_datetime,
          end_datetime ?? event.end_datetime,
          location !== undefined ? location : event.location,
          link !== undefined ? link : event.link,
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
router.delete('/:id', authMiddleware, ensureProjectActive, (req, res) => {
  const { projectId, id } = req.params;

  db.run(`DELETE FROM event_attendees WHERE event_id = ?`, [id], () => {
    db.run(
      `DELETE FROM calendar_events WHERE id = ? AND project_id = ?`,
      [id, Number(projectId)],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Événement supprimé' });
      }
    );
  });
});

// GET /projects/:projectId/date-notes?month=YYYY-MM (all notes for a month)
router.get('/date-notes', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { month } = req.query; // e.g. "2025-04"
  if (!month) return res.status(400).json({ error: 'month requis' });
  const start = `${month}-01`;
  const end = `${month}-31`;
  db.all(
    `SELECT n.id, n.date, n.content, n.user_id, u.name as author_name
     FROM calendar_date_notes n
     JOIN users u ON n.user_id = u.id
     WHERE n.project_id = ? AND n.date >= ? AND n.date <= ?
     ORDER BY n.date ASC, n.created_at ASC`,
    [Number(projectId), start, end],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
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
    [Number(projectId), date],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// POST /projects/:projectId/date-notes/:date
router.post('/date-notes/:date', authMiddleware, ensureProjectActive, (req, res) => {
  const { projectId, date } = req.params;
  const userId = req.user.id;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Contenu requis' });
  }

  db.run(
    `INSERT INTO calendar_date_notes (project_id, date, content, user_id) VALUES (?, ?, ?, ?)`,
    [Number(projectId), date, content.trim(), userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, message: 'Note ajoutée' });
    }
  );
});

// DELETE /projects/:projectId/date-notes/:noteId
router.delete('/date-notes/:noteId', authMiddleware, ensureProjectActive, (req, res) => {
  const { projectId, noteId } = req.params;
  const userId = req.user.id;

  db.run(
    `DELETE FROM calendar_date_notes WHERE id = ? AND project_id = ? AND user_id = ?`,
    [noteId, Number(projectId), userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Note non trouvée ou non autorisé' });
      res.json({ message: 'Note supprimée' });
    }
  );
});

module.exports = router;
