const db = require('../db');
const { logActivity } = require('../utils/activityLogger');

/**
 * Vérifie que l'utilisateur authentifié est bien membre du projet demandé.
 * Doit être utilisé APRÈS authMiddleware.
 * Lit req.params.projectId (routes enfants) ou req.params.id (GET /projects/:id).
 */
function projectMemberMiddleware(req, res, next) {
  const projectId = req.params.projectId || req.params.id;
  const userId = req.user.id;

  if (!projectId) return res.status(400).json({ error: 'ID de projet manquant' });

  db.get(
    `SELECT p.id FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
     WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)`,
    [userId, projectId, userId, userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) {
        // Log the unauthorized access attempt
        logActivity(null, userId, 'project', projectId, 'unauthorized_access', {
          ip: req.ip,
          method: req.method,
          path: req.originalUrl,
        }).catch(() => {});
        return res.status(403).json({ error: 'Accès refusé : vous n\'êtes pas membre de ce projet' });
      }
      next();
    }
  );
}

module.exports = { projectMemberMiddleware };
