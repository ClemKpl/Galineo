const express = require('express');
const router = express.Router({ mergeParams: true }); // Permet d'utiliser /projects/:projectId/tasks
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function parseCsv(csvText) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(current);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += char;
    }
  }

  if (current !== '' || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell !== '')) rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || '').trim();
    });
    return record;
  });
}

// GET /projects/:projectId/tasks — Liste des tâches
router.get('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  
  db.all(`
    SELECT t.*, u1.name as creator_name, u2.name as assignee_name
    FROM tasks t
    LEFT JOIN users u1 ON t.created_by = u1.id
    LEFT JOIN users u2 ON t.assigned_to = u2.id
    WHERE t.project_id = ?
    ORDER BY t.created_at ASC
  `, [projectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /projects/:projectId/tasks — Créer une tâche
// GET /projects/:projectId/tasks/:id/comments â€” Historique / commentaires d'avancement
router.get('/export', authMiddleware, (req, res) => {
  const { projectId } = req.params;

  db.all(`
    SELECT
      t.*,
      parent.title as parent_title,
      assignee.email as assignee_email
    FROM tasks t
    LEFT JOIN tasks parent ON parent.id = t.parent_id
    LEFT JOIN users assignee ON assignee.id = t.assigned_to
    WHERE t.project_id = ?
    ORDER BY CASE WHEN t.parent_id IS NULL THEN 0 ELSE 1 END, t.parent_id ASC, t.created_at ASC
  `, [projectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const csvRows = [[
      'type',
      'title',
      'description',
      'status',
      'priority',
      'phase',
      'start_date',
      'due_date',
      'assigned_email',
      'parent_title'
    ].join(',')];

    rows.forEach((task) => {
      csvRows.push([
        task.parent_id ? 'task' : 'feature',
        csvEscape(task.title),
        csvEscape(task.description),
        csvEscape(task.status),
        csvEscape(task.priority),
        csvEscape(task.phase),
        csvEscape(task.start_date),
        csvEscape(task.due_date),
        csvEscape(task.assignee_email),
        csvEscape(task.parent_title),
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}-tasks.csv"`);
    res.send(csvRows.join('\n'));
  });
});

router.post('/import', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { csv } = req.body || {};
  const createdBy = req.user.id;

  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'CSV requis' });
  }

  const records = parseCsv(csv);
  if (records.length === 0) {
    return res.status(400).json({ error: 'Aucune ligne importable' });
  }

  const featureRows = records.filter((record) => (record.type || 'task').toLowerCase() === 'feature');
  const taskRows = records.filter((record) => (record.type || 'task').toLowerCase() !== 'feature');
  const featureIdByTitle = {};
  let createdCount = 0;

  db.all('SELECT id, email FROM users', [], (usersErr, users) => {
    if (usersErr) return res.status(500).json({ error: usersErr.message });

    const userIdByEmail = {};
    (users || []).forEach((user) => {
      if (user.email) userIdByEmail[String(user.email).toLowerCase()] = user.id;
    });

    const createTaskRecord = (record, parentId, done) => {
      if (!record.title) return done();

      db.run(`
        INSERT INTO tasks (project_id, parent_id, title, description, status, priority, phase, start_date, due_date, created_by, assigned_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        projectId,
        parentId || null,
        record.title,
        record.description || null,
        record.status || 'todo',
        record.priority || 'normal',
        record.phase || null,
        record.start_date || null,
        record.due_date || null,
        createdBy,
        record.assigned_email ? userIdByEmail[String(record.assigned_email).toLowerCase()] || null : null,
      ], function (insertErr) {
        if (!insertErr) createdCount += 1;
        done(insertErr, this.lastID);
      });
    };

    const createFeatures = (index) => {
      if (index >= featureRows.length) return createTasks(0);
      const record = featureRows[index];

      createTaskRecord(record, null, (insertErr, featureId) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        featureIdByTitle[record.title] = featureId;
        createFeatures(index + 1);
      });
    };

    const createTasks = (index) => {
      if (index >= taskRows.length) {
        return res.json({ message: 'Import terminé', created: createdCount });
      }

      const record = taskRows[index];
      const parentTitle = record.parent_title;

      if (parentTitle && !featureIdByTitle[parentTitle]) {
        return createTaskRecord({ type: 'feature', title: parentTitle }, null, (featureErr, featureId) => {
          if (featureErr) return res.status(500).json({ error: featureErr.message });
          featureIdByTitle[parentTitle] = featureId;
          createTasks(index);
        });
      }

      createTaskRecord(record, parentTitle ? featureIdByTitle[parentTitle] : null, (insertErr) => {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        createTasks(index + 1);
      });
    };

    createFeatures(0);
  });
});

router.get('/:id/comments', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;

  db.get('SELECT id FROM tasks WHERE id = ? AND project_id = ?', [id, projectId], (taskErr, task) => {
    if (taskErr) return res.status(500).json({ error: taskErr.message });
    if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

    db.all(`
      SELECT tc.*, u.name as author_name
      FROM task_comments tc
      LEFT JOIN users u ON u.id = tc.user_id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at DESC, tc.id DESC
    `, [id], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });
});

// POST /projects/:projectId/tasks/:id/comments â€” Ajouter un commentaire d'avancement
router.post('/:id/comments', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Commentaire requis' });
  }

  db.get('SELECT id FROM tasks WHERE id = ? AND project_id = ?', [id, projectId], (taskErr, task) => {
    if (taskErr) return res.status(500).json({ error: taskErr.message });
    if (!task) return res.status(404).json({ error: 'Tâche non trouvée' });

    db.run(`
      INSERT INTO task_comments (task_id, user_id, content)
      VALUES (?, ?, ?)
    `, [id, userId, content.trim()], function (err) {
      if (err) return res.status(500).json({ error: err.message });

      db.get(`
        SELECT tc.*, u.name as author_name
        FROM task_comments tc
        LEFT JOIN users u ON u.id = tc.user_id
        WHERE tc.id = ?
      `, [this.lastID], (commentErr, comment) => {
        if (commentErr) return res.status(500).json({ error: commentErr.message });
        res.json(comment);
      });
    });
  });
});

router.post('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { title, description, parent_id, phase, priority, start_date, due_date, assigned_to } = req.body;
  const createdBy = req.user.id;

  if (!title) return res.status(400).json({ error: 'Titre de la tâche requis' });

  db.run(`
    INSERT INTO tasks (project_id, parent_id, title, description, phase, priority, start_date, due_date, created_by, assigned_to)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    projectId, parent_id || null, title, description || null, phase || null, 
    priority || 'normal', start_date || null, due_date || null, createdBy, assigned_to || null
  ], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const taskId = this.lastID;

    // Notification: task assigned to someone
    if (assigned_to && assigned_to !== createdBy) {
      db.run(`
        INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id)
        VALUES (?, 'task_assigned', ?, ?, ?, ?, ?)
      `, [
        assigned_to,
        'Nouvelle tâche assignée',
        `"${title}" vous a été assignée par ${req.user.name}`,
        projectId,
        taskId,
        createdBy
      ]);
    }

    res.json({ id: taskId, ...req.body, project_id: projectId });
  });
});

// PATCH /projects/:projectId/tasks/:id — Modifier une tâche
router.patch('/:id', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user.id;
  const updates = [];
  const values = [];

  const fields = ['title', 'description', 'status', 'priority', 'phase', 'start_date', 'due_date', 'assigned_to', 'parent_id'];
  
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  });

  if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à modifier' });

  // Check if assigned_to changed — need old value
  if (req.body.assigned_to !== undefined) {
    db.get('SELECT assigned_to, title FROM tasks WHERE id = ? AND project_id = ?', [id, projectId], (findErr, oldTask) => {
      if (findErr || !oldTask) {
        // fallback: just do the update
        return doUpdate();
      }
      doUpdate(() => {
        const newAssignee = req.body.assigned_to;
        if (newAssignee && newAssignee !== userId && newAssignee !== oldTask.assigned_to) {
          db.run(`
            INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id)
            VALUES (?, 'task_assigned', ?, ?, ?, ?, ?)
          `, [
            newAssignee,
            'Tâche assignée',
            `"${oldTask.title}" vous a été assignée par ${req.user.name}`,
            projectId, id, userId
          ]);
        }
      });
    });
  } else {
    doUpdate();
  }

  function doUpdate(afterCb) {
    const vals = [...values, id, projectId];
    db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`, vals, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (afterCb) afterCb();
      res.json({ message: 'Tâche modifiée' });
    });
  }
});

// DELETE /projects/:projectId/tasks/:id — Supprimer une tâche
router.delete('/:id', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  db.run('DELETE FROM tasks WHERE id = ? AND project_id = ?', [id, projectId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Tâche supprimée' });
  });
});

module.exports = router;
