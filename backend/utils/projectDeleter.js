const db = require('../db');

function deleteProjectsPermanently(projectIds, cb) {
  const ids = (projectIds || []).map(Number).filter((id) => Number.isFinite(id));
  console.log('🗑️ Attempting permanent deletion of projects:', ids);
  if (ids.length === 0) return cb(null);

  const placeholders = ids.map(() => '?').join(', ');
  const steps = [
    { name: 'Task Comments', sql: `DELETE FROM task_comments WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (${placeholders}))` },
    { name: 'Notifications', sql: `DELETE FROM notifications WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (${placeholders})) OR project_id IN (${placeholders})` },
    { name: 'Event Attendees', sql: `DELETE FROM event_attendees WHERE event_id IN (SELECT id FROM calendar_events WHERE project_id IN (${placeholders}))` },
    { name: 'Events', sql: `DELETE FROM calendar_events WHERE project_id IN (${placeholders})` },
    { name: 'Milestones', sql: `DELETE FROM milestones WHERE project_id IN (${placeholders})` },
    { name: 'Invitations', sql: `DELETE FROM invitations WHERE project_id IN (${placeholders})` },
    { name: 'Share Links', sql: `DELETE FROM project_share_links WHERE project_id IN (${placeholders})` },
    { name: 'AI Settings', sql: `DELETE FROM project_ai_settings WHERE project_id IN (${placeholders})` },
    { name: 'Activity Logs', sql: `DELETE FROM activity_logs WHERE project_id IN (${placeholders})` },
    { name: 'Messages', sql: `DELETE FROM messages WHERE project_id IN (${placeholders})` },
    { name: 'AI Active Tasks', sql: `DELETE FROM ai_active_tasks WHERE project_id IN (${placeholders})` },
    { name: 'Tasks', sql: `DELETE FROM tasks WHERE project_id IN (${placeholders})` },
    { name: 'Project Members', sql: `DELETE FROM project_members WHERE project_id IN (${placeholders})` },
    { name: 'Final Project Delete', sql: `DELETE FROM projects WHERE id IN (${placeholders})` },
  ];

  let current = 0;
  function processNext() {
    if (current >= steps.length) {
      console.log('✅ Permanent deletion completed successfully.');
      return cb(null);
    }
    
    const step = steps[current++];
    console.log(`⏳ Step [${current}/${steps.length}]: ${step.name}...`);
    
    // Some steps like Notifications use the IDs twice in the query
    const params = step.sql.split('?').length - 1 === ids.length * 2 ? [...ids, ...ids] : ids;
    
    db.run(step.sql, params, (err) => {
      if (err) {
        console.error(`❌ Error during step "${step.name}":`, err.message);
        return cb(err);
      }
      processNext();
    });
  }
  processNext();
}

module.exports = { deleteProjectsPermanently };
