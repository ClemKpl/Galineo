const db = require('../db');

/**
 * Log an activity in the project history.
 * @param {number} projectId - ID of the project
 * @param {number} userId - ID of the user performing the action
 * @param {string} entityType - Type of entity (task, project, member, comment, event)
 * @param {number} entityId - ID of the entity affected
 * @param {string} actionType - Action performed (created, updated, deleted, completed, etc.)
 * @param {object|string} details - Additional details (will be stringified if object)
 */
async function logActivity(projectId, userId, entityType, entityId, actionType, details = null) {
  const detailsStr = details && typeof details === 'object' ? JSON.stringify(details) : details;
  
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO activity_logs (project_id, user_id, entity_type, entity_id, action_type, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, userId, entityType, entityId || null, actionType, detailsStr || null],
      function(err) {
        if (err) {
          console.error('❌ [ActivityLogger Error]:', err.message);
          return reject(err);
        }
        resolve(this.lastID);
      }
    );
  });
}

module.exports = { logActivity };
