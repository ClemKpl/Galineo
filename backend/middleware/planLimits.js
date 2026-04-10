const db = require('../db');

const FREE_LIMITS = {
  projects: 10,
  collaborators: 5,
  ai_prompts: 50
};

// Bloque si l'user FREE a atteint sa limite de projets
function checkProjectLimit(req, res, next) {
  db.get('SELECT plan FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Erreur serveur' });
    if (user.plan === 'premium') return next();

    db.get(
      'SELECT COUNT(*) as count FROM projects WHERE owner_id = ? AND status != "deleted"',
      [req.user.id],
      (err2, row) => {
        if (err2) return res.status(500).json({ error: 'Erreur serveur' });
        if (row.count >= FREE_LIMITS.projects) {
          return res.status(403).json({
            error: 'PLAN_LIMIT',
            message: `Limite atteinte : ${FREE_LIMITS.projects} projets maximum en plan Free.`,
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
    if (user.plan === 'premium') return next();

    // Vérifie que l'user est proprio du projet
    db.get('SELECT owner_id FROM projects WHERE id = ?', [projectId], (err2, project) => {
      if (err2 || !project) return next(); // laisser passer, la route gérera l'erreur
      if (project.owner_id !== req.user.id) return next(); // seul le proprio est limité

      db.get(
        'SELECT COUNT(*) as count FROM project_members WHERE project_id = ? AND user_id != ?',
        [projectId, req.user.id],
        (err3, row) => {
          if (err3) return res.status(500).json({ error: 'Erreur serveur' });
          if (row.count >= FREE_LIMITS.collaborators) {
            return res.status(403).json({
              error: 'PLAN_LIMIT',
              message: `Limite atteinte : ${FREE_LIMITS.collaborators} collaborateurs maximum en plan Free.`,
              limit: 'collaborators'
            });
          }
          next();
        }
      );
    });
  });
}

// Bloque si l'user FREE a dépassé ses 10 prompts IA
function checkAiPromptLimit(req, res, next) {
  db.get('SELECT plan, ai_prompts_count FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(500).json({ error: 'Erreur serveur' });
    if (user.plan === 'premium') return next();

    if ((user.ai_prompts_count || 0) >= FREE_LIMITS.ai_prompts) {
      return res.status(403).json({
        error: 'PLAN_LIMIT',
        message: `Limite atteinte : ${FREE_LIMITS.ai_prompts} prompts IA maximum en plan Free.`,
        limit: 'ai_prompts'
      });
    }

    // Incrémente le compteur
    db.run('UPDATE users SET ai_prompts_count = ai_prompts_count + 1 WHERE id = ?', [req.user.id]);
    next();
  });
}

module.exports = { checkProjectLimit, checkCollaboratorLimit, checkAiPromptLimit };
