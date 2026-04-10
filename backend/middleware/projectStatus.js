const db = require('../db');

/**
 * Middleware pour empêcher les modifications sur les projets non actifs (archivés ou supprimés)
 */
function ensureProjectActive(req, res, next) {
  const projectId = Number(req.params.projectId || req.params.id || req.body.project_id);
  
  if (!projectId) return next();

  db.get('SELECT status FROM projects WHERE id = ?', [projectId], (err, project) => {
    if (err) return res.status(500).json({ error: 'Erreur lors de la vérification du statut du projet' });
    if (!project) return res.status(404).json({ error: 'Projet non trouvé' });

    if (project.status !== 'active') {
      // Les administrateurs peuvent modifier même les projets inactifs (ex: pour restaurer)
      if (req.user && req.user.isAdmin) return next();

      return res.status(403).json({
        error: 'PROJECT_NOT_ACTIVE',
        message: `Ce projet est ${project.status === 'completed' ? 'achevé' : 'dans la corbeille'}. Vous devez le restaurer pour pouvoir le modifier.`,
        status: project.status
      });
    }
    
    next();
  });
}

module.exports = { ensureProjectActive };
