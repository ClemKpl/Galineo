const db = require('../db');

const FREE_LIMITS = {
  projects: 10,
  collaborators: 5,
  ai_prompts: 50
};

const ADMIN_EMAILS = ['capelleclem@gmail.com', 'flgherardi@gmail.com'];

// Helper pour vérifier si l'utilisateur est admin ou premium
function isUnlimited(req, userPlan) {
  if (ADMIN_EMAILS.includes(req.user.email)) return true;
  if (userPlan === 'premium' || userPlan === 'unlimited') return true;
  return false;
}

const ELEGANT_MESSAGE = (feature) => {
  const labels = {
    projects: 'projets',
    collaborators: 'collaborateurs',
    ai_prompts: 'prompts IA'
  };
  return `Vous avez atteint la limite de ${labels[feature] || 'ressources'} autorisée pour votre plan actuel. Pour continuer à créer, vous pouvez soit libérer de l'espace en supprimant des éléments existants, soit passer au plan Premium pour profiter d'un usage illimité.`;
};

// Bloque si l'user FREE a atteint sa limite de projets
function checkProjectLimit(req, res, next) {
  db.get('SELECT plan FROM users WHERE id = ?', [Number(req.user.id)], (err, user) => {
    if (err) return res.status(500).json({ error: `Erreur SQL Plan: ${err.message}` });
    if (!user) return res.status(500).json({ error: 'Utilisateur non trouvé dans la vérification de plan' });
    if (isUnlimited(req, user.plan)) return next();

    db.get(
      "SELECT COUNT(*) as count FROM projects WHERE owner_id = ? AND (status IS NULL OR status != 'deleted')",
      [Number(req.user.id)],
      (err2, row) => {
        if (err2) return res.status(500).json({ error: `Erreur SQL Count: ${err2.message}` });
        
        const count = row ? parseInt(row.count, 10) : 0;
        console.log(`[LIMIT_CHECK] User ${req.user.id} has ${count}/${FREE_LIMITS.projects} projects`);

        if (count >= FREE_LIMITS.projects) {
          return res.status(403).json({
            error: 'PLAN_LIMIT',
            message: ELEGANT_MESSAGE('projects'),
            limit: 'projects'
          });
        }
        next();
      }
    );
  });
}

// Bloque si l'user FREE a atteint sa limite de collaborateurs sur un projet
function checkCollaboratorLimit(req, res, next) {
  const projectId = Number(req.params.id || req.params.projectId);

  db.get('SELECT plan, id FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Erreur serveur' });
    if (isUnlimited(req, user.plan)) return next();

    // Vérifie que l'user est proprio du projet
    db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId], (err2, project) => {
      if (err2 || !project) return next();
      if (project.owner_id !== req.user.id) return next();

      db.get(
        'SELECT COUNT(*) as count FROM project_members WHERE project_id = ? AND user_id != ?',
        [projectId, req.user.id],
        (err3, row) => {
          if (err3) return res.status(500).json({ error: 'Erreur serveur' });
          if (row.count >= FREE_LIMITS.collaborators) {
            return res.status(403).json({
              error: 'PLAN_LIMIT',
              message: ELEGANT_MESSAGE('collaborators'),
              limit: 'collaborators'
            });
          }
          next();
        }
      );
    });
  });
}

// Bloque si l'user FREE a dépassé ses prompts IA
function checkAiPromptLimit(req, res, next) {
  db.get('SELECT plan, email, ai_prompts_count FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Erreur serveur' });
    if (isUnlimited(req, user.plan)) return next();

    if ((user.ai_prompts_count || 0) >= FREE_LIMITS.ai_prompts) {
      return res.status(403).json({
        error: 'PLAN_LIMIT',
        message: ELEGANT_MESSAGE('ai_prompts'),
        limit: 'ai_prompts'
      });
    }

    // Incrémente le compteur
    db.run('UPDATE users SET ai_prompts_count = ai_prompts_count + 1 WHERE id = ?', [req.user.id]);
    next();
  });
}

module.exports = { checkProjectLimit, checkCollaboratorLimit, checkAiPromptLimit };
