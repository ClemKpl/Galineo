const db = require('../db');

function deleteProjectsPermanently(projectIds, cb) {
  const ids = (projectIds || []).map(Number).filter((id) => Number.isFinite(id));
  if (ids.length === 0) return cb(null);

  const placeholders = ids.map(() => '?').join(', ');
  const steps = [
    {
      sql: `DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (${placeholders}))`,
      params: ids,
    },
    {
      sql: `DELETE FROM notifications WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (${placeholders})) OR project_id IN (${placeholders})`,
      params: [...ids, ...ids],
    },
    {
      sql: `DELETE FROM event_attendees WHERE event_id IN (SELECT id FROM calendar_events WHERE project_id IN (${placeholders}))`,
      params: ids,
    },
    {
      sql: `DELETE FROM calendar_events WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM milestones WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM invitations WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM project_share_links WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM project_ai_settings WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM activity_logs WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM messages WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM ai_active_tasks WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM tasks WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM project_members WHERE project_id IN (${placeholders})`,
      params: ids,
    },
    {
      sql: `DELETE FROM projects WHERE id IN (${placeholders})`,
      params: ids,
    },
  ];

  let current = 0;
  function processNext() {
    if (current >= steps.length) return cb(null);
    const { sql, params } = steps[current++];
    db.run(sql, params, (err) => {
      if (err) {
        console.error('❌ Error during permanent deletion step:', err.message);
        return cb(err);
      }
      processNext();
    });
  }
  processNext();
}

module.exports = { deleteProjectsPermanently };
