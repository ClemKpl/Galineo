const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logActivity } = require('../utils/activityLogger');
const { checkAiPromptLimit } = require('../middleware/planLimits');
const { createNotification } = require('../utils/notifService');

const MODEL_NAME = "gemini-3.1-flash-lite-preview";

// ─── Promisify db ─────────────────────────────────────────────────────────────
const dbGet = (sql, params) =>
  new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, params) =>
  new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (sql, params) =>
  new Promise((res, rej) => db.run(sql, params, function (err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); }));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Outils (Tools/Functions) ────────────────────────────────────────────────
const functions = {
  creer_projet: async ({ titre, description, deadline, start_date, members, elements }, userId, contextProjectId) => {
    // Si on est déjà dans un projet, on interdit la création d'un autre projet via l'IA projet
    if (contextProjectId) return { error: "Action non autorisée : Vous êtes déjà dans un projet. Utilisez le Wizard pour créer de nouveaux projets." };

    const result = await dbRun(
      `INSERT INTO projects (title, description, deadline, start_date, owner_id, status) VALUES (?, ?, ?, ?, ?, 'active')`,
      [titre, description || null, deadline || null, start_date || null, userId]
    );
    const projectId = result.lastID;
    // ... reste de la fonction creer_projet inchangé mais sécurisé par l'absence d'ID arbitraire passé par l'IA ...
    // Note: projectId ici est celui qui vient d'être généré, c'est sûr.
    
    // 1. Ajouter le créateur comme Propriétaire
    await dbRun(`INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, 1)`, [projectId, userId]);

    // Notification pour le créateur
    await createNotification({
      userId: userId,
      type: 'project_invite',
      title: 'Nouveau projet',
      message: `Vous avez créé le projet "${titre}". Bienvenue à bord !`,
      projectId: projectId
    }).catch(console.error);

    // 2. Ajouter les membres additionnels
    if (members && Array.isArray(members)) {
      for (const m of members) {
        const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [m.email]);
        if (u) {
          await dbRun(`INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)`, [projectId, u.id, 3]);
          await logActivity(projectId, userId, 'member', u.id, 'added', { email: m.email, role: m.role_name || 'Collaborateur' });
          await createNotification({
            userId: u.id,
            type: 'project_invite',
            title: 'Invitation au projet',
            message: `Vous avez été ajouté au projet "${titre}" par l'Assistant IA.`,
            projectId: projectId,
            fromUserId: userId
          }).catch(console.error);
        }
      }
    }

    // 3. Ajouter les fonctionnalités et tâches initiales
    if (elements && Array.isArray(elements)) {
      const featureMap = {};
      const features = elements.filter(e => e.type === 'feature');
      const tasks = elements.filter(e => e.type === 'task');

      for (const el of features) {
        let assignedTo = null;
        if (el.assigned_email) {
          const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [el.assigned_email]);
          if (u) assignedTo = u.id;
        }
        const r = await dbRun(
          `INSERT INTO tasks (project_id, title, description, status, priority, start_date, due_date, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', el.start_date || null, el.due_date || null, userId, assignedTo]
        );
        featureMap[el.title] = r.lastID;
        if (assignedTo) {
          await createNotification({
            userId: assignedTo,
            type: 'task_assigned',
            title: 'Nouvelle fonctionnalité',
            message: `"${el.title}" vous a été assignée par l'Assistant IA.`,
            projectId: projectId,
            taskId: r.lastID
          }).catch(console.error);
        }
      }

      for (const el of tasks) {
        let assignedTo = null;
        if (el.assigned_email) {
          const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [el.assigned_email]);
          if (u) assignedTo = u.id;
        }
        const parentId = featureMap[el.parent_title] || null;
        const r = await dbRun(
          `INSERT INTO tasks (project_id, parent_id, title, description, status, priority, start_date, due_date, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [projectId, parentId, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', el.start_date || null, el.due_date || null, userId, assignedTo]
        );
        if (assignedTo) {
          await createNotification({
            userId: assignedTo,
            type: 'task_assigned',
            title: 'Nouvelle tâche',
            message: `"${el.title}" vous a été assignée par l'Assistant IA.`,
            projectId: projectId,
            taskId: r.lastID
          }).catch(console.error);
        }
      }

      await logActivity(projectId, null, 'task', null, 'created_batch', {
        batch_count: elements.length,
        details: "Initialisation structurelle via Wizard"
      });
    }

    await logActivity(projectId, userId, 'project', projectId, 'created', { title: titre });
    await dbRun('DELETE FROM ai_messages WHERE project_id IS NULL AND user_id = ?', [userId]);

    return { message: `Projet "${titre}" créé !`, projectId };
  },

  creer_elements: async ({ project_id, elements }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Vous ne pouvez pas modifier un autre projet." };
    }
    if (!targetProjectId) return { error: "ID de projet manquant." };

    let created = 0;
    const featureMap = {};

    // 1. D'abord, on charge les IDs des fonctionnalités EXISTANTES pour permettre de lier des tâches à des modules déjà là
    const existingFeatures = await dbAll('SELECT id, title FROM tasks WHERE project_id = ? AND parent_id IS NULL AND status != ?', [targetProjectId, 'deleted']);
    existingFeatures.forEach(f => {
      featureMap[f.title.toLowerCase()] = f.id;
    });

    // 2. Création des NOUVELLES fonctionnalités
    for (const el of elements.filter(e => e.type === 'feature')) {
      // Check limits
      const info = await dbGet(`
        SELECT u.plan, (SELECT COUNT(*) FROM tasks WHERE project_id = ?) as task_count
        FROM projects p
        JOIN users u ON u.id = p.owner_id
        WHERE p.id = ?
      `, [targetProjectId, targetProjectId]);

      if (info && info.plan === 'free' && info.task_count >= 25) {
         return { error: "Limite de 25 tâches atteinte pour le forfait gratuit. L'utilisateur doit passer à Premium pour ajouter plus de fonctionnalités." };
      }

      let assignedTo = null;
      if (el.assigned_email) {
        const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [el.assigned_email]);
        if (u) assignedTo = u.id;
      }
      const r = await dbRun(
        `INSERT INTO tasks (project_id, title, description, status, priority, start_date, due_date, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetProjectId, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', el.start_date || null, el.due_date || null, userId, assignedTo]
      );
      featureMap[el.title.toLowerCase()] = r.lastID;
      created++;
    }

    // 3. Création des tâches liées (nouvelles ou existantes)
    for (const el of elements.filter(e => e.type === 'task')) {
      // Check limits
      const info = await dbGet(`
       SELECT u.plan, (SELECT COUNT(*) FROM tasks WHERE project_id = ?) as task_count
       FROM projects p
       JOIN users u ON u.id = p.owner_id
       WHERE p.id = ?
     `, [targetProjectId, targetProjectId]);

      if (info && info.plan === 'free' && info.task_count >= 25) {
         return { message: `Partiellement terminé. Créé ${created} éléments, mais la limite de 25 tâches du forfait gratuit a été atteinte.`, created };
      }

      let assignedTo = null;
      if (el.assigned_email) {
        const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [el.assigned_email]);
        if (u) assignedTo = u.id;
      }

      // Recherche du parent dans la map (insensible à la casse)
      const parentId = featureMap[el.parent_title?.toLowerCase()] || null;
      
      await dbRun(
        `INSERT INTO tasks (project_id, parent_id, title, description, status, priority, start_date, due_date, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetProjectId, parentId, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', el.start_date || null, el.due_date || null, userId, assignedTo]
      );
      created++;
    }
    await logActivity(targetProjectId, null, 'task', null, 'created_batch', { batch_count: created });
    return { message: `${created} éléments créés.` };
  },

  modifier_tache: async ({ task_id, title, status, priority, start_date, due_date, assigned_email }, userId, contextProjectId) => {
    const task = await dbGet('SELECT project_id FROM tasks WHERE id = ?', [task_id]);
    if (!task) return { error: `Tâche #${task_id} introuvable.` };
    
    // VALIDATION ISOLATION
    if (contextProjectId && Number(task.project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Cette tâche appartient à un autre projet." };
    }

    const projectId = task.project_id;
    let assignedTo = undefined;
    if (assigned_email) {
      const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [assigned_email]);
      if (u) assignedTo = u.id;
    }
    const fields = []; const params = [];
    if (title) { fields.push('title = ?'); params.push(title); }
    if (status) { fields.push('status = ?'); params.push(status); }
    if (priority) { fields.push('priority = ?'); params.push(priority); }
    if (start_date) { fields.push('start_date = ?'); params.push(start_date); }
    if (due_date) { fields.push('due_date = ?'); params.push(due_date); }
    if (assignedTo !== undefined) { fields.push('assigned_to = ?'); params.push(assignedTo); }
    if (fields.length === 0) return { message: 'Aucune modification' };
    params.push(task_id);
    await dbRun(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);

    await logActivity(projectId, userId, 'task', task_id, 'updated', { details: "Via Assistant IA" });
    return { message: `Tâche ${task_id} mise à jour` };
  },

  gerer_membres: async ({ project_id, email, action }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Vous ne pouvez pas gérer les membres d'un autre projet." };
    }
    if (!targetProjectId) return { error: "ID de projet manquant." };

    const u = await dbGet('SELECT id, name FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!u) return { error: `Email ${email} introuvable.` };

    if (action === 'add') {
      await dbRun(`INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, 3)`, [targetProjectId, u.id]);
      return { message: `Membre ${u.name} ajouté.` };
    } else {
      await dbRun(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [targetProjectId, u.id]);
      return { message: `Membre ${u.name} retiré.` };
    }
  },

  voir_taches: async ({ project_id }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Impossible de consulter un autre projet." };
    }
    if (!targetProjectId) return { error: "ID de projet manquant." };

    const rows = await dbAll(`
      SELECT t.id, t.title, t.status, t.priority, t.start_date, t.due_date, u.email as assigned_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = ? AND t.status != 'deleted'
    `, [targetProjectId]);
    return { tasks: rows };
  },

  voir_parametres_projet: async ({ project_id }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé." };
    }
    const p = await dbGet(`SELECT title, description, start_date, deadline FROM projects WHERE id = ?`, [targetProjectId]);
    return p || { error: 'Projet non trouvé' };
  },

  modifier_parametres_projet: async ({ project_id, title, description }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé." };
    }
    const fields = []; const params = [];
    if (title) { fields.push('title = ?'); params.push(title); }
    if (description) { fields.push('description = ?'); params.push(description); }
    if (fields.length === 0) return { message: 'Aucune modification' };
    params.push(targetProjectId);
    await dbRun(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, params);
    return { message: `Projet ${targetProjectId} mis à jour.` };
  },

  voir_liste_membres: async ({ project_id }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé." };
    }
    const rows = await dbAll(`
      SELECT u.name, u.email, r.name as role FROM project_members pm
      JOIN users u ON u.id = pm.user_id JOIN roles r ON r.id = pm.role_id
      WHERE pm.project_id = ? ORDER BY r.id ASC
    `, [targetProjectId]);
    return { members: rows };
  },
  
  supprimer_elements: async ({ project_id, element_ids }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé." };
    }
    if (!element_ids || !Array.isArray(element_ids)) return { error: "IDs manquants." };
    
    await dbRun(`UPDATE tasks SET status = 'deleted' WHERE project_id = ? AND id IN (${element_ids.map(() => '?').join(',')})`, [targetProjectId, ...element_ids]);
    return { message: `${element_ids.length} éléments supprimés.` };
  }
};

const toolConfig = [
  {
    functionDeclarations: [
      {
        name: "creer_projet",
        description: "Crée un nouveau projet Galineo avec membres et tâches",
        parameters: {
          type: "object",
          properties: {
            titre: { type: "string" },
            description: { type: "string" },
            deadline: { type: "string" },
            start_date: { type: "string" },
            members: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  role_name: { type: "string" }
                },
                required: ["email"]
              }
            },
            elements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { 
                    type: "string", 
                    enum: ["feature", "task"],
                    description: "'feature' = Module Parent. 'task' = Action Enfant rattachée."
                  },
                  title: { type: "string" },
                  parent_title: { 
                    type: "string", 
                    description: "OBLIGATOIRE pour les 'task'. Doit correspondre au 'title' d'une 'feature'." 
                  },
                  priority: { type: "string" },
                  start_date: { type: "string" },
                  due_date: { type: "string" },
                  assigned_email: { type: "string" }
                },
                required: ["type", "title"]
              }
            }
          },
          required: ["titre"]
        }
      },
      {
        name: "creer_elements",
        description: "Ajoute des fonctionnalités et tâches à un projet. IMPORTANT: Avant d'appeler cet outil pour ajouter des tâches à des fonctionnalités existantes, tu DOIS appeler 'voir_taches' pour connaître le titre exact des fonctionnalités déjà présentes.",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            elements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { 
                    type: "string", 
                    enum: ["feature", "task"],
                    description: "'feature' = Module Parent (ex: Authentification). 'task' = Action Enfant rattachée (ex: Créer le formulaire)."
                  },
                  title: { type: "string" },
                  parent_title: { 
                    type: "string", 
                    description: "OBLIGATOIRE pour les 'task'. Doit correspondre au 'title' d'une 'feature' (soit créée dans le même appel, soit déjà existante dans le projet)." 
                  },
                  priority: { type: "string" },
                  start_date: { type: "string" },
                  due_date: { type: "string" },
                  assigned_email: { type: "string" }
                },
                required: ["type", "title"]
              }
            }
          },
          required: ["project_id", "elements"]
        }
      },
      {
        name: "modifier_tache",
        description: "Modifie une tâche existante (date, statut, assignation)",
        parameters: {
          type: "object",
          properties: {
            task_id: { type: "number" },
            status: { type: "string", enum: ["todo", "in_progress", "done"] },
            start_date: { type: "string" },
            due_date: { type: "string" },
            assigned_email: { type: "string" }
          },
          required: ["task_id"]
        }
      },
      {
        name: "voir_taches",
        description: "Récupère la liste des tâches d'un projet",
        parameters: {
          type: "object",
          properties: { project_id: { type: "number" } },
          required: ["project_id"]
        }
      },
      {
        name: "gerer_membres",
        description: "Ajoute ou retire un membre du projet via son email",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            email: { type: "string" },
            action: { type: "string", enum: ["add", "remove"] }
          },
          required: ["project_id", "email", "action"]
        }
      },
      {
        name: "voir_parametres_projet",
        description: "Consulte les paramètres généraux du projet",
        parameters: {
          type: "object",
          properties: { project_id: { type: "number" } },
          required: ["project_id"]
        }
      },
      {
        name: "modifier_parametres_projet",
        description: "Modifie le titre ou la description du projet",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            title: { type: "string" },
            description: { type: "string" }
          },
          required: ["project_id"]
        }
      },
      {
        name: "voir_liste_membres",
        description: "Récupère la liste complète des membres du projet",
        parameters: {
          type: "object",
          properties: { project_id: { type: "number" } },
          required: ["project_id"]
        }
      },
      {
        name: "supprimer_elements",
        description: "Marque des tâches ou fonctionnalités comme supprimées (DANGER: EXPÉRIMENTAL)",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            element_ids: {
              type: "array",
              items: { type: "number" }
            }
          },
          required: ["project_id", "element_ids"]
        }
      }
    ]
  }
];

// ─── Historique ──────────────────────────────────────────────────────────────
router.get('/history/:projectId', authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;
  try {
    const isWizard = projectId === 'wizard';
    
    // Récupération de la durée de l'historique configurée (ou 60min par défaut)
    const user = await dbGet('SELECT ai_history_duration FROM users WHERE id = ?', [userId]);
    const durationMin = user?.ai_history_duration ?? 60;
    
    // Filtre sur created_at en fonction de la durée (Gestion SQLite/PG simplifiée via JS ou SQL standard)
    const rows = await dbAll(
      `SELECT m.role, m.content, m.created_at, 
              CASE WHEN m.role = 'model' THEN 'Galineo Room' ELSE u.name END as user_name, 
              CASE WHEN m.role = 'model' THEN NULL ELSE u.avatar END as user_avatar 
       FROM ai_messages m 
       LEFT JOIN users u ON u.id = m.user_id 
       WHERE ${isWizard ? 'm.project_id IS NULL AND m.user_id = ?' : 'm.project_id = ?'}
       ORDER BY m.id ASC`,
      isWizard ? [userId] : [projectId]
    );
    console.log(`[AI History] Fetching for ${projectId}, found ${rows.length} rows`);
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/history/:projectId', authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;
  try {
    const isWizard = projectId === 'wizard';
    await dbRun(
      `DELETE FROM ai_messages 
       WHERE ${isWizard ? 'project_id IS NULL AND user_id = ?' : 'project_id = ?'}`,
      isWizard ? [userId] : [projectId]
    );
    res.json({ message: 'Historique réinitialisé avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Route Chat ───────────────────────────────────────────────────────────────
// ─── Route pour vérifier si l'Assistant travaille ───────────────────────────
router.get('/active-task/:projectId', authMiddleware, async (req, res) => {
  const { projectId: rawId } = req.params;
  const userId = req.user.id;
  try {
    const isWizard = rawId === 'wizard';
    const projectId = isWizard ? null : parseInt(rawId);
    
    // On cherche d'abord s'il y a une tâche en cours pour CE contexte précis
    let task = await dbGet(
      `SELECT * FROM ai_active_tasks
       WHERE user_id = ?
       AND ${isWizard ? 'project_id IS NULL' : 'project_id = ?'}
       AND status = 'running'
       ORDER BY id DESC LIMIT 1`,
      isWizard ? [userId] : [userId, projectId]
    );
    
    // Si aucune en cours, on regarde la toute dernière tâche (pour capter la complétion et l'ID projet)
    // On ne filtre pas par project_id IS NULL ici pour permettre de récupérer le projet AVEC son ID
    if (!task) {
      task = await dbGet(
        `SELECT * FROM ai_active_tasks
         WHERE user_id = ?
         ORDER BY id DESC LIMIT 1`,
        [userId]
      );
    }
    
    res.json({ active: (task && task.status === 'running'), task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Route Chat (Refactorisée pour l'arrière-plan) ───────────────────────────
router.post('/chat', authMiddleware, checkAiPromptLimit, async (req, res) => {
  const { messages, projectId, mode = 'project', attachment_url, attachment_name, attachment_type } = req.body;
  const userId = req.user.id;

  const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
  const apiKeys = rawKeys ? rawKeys.split(',').map(k => k.trim()).filter(k => !!k) : [];

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: "Clé API Gemini manquante." });
  }

  const userText = messages[messages.length - 1].content;
  const dbProjectId = (projectId === 'wizard' || mode === 'wizard') ? null : projectId;
  let projectTitle = 'ce projet';
  let userName = 'Utilisateur';
  let userEmail = 'inconnu';
  let userRoleId = null;

  try {
    const user = await dbGet('SELECT name, email FROM users WHERE id = ?', [userId]);
    if (user) {
      userName = user.name;
      userEmail = user.email;
    }

    if (projectId) {
      const p = await dbGet(`SELECT title FROM projects WHERE id = ?`, [projectId]);
      if (p) projectTitle = p.title;

      // Récupération du rôle de l'utilisateur dans ce projet
      const membership = await dbGet(`SELECT role_id FROM project_members WHERE project_id = ? AND user_id = ?`, [projectId, userId]);
      userRoleId = membership?.role_id || null;
    }
    
    // On injecte les infos utilisateur dans le scope interne pour sysInstruct
    req.userInfo = { name: userName, email: userEmail };

    // Sauvegarde immédiate du message utilisateur (si mode projet ou wizard)
    await dbRun(
      `INSERT INTO ai_messages (project_id, user_id, role, content, attachment_url, attachment_name, attachment_type) VALUES (?, ?, 'user', ?, ?, ?, ?)`,
      [dbProjectId, userId, userText, attachment_url || null, attachment_name || null, attachment_type || null]
    );
  } catch (err) {
    console.error('Initial DB ops error', err);
  }

  // Nettoyage des anciennes tâches "bloquées" pour cet utilisateur/projet
  try {
    const isWizard = mode === 'wizard';
    await dbRun(
      `UPDATE ai_active_tasks SET status = 'failed' 
       WHERE user_id = ? AND status = 'running' 
       AND ${dbProjectId === null ? 'project_id IS NULL' : 'project_id = ?'}`,
      dbProjectId === null ? [userId] : [userId, dbProjectId]
    );
  } catch (err) {
    console.error('Failed to clean up old tasks', err);
  }

  // Création de la tâche en arrière-plan
  let taskId = null;
  try {
    const taskRes = await dbRun(
      `INSERT INTO ai_active_tasks (user_id, project_id, status) VALUES (?, ?, 'running')`,
      [userId, dbProjectId]
    );
    taskId = taskRes.lastID;
  } catch (err) {
    console.error('Failed to create AI task record', err);
  }

  // Réponse immédiate au client
  res.status(202).json({
    message: "L'assistant a commencé son analyse en arrière-plan.",
    taskId,
    status: 'processing'
  });

  // TRAITEMENT EN ARRIÈRE-PLAN
  (async () => {
    let lastError = null;
    let success = false;
    let currentProjectIdTask = dbProjectId;

    try {
      for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        try {
          const genAI = new GoogleGenerativeAI(apiKey);
          let sysInstruct = '';
          let currentTools = undefined;

          const currentDate = new Date().toISOString().split('T')[0];
          const userName = req.userInfo.name;
          const userEmail = req.userInfo.email;

          // Hiérarchie commune
          const hierarchyInfo = `
HIÉRARCHIE DU PROJET (RÈGLE ABSOLUE) :
1. 'feature' (Fonctionnalité) : C'est un CONTENEUR ou un MODULE MAJEUR (ex: "Authentification", "Système de Paiement", "Interface Dashboard"). Il ne peut JAMAIS être l'enfant d'un autre élément.
2. 'task' (Tâche) : C'est une ACTION CONCRÈTE qui appartient obligatoirement à une fonctionnalité (ex: "Créer le formulaire de login" est une tâche de "Authentification"). 
CHAQUE tâche doit avoir un 'parent_title' qui pointe vers une 'feature' existante. Une tâche ne peut pas flotter seule.
`;

          if (mode === 'global') {
            sysInstruct = `Tu es Galineo AI, le conseiller personnel de l'utilisateur.
            UTILISATEUR : Tu parles avec ${userName} (${userEmail}). Ne demande JAMAIS son identité.
            TON RÔLE :
            - Expert du logiciel Galineo. 
            - IMPORTANT : Tu n'as accès à AUCUNE donnée de projet spécifique ici. Redirige vers la 'Galineo Room' pour cela.
            - DATE DU JOUR : ${currentDate}.
            - RÈGLE D'OR : Tu as l'OBLIGATION de demander une confirmation explicite avant d'appeler un outil (créations/modifications). Cependant, dès que l'utilisateur dit "Oui", "OK" ou "Go", exécute l'outil IMMÉDIATEMENT sans jamais redemander une deuxième fois. FONCE.`;
            currentTools = undefined;
          } else if (mode === 'wizard') {
            sysInstruct = `Tu es l'Assistant Wizard de Galineo. Tu accompagnes ${userName} (${userEmail}) dans la création de son projet.
            
            ${hierarchyInfo}

            CONSIGNES GÉNÉRALES :
            1. EXHAUSTIVITÉ : Ne t'arrête pas au minimum. Ton but est de générer un projet COMPLET et PROFESSIONNEL. Propose autant de fonctionnalités et de tâches que nécessaire pour couvrir tous les aspects (technique, organisationnel, communication, etc.).
            2. MÉTHODOLOGIE : Avant de répartir les tâches, commence TOUJOURS par définir et proposer les RÔLES des membres présents dans le projet pour assurer une organisation claire.
            3. RÈGLE D'OR : Pour CHAQUE fonctionnalité ('feature'), génère un ensemble de tâches ('task') cohérentes et détaillées.
            4. DATES : Sois extrêmement rigoureux sur les 'start_date' et 'due_date'. Elles doivent s'étaler logiquement sur la durée du projet en commençant par aujourd'hui (${currentDate}).
            5. PRÉCISION : Intègre sans faute toute demande spécifique de l'utilisateur.

            RÈGLES CRITIQUES :
            1. PAS DE DOUBLONS : Si l'historique montre que le projet est déjà créé, refuse de recommencer et renvoie vers la Room.
            2. DATE DU JOUR : ${currentDate}.
            3. ÉCHÉANCES : Tu DOIS générer une 'start_date' et une 'due_date' (YYYY-MM-DD) pour CHAQUE élément.
            4. CONFIRMATION OBLIGATOIRE : Tu ne dois JAMAIS appeler l'outil 'creer_projet' sans avoir présenté la structure et obtenu un accord explicite (ex: "Oui", "Ok", "Go"). L'action doit être validée par l'utilisateur.
            
            DISCOURS APRÈS CRÉATION :
            Confirme la création et précise que pour modifier ou AJOUTER des éléments, il doit maintenant utiliser l'Assistant IA interne au projet.`;
            currentTools = toolConfig;
          } else { // mode === 'project'
            sysInstruct = `Tu es l'Assistant Galineo Room dédié au projet "${projectTitle}".
            UTILISATEUR ACTUEL : ${userName} (${userEmail}).
            CONTEXTE : ID Projet = ${projectId}. DATE DU JOUR : ${currentDate}.
            
            VOUS ÊTES DANS UN ENVIRONNEMENT MULTI-UTILISATEURS (Galineo Room).
            - Chaque message de l'historique utilisateur est préfixé par son nom : [Nom].
            - Tu dois être capable de distinguer qui a dit quoi.
            - Adresse-toi aux utilisateurs par leur nom si la situation s'y prête.

            ${hierarchyInfo}

            RÈGLES CRITIQUES :
            1. STRUCTURE : Pour toute nouvelle fonctionnalité créée, génère AU MOINS 2 tâches liées.
            2. ÉCHÉANCES : Fournis TOUJOURS une 'start_date' et une 'due_date' pour toute création.
            3. CONFIRMATION OBLIGATOIRE : Tu as l'interdiction de créer, modifier ou supprimer quoi que ce soit sans l'accord explicite de l'utilisateur ("Oui", "Ok", "C'est bon"). Présente ton plan, puis attends sa validation.
            4. SUPPRESSION : L'outil 'supprimer_elements' est EXPÉRIMENTAL. Ne l'utilise que si explicitement demandé et confirme toujours avant. Tu ne peux PAS supprimer un projet entier, seulement ses tâches/fonctionnalités.`;
            currentTools = toolConfig;
          }

          const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: { role: "system", parts: [{ text: sysInstruct }] }
          }, { apiVersion: 'v1beta' });

          const rawHistory = messages.slice(0, -1).map(m => {
            const isModel = m.role === 'assistant' || m.role === 'model';
            const author = m.user_name || (isModel ? 'Assistant' : 'Utilisateur');
            const contentWithAuthor = isModel ? m.content : `[${author}]: ${m.content}`;
            
            return {
              role: isModel ? 'model' : 'user',
              parts: [{ text: contentWithAuthor }]
            };
          });
          
          // Texte actuel de l'utilisateur (identifié lui aussi)
          const identifiedUserText = `[${userName}]: ${userText}`;

          const history = [];
          let lastRole = null;
          for (const msg of rawHistory) {
            if (msg.role !== lastRole) {
              history.push(msg);
              lastRole = msg.role;
            }
          }
          while (history.length > 0 && history[0].role !== 'user') { history.shift(); }

          const chat = model.startChat({ history, tools: currentTools });

          const sendMessageWithRetry = async (payload) => {
            for (let attempt = 1; attempt <= 3; attempt++) {
              try { return await chat.sendMessage(payload); }
              catch (err) { if (attempt < 3) { await sleep(attempt * 1000); continue; } throw err; }
            }
          };

          // Construction du payload : texte + fichier éventuel
          let geminiPayload;
          if (attachment_url && attachment_type) {
            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, '../uploads', path.basename(attachment_url));
            try {
              const WORD_TYPES = [
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/msword',
              ];
              const EXCEL_TYPES = [
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-excel',
              ];

              if (WORD_TYPES.includes(attachment_type)) {
                // Word → extraction texte via mammoth
                const mammoth = require('mammoth');
                const result = await mammoth.extractRawText({ path: filePath });
                const extractedText = result.value.trim();
                geminiPayload = [
                  { text: identifiedUserText },
                  { text: `\n\n[Contenu du fichier Word "${attachment_name || 'document'}"]\n${extractedText}` }
                ];
              } else if (EXCEL_TYPES.includes(attachment_type)) {
                // Excel → conversion en CSV via xlsx
                const XLSX = require('xlsx');
                const workbook = XLSX.readFile(filePath);
                const csvParts = workbook.SheetNames.map(name => {
                  const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
                  return `[Feuille "${name}"]\n${csv}`;
                });
                geminiPayload = [
                  { text: identifiedUserText },
                  { text: `\n\n[Contenu du fichier Excel "${attachment_name || 'classeur'}"]\n${csvParts.join('\n\n')}` }
                ];
              } else {
                // Images, PDF, texte → inlineData base64
                const fileData = fs.readFileSync(filePath);
                const base64Data = fileData.toString('base64');
                geminiPayload = [
                  { text: identifiedUserText },
                  { inlineData: { mimeType: attachment_type, data: base64Data } }
                ];
              }
            } catch {
              geminiPayload = identifiedUserText;
            }
          } else {
            geminiPayload = identifiedUserText;
          }
          const result = await sendMessageWithRetry(geminiPayload);
          let response = result.response;
          let text = "";
          currentProjectIdTask = projectId || dbProjectId;
          const currentUserRoleId = userRoleId;

          let toolCallsCount = 0;
          while (response.functionCalls()?.length > 0 && toolCallsCount < 5) {
            toolCallsCount++;
            const calls = response.functionCalls();
            const toolLogs = [];
            for (const call of calls) {
              // --- VÉRIFICATION DES PERMISSIONS ---
              if (projectId) {
                // 1. Paramètres du projet (AI Settings)
                const settings = await dbGet('SELECT * FROM project_ai_settings WHERE project_id = ?', [projectId]);
                const canCreate = !settings || settings.allow_create === 1;
                const canModify = !settings || settings.allow_modify === 1;
                const canMembers = !settings || settings.allow_members === 1;
                const canDelete = settings && settings.allow_delete === 1;

                // 2. Rôle de l'utilisateur (Propriétaire=1, Admin=2, Membre=3, Observateur=4)
                // Seuls Propriétaire et Admin peuvent effectuer des actions administratives via l'IA
                const isAdminOrOwner = currentUserRoleId === 1 || currentUserRoleId === 2;

                if (call.name === 'creer_elements' && !canCreate) {
                  toolLogs.push({ name: call.name, response: { error: "Action refusée : La création par l'IA est désactivée pour ce projet." } });
                  continue;
                }
                if (call.name === 'modifier_tache' && !canModify) {
                  toolLogs.push({ name: call.name, response: { error: "Action refusée : La modification par l'IA est désactivée pour ce projet." } });
                  continue;
                }

                // Restriction de GESTION DES MEMBRES par rôle
                if (call.name === 'gerer_membres') {
                  if (!canMembers) {
                    toolLogs.push({ name: call.name, response: { error: "Action refusée : La gestion des membres par l'IA est désactivée." } });
                    continue;
                  }
                  if (!isAdminOrOwner) {
                    toolLogs.push({ name: call.name, response: { error: "Action refusée : Vous n'avez pas les droits d'administrateur nécessaires pour gérer l'équipe via l'IA." } });
                    continue;
                  }
                }

                // Restriction de MODIFICATION PARAMÈTRES par rôle
                if (call.name === 'modifier_parametres_projet') {
                  if (!isAdminOrOwner) {
                    toolLogs.push({ name: call.name, response: { error: "Action refusée : Seuls les administrateurs peuvent modifier les paramètres globaux du projet via l'IA." } });
                    continue;
                  }
                }

                // Restriction de SUPPRESSION par rôle
                if (call.name === 'supprimer_elements') {
                  if (!canDelete) {
                    toolLogs.push({ name: call.name, response: { error: "Action refusée : La suppression par l'IA est désactivée (Désactivé par défaut / Expérimental)." } });
                    continue;
                  }
                  if (!isAdminOrOwner) {
                    toolLogs.push({ name: call.name, response: { error: "Action refusée : Vous n'avez pas les droits d'administrateur nécessaires pour supprimer des éléments via l'IA." } });
                    continue;
                  }
                }
              }

              const fn = functions[call.name];
              if (fn) {
                // On passe dbProjectId comme contexte autorisé
                const apiRes = await fn(call.args, userId, dbProjectId);

                // Si on a créé un projet, on récupère son ID pour la suite
                if (call.name === 'creer_projet' && apiRes && apiRes.projectId) {
                  currentProjectIdTask = apiRes.projectId;
                }

                toolLogs.push({ name: call.name, response: apiRes });
                if (!actions.includes(call.name)) actions.push(call.name);
              }
            }
            const toolResponses = toolLogs.map(l => ({
              functionResponse: { name: l.name, response: l.response }
            }));
            const secondResult = await sendMessageWithRetry(toolResponses);
            response = secondResult.response;
          }

          try { text = response.text(); } catch (e) { }
          text = text.replace(/\[Actions:.*?\]/g, '').trim();

          if (!text || text.trim() === "") {
            text = actions.length > 0 ? "C'est fait ! Les modifications ont été appliquées." : "Désolé, je rencontre une difficulté.";
          }

          // Sauvegarde de la réponse de l'IA (si projet existant ou nouvellement créé ou wizard)
          // Pour le wizard, on garde project_id = null (ou l'ID original passé) pour que l'interface wizard puisse le lire.
          const saveProjectId = (mode === 'wizard') ? null : (currentProjectIdTask || dbProjectId);

          await dbRun(
            `INSERT INTO ai_messages (project_id, user_id, role, content) VALUES (?, ?, 'model', ?)`,
            [saveProjectId, userId, text]
          );

          // Notification finale
          await createNotification({
            userId: userId,
            type: 'ai_response',
            title: "Réponse de l'IA prête",
            message: `L'Assistant a terminé son analyse pour le projet "${projectTitle}".`,
            projectId: currentProjectIdTask
          }).catch(console.error);

          success = true;
          break; // Sortie de la boucle des clés API si succès

        } catch (err) {
          lastError = err;
          if (err.message.includes('429') && i < apiKeys.length - 1) continue;
          console.error('[AI Background Error]', err);
          break;
        }
      }

          // Mise à jour finale du statut de la tâche et de l'ID projet
          if (taskId) {
            await dbRun(
              `UPDATE ai_active_tasks SET status = ?, project_id = ? WHERE id = ?`,
              [success ? 'completed' : 'failed', currentProjectIdTask, taskId]
            );
          }

    } catch (globalErr) {
      console.error('[AI Global BG Error]', globalErr);
      if (taskId) {
        await dbRun(`UPDATE ai_active_tasks SET status = 'failed' WHERE id = ?`, [taskId]);
      }
    }
  })();
});

module.exports = router;
