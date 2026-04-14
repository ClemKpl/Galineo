const db = require('../db');
const { sendNotificationEmail } = require('./mailer');

/**
 * Service centralisé pour la gestion des notifications.
 * Gère la création en base de données et l'envoi d'emails en respectant les préférences.
 */
async function createNotification({
  userId,
  type,
  title,
  message,
  projectId = null,
  taskId = null,
  groupId = null,
  fromUserId = null,
  extras = {}
}) {
  return new Promise((resolve, reject) => {
    // 1. Récupérer les préférences de l'utilisateur destinataire
    db.get(
      'SELECT notif_project_updates, notif_added_to_project, notif_deadlines, notif_mentions, notif_task_completed, notif_ai_responses, notif_chat_messages FROM users WHERE id = ?',
      [userId],
      async (err, user) => {
        if (err || !user) return resolve(); // Utilisateur non trouvé ou erreur DB

        // 2. Vérifier si le type de notification est autorisé selon les préférences
        let isEnabled = true;

        if (type === 'project_invite' || type === 'added_to_project' || type === 'group_added') {
          isEnabled = user.notif_added_to_project !== 0;
        } else if (type === 'mention') {
          isEnabled = user.notif_mentions !== 0;
        } else if (type === 'task_completed') {
          isEnabled = user.notif_task_completed !== 0;
        } else if (type === 'ai_response') {
          isEnabled = user.notif_ai_responses !== 0;
        } else if (type === 'chat_message') {
          isEnabled = user.notif_chat_messages !== 0;
        } else {
          // Par défaut pour task_assigned, event_invite, etc.
          isEnabled = user.notif_project_updates !== 0;
        }

        if (!isEnabled) return resolve();

        // 3. Création de la notification en base de données (In-app)
        db.run(
          'INSERT INTO notifications (user_id, type, title, message, project_id, from_user_id, task_id, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, type, title, message, projectId, fromUserId, taskId, groupId],
          function(dbErr) {
            if (dbErr) {
              console.error('❌ [notifService] Erreur insertion DB:', dbErr.message);
              return resolve(); // On ne bloque pas le reste de l'app si les notifs échouent
            }

            // 4. Envoi de l'email (si l'email service est configuré pour ce type)
            // Note: mailer.js refait son propre check de préférences pour être sûr
            sendNotificationEmail({ userId, type, title, message, projectId, extras })
              .catch(e => console.error('❌ [notifService] Erreur email:', e.message));

            resolve(this.lastID);
          }
        );
      }
    );
  });
}

module.exports = {
  createNotification
};
