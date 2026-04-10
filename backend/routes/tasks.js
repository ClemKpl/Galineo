const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { logActivity } = require('../utils/activityLogger');
const { sendNotificationEmail } = require('../utils/mailer');
 
/**
 * Helper to sync a parent task's status based on its children's status
 * Rules:
 * - No children: 'pending' (En attente de tâches)
 * - All children done: 'done'
 * - At least one in_progress or done (but not all done): 'in_progress'
 * - All children todo: 'todo'
 */
const syncParentStatus = (parentId, projectId) => {
  if (!parentId) return;

  db.all('SELECT status FROM tasks WHERE parent_id = ?', [parentId], (err, children) => {
    if (err) {
      console.error('Error syncing parent status:', err);
      return;
    }

    let newStatus = 'pending';
    if (children.length > 0) {
      const statuses = children.map(c => c.status || 'todo');
      const allDone = statuses.every(s => s === 'done');
      const anyProgressOrDone = statuses.some(s => s === 'in_progress' || s === 'done');

      if (allDone) {
        newStatus = 'done';
      } else if (anyProgressOrDone) {
        newStatus = 'in_progress';
      } else {
        newStatus = 'todo';
      }
    }

    db.run('UPDATE tasks SET status = ? WHERE id = ? AND project_id = ?', [newStatus, parentId, projectId]);
  });
};

function csvEscape(str) {
  if (!str) return '""';
  if (typeof str !== 'string') str = String(str);
  return `"${str.replace(/"/g, '""')}"`;
}

function parseCsv(csv) {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const rows = lines.map((line) => {
    const result = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === ',' && !inQuote) {
        result.push(cur);
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  });

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
  `, [Number(projectId)], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// GET /projects/:projectId/tasks/export
router.get('/export', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  db.all(`
    SELECT t.*, parent.title as parent_title, assignee.email as assignee_email
    FROM tasks t
    LEFT JOIN tasks parent ON parent.id = t.parent_id
    LEFT JOIN users assignee ON assignee.id = t.assigned_to
    WHERE t.project_id = ?
    ORDER BY CASE WHEN t.parent_id IS NULL THEN 0 ELSE 1 END, t.parent_id ASC, t.created_at ASC
  `, [projectId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const csvRows = [[
      'type', 'title', 'description', 'status', 'priority', 'phase', 'start_date', 'due_date', 'assigned_email', 'parent_title'
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

// POST /projects/:projectId/tasks/import
router.post('/import', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { csv } = req.body || {};
  const createdBy = req.user.id;

  if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'CSV requis' });

  const records = parseCsv(csv);
  if (records.length === 0) return res.status(400).json({ error: 'Aucune ligne importable' });

  const featureIdByTitle = {};
  const createTaskRecord = (record, parentId, cb) => {
    const { title, description, status, priority, phase, start_date, due_date } = record;
    db.run(`
      INSERT INTO tasks (project_id, parent_id, title, description, status, priority, phase, start_date, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [projectId, parentId, title, description || null, status || 'todo', priority || 'normal', phase || null, start_date || null, due_date || null, createdBy],
    function(err) { cb(err, this.lastID); });
  };

  const featureRows = records.filter(r => (r.type || '').toLowerCase() === 'feature');
  const taskRows = records.filter(r => (r.type || '').toLowerCase() !== 'feature');

  const processFeatures = (idx) => {
    if (idx >= featureRows.length) return processTasks(0);
    createTaskRecord(featureRows[idx], null, (err, id) => {
      if (err) return res.status(500).json({ error: err.message });
      featureIdByTitle[featureRows[idx].title] = id;
      processFeatures(idx + 1);
    });
  };

  const processTasks = (idx) => {
    if (idx >= taskRows.length) return res.json({ message: 'Import réussi' });
    const parentId = taskRows[idx].parent_title ? featureIdByTitle[taskRows[idx].parent_title] : null;
    createTaskRecord(taskRows[idx], parentId, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      processTasks(idx + 1);
    });
  };

  processFeatures(0);
});

// GET /projects/:projectId/tasks/:id/comments
router.get('/:id/comments', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  db.all(`
    SELECT tc.*, u.name as author_name
    FROM task_comments tc
    LEFT JOIN users u ON u.id = tc.user_id
    WHERE tc.task_id = ?
    ORDER BY tc.created_at DESC
  `, [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// POST /projects/:projectId/tasks/:id/comments
router.post('/:id/comments', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user.id;
  if (!content) return res.status(400).json({ error: 'Contenu requis' });

  db.run('INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)', [id, userId, content], async function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const lastID = this.lastID;
    
    // Log Activity
    await logActivity(req.params.projectId, userId, 'comment', id, 'added', { commentId: lastID });

    db.get('SELECT tc.*, u.name as author_name FROM task_comments tc LEFT JOIN users u ON u.id = tc.user_id WHERE tc.id = ?', [lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

// POST / — Créer une tâche
router.post('/', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  const { title, description, parent_id, phase, priority, start_date, due_date, assigned_to, color } = req.body;
  const createdBy = req.user.id;

  if (!title) return res.status(400).json({ error: 'Titre requis' });

  db.run(`
    INSERT INTO tasks (project_id, parent_id, title, description, phase, priority, start_date, due_date, created_by, assigned_to, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [projectId, parent_id || null, title, description || null, phase || null, priority || 'normal', start_date || null, due_date || null, createdBy, assigned_to || null, color || null],
  function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const taskId = this.lastID;
    
    // Log Activity
    logActivity(projectId, createdBy, 'task', taskId, 'created', { title });

    if (assigned_to && assigned_to !== createdBy) {
      const notifMsg = `"${title}" vous a été assignée.`;
      db.run('INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [assigned_to, 'task_assigned', 'Nouvelle tâche', notifMsg, projectId, taskId, createdBy]);
      sendNotificationEmail({ userId: assigned_to, type: 'task_assigned', title: 'Nouvelle tâche', message: notifMsg, projectId });
    }

    if (parent_id) {
      syncParentStatus(parent_id, projectId);
    } else {
      // Force status to 'pending' for new features
      db.run('UPDATE tasks SET status = ? WHERE id = ?', ['pending', taskId]);
    }

    res.json({ id: taskId, ...req.body, project_id: projectId });
  });
});

// PATCH /:id — Modifier une tâche
router.patch('/:id', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  const userId = req.user.id;
  const updates = [];
  const values = [];
  const fields = ['title', 'description', 'status', 'priority', 'phase', 'start_date', 'due_date', 'assigned_to', 'parent_id', 'color'];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  });

  if (updates.length === 0) return res.status(400).json({ error: 'Aucun champ à modifier' });

  const doUpdate = () => {
    const values_final = [...values, id, projectId];
    db.run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND project_id = ?`, values_final, async function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      // If we updated a task, sync its parent
      db.get('SELECT parent_id FROM tasks WHERE id = ?', [id], (err2, task) => {
        if (task && task.parent_id) {
          syncParentStatus(task.parent_id, projectId);
        }
      });

      // If we moved a task to a DIFFERENT parent, sync the OLD parent too if needed
      // (This is advanced but good to have)
      const oldParentId = req.body.old_parent_id; 
      if (oldParentId) syncParentStatus(oldParentId, projectId);

      // Log critical updates
      await logActivity(projectId, userId, 'task', id, 'updated', req.body);
      
      res.json({ message: 'Tâche modifiée' });
    });
  };

  if (req.body.assigned_to !== undefined) {
    db.get('SELECT title, assigned_to FROM tasks WHERE id = ?', [id], (err, oldTask) => {
      if (oldTask && req.body.assigned_to && req.body.assigned_to !== oldTask.assigned_to) {
        const notifMsg = `"${oldTask.title}" vous a été assignée.`;
        db.run('INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [req.body.assigned_to, 'task_assigned', 'Tâche assignée', notifMsg, projectId, id, userId]);
        sendNotificationEmail({ userId: req.body.assigned_to, type: 'task_assigned', title: 'Tâche assignée', message: notifMsg, projectId });
      }
      doUpdate();
    });
  } else {
    doUpdate();
  }
});

// DELETE /clear — Vider toutes les tâches d'un projet
router.delete('/clear', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  db.run('DELETE FROM tasks WHERE project_id = ?', [projectId], async (err) => {
    if (err) return res.status(500).json({ error: err.message });
    await logActivity(projectId, req.user.id, 'project', projectId, 'cleared_all_tasks');
    res.json({ message: 'Toutes les tâches ont été supprimées' });
  });
});

// DELETE /:id — Supprimer une tâche
router.delete('/:id', authMiddleware, (req, res) => {
  const { id, projectId } = req.params;
  
  // Get parent_id before deleting
  db.get('SELECT parent_id FROM tasks WHERE id = ?', [id], (err, task) => {
    const parentId = task ? task.parent_id : null;
    
    db.run('DELETE FROM tasks WHERE id = ? AND project_id = ?', [id, projectId], async (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (parentId) {
        syncParentStatus(parentId, projectId);
      }
      
      await logActivity(projectId, req.user.id, 'task', id, 'deleted');
      res.json({ message: 'Supprimé' });
    });
  });
});

module.exports = router;
