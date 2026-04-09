const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logActivity } = require('../utils/activityLogger');

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
  creer_projet: async ({ titre, description, deadline, start_date, members, elements }, userId) => {
    const result = await dbRun(
      `INSERT INTO projects (title, description, deadline, start_date, owner_id, status) VALUES (?, ?, ?, ?, ?, 'active')`,
      [titre, description || null, deadline || null, start_date || null, userId]
    );
    const projectId = result.lastID;

    // 1. Ajouter le créateur comme Propriétaire
    await dbRun(`INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, 1)`, [projectId, userId]);

    // Notification pour le créateur
    await dbRun(
      'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, 'project_access', 'Nouveau projet', `Vous avez créé le projet "${titre}". Bienvenue à bord !`, projectId, null, null]
    );

    // 2. Ajouter les membres additionnels
    if (members && Array.isArray(members)) {
      for (const m of members) {
        const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [m.email]);
        if (u) {
          await dbRun(`INSERT OR IGNORE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)`, [projectId, u.id, 3]); // Collaborateur par défaut
          await logActivity(projectId, userId, 'member', u.id, 'added', { email: m.email, role: m.role_name || 'Collaborateur' });
          await dbRun(
            'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [u.id, 'project_access', 'Invitation au projet', `Vous avez été ajouté au projet "${titre}" par l'Assistant IA.`, projectId, null, userId]
          );
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
          await dbRun(
            'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [assignedTo, 'task_assigned', 'Nouvelle fonctionnalité', `"${el.title}" vous a été assignée par l'Assistant IA.`, projectId, r.lastID, null]
          );
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
          await dbRun(
            'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [assignedTo, 'task_assigned', 'Nouvelle tâche', `"${el.title}" vous a été assignée par l'Assistant IA.`, projectId, r.lastID, null]
          );
        }
      }

      await logActivity(projectId, null, 'task', null, 'created_batch', {
        batch_count: elements.length,
        details: "Initialisation structurelle via Wizard"
      });
    }

    // Log the action
    await logActivity(projectId, userId, 'project', projectId, 'created', {
      title: titre,
      details: "Configuration initiale complète du projet par l'IA"
    });

    return {
      message: `Projet "${titre}" créé et configuré avec succès !`,
      projectId: projectId
    };
  },

  creer_elements: async ({ project_id, elements }, userId) => {
    let created = 0;
    const featureMap = {};
    for (const el of elements.filter(e => e.type === 'feature')) {
      let assignedTo = null;
      if (el.assigned_email) {
        const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [el.assigned_email]);
        if (u) assignedTo = u.id;
      }
      const r = await dbRun(
        `INSERT INTO tasks (project_id, title, description, status, priority, start_date, due_date, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [project_id, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', el.start_date || null, el.due_date || null, userId, assignedTo]
      );
      const taskId = r.lastID;
      featureMap[el.title] = taskId;
      created++;

      if (assignedTo) {
        await dbRun(
          'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [assignedTo, 'task_assigned', 'Nouvelle fonctionnalité', `"${el.title}" vous a été assignée par l'Assistant IA.`, project_id, taskId, null]
        );
      }
    }
    for (const el of elements.filter(e => e.type === 'task')) {
      let assignedTo = null;
      if (el.assigned_email) {
        const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [el.assigned_email]);
        if (u) assignedTo = u.id;
      }
      const parentId = featureMap[el.parent_title] || null;
      const r = await dbRun(
        `INSERT INTO tasks (project_id, parent_id, title, description, status, priority, start_date, due_date, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [project_id, parentId, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', el.start_date || null, el.due_date || null, userId, assignedTo]
      );
      const taskId = r.lastID;
      created++;

      if (assignedTo) {
        await dbRun(
          'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [assignedTo, 'task_assigned', 'Nouvelle tâche', `"${el.title}" vous a été assignée par l'Assistant IA.`, project_id, taskId, null]
        );
      }
    }

    await logActivity(project_id, null, 'task', null, 'created_batch', {
      batch_count: created,
      details: "Génération automatique d'éléments de projet via Assistant IA"
    });

    return { message: `${created} éléments créés dans le projet ${project_id}` };
  },

  modifier_tache: async ({ task_id, title, status, priority, start_date, due_date, assigned_email }, userId) => {
    const task = await dbGet('SELECT project_id FROM tasks WHERE id = ?', [task_id]);
    if (!task) return { error: `Tâche #${task_id} introuvable.` };
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

    if (assignedTo) {
      await dbRun(
        'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [assignedTo, 'task_assigned', 'Tâche assignée', `La tâche #${task_id} ("${title || 'sans titre'}") vous a été assignée par l'Assistant IA.`, projectId, task_id, null]
      );
    }

    await logActivity(projectId, null, 'task', task_id, 'updated', {
      task_id,
      changes: fields.join(', '),
      details: "Modification via Assistant IA"
    });

    return { message: `Tâche ${task_id} mise à jour` };
  },

  gerer_membres: async ({ project_id, email, action }, userId) => {
    const u = await dbGet('SELECT id, name FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!u) return { error: `Utilisateur avec l'email ${email} introuvable.` };

    if (action === 'add') {
      await dbRun(`INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, 3)`, [project_id, u.id]);
      await logActivity(project_id, userId, 'member', u.id, 'added', { email, via: 'Assistant IA' });
      return { message: `Membre ${u.name} (${email}) ajouté au projet.` };
    } else {
      await dbRun(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [project_id, u.id]);
      await logActivity(project_id, userId, 'member', u.id, 'removed', { email, via: 'Assistant IA' });
      return { message: `Membre ${u.name} (${email}) retiré du projet.` };
    }
  },

  voir_taches: async ({ project_id }) => {
    const rows = await dbAll(`
      SELECT t.id, t.title, t.status, t.priority, t.start_date, t.due_date, u.email as assigned_email, u.name as assigned_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = ?
    `, [project_id]);
    return { tasks: rows };
  },

  voir_parametres_projet: async ({ project_id }) => {
    const p = await dbGet(`SELECT title, description, start_date, deadline FROM projects WHERE id = ?`, [project_id]);
    return p || { error: 'Projet non trouvé' };
  },

  modifier_parametres_projet: async ({ project_id, title, description }, userId) => {
    const fields = []; const params = [];
    if (title) { fields.push('title = ?'); params.push(title); }
    if (description) { fields.push('description = ?'); params.push(description); }
    if (fields.length === 0) return { message: 'Aucune modification demandée' };

    params.push(project_id);
    await dbRun(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`, params);

    await logActivity(project_id, userId, 'project', project_id, 'updated', { title, description });
    return { message: `Les paramètres du projet ${project_id} ont été mis à jour avec succès.` };
  },

  voir_liste_membres: async ({ project_id }) => {
    const rows = await dbAll(`
      SELECT u.name, u.email, r.name as role 
      FROM project_members pm
      JOIN users u ON u.id = pm.user_id
      JOIN roles r ON r.id = pm.role_id
      WHERE pm.project_id = ?
      ORDER BY r.id ASC, u.name ASC
    `, [project_id]);
    return { members: rows };
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
                  type: { type: "string", enum: ["feature", "task"] },
                  title: { type: "string" },
                  parent_title: { type: "string" },
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
        description: "Ajoute des fonctionnalités et tâches à un projet",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            elements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["feature", "task"] },
                  title: { type: "string" },
                  parent_title: { type: "string" },
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
    const rows = await dbAll(
      `SELECT m.role, m.content, m.created_at, u.name as user_name, u.avatar as user_avatar 
       FROM ai_messages m 
       LEFT JOIN users u ON u.id = m.user_id 
       WHERE ${isWizard ? 'm.project_id IS NULL AND m.user_id = ?' : 'm.project_id = ?'} 
       ORDER BY m.id ASC`,
      isWizard ? [userId] : [projectId]
    );
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/history/:projectId', authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  try {
    await dbRun(`DELETE FROM ai_messages WHERE project_id = ?`, [projectId]);
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
    const task = await dbGet(
      `SELECT * FROM ai_active_tasks
       WHERE user_id = ?
       AND ${isWizard ? 'project_id IS NULL' : 'project_id = ?'}
       AND status = 'running'
       LIMIT 1`,
      isWizard ? [userId] : [userId, projectId]
    );
    res.json({ active: !!task, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Route Chat (Refactorisée pour l'arrière-plan) ───────────────────────────
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages, projectId, mode = 'project' } = req.body;
  const userId = req.user.id;

  const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
  const apiKeys = rawKeys ? rawKeys.split(',').map(k => k.trim()).filter(k => !!k) : [];

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: "Clé API Gemini manquante." });
  }

  const userText = messages[messages.length - 1].content;
  let projectTitle = 'ce projet';

  try {
    if (projectId) {
      const p = await dbGet(`SELECT title FROM projects WHERE id = ?`, [projectId]);
      if (p) projectTitle = p.title;
    }

    // Sauvegarde immédiate du message utilisateur (si mode projet ou wizard)
    await dbRun(
      `INSERT INTO ai_messages (project_id, user_id, role, content) VALUES (?, ?, 'user', ?)`,
      [projectId || null, userId, userText]
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
       AND ${isWizard ? 'project_id IS NULL' : 'project_id = ?'}`,
      isWizard ? [userId] : [userId, projectId]
    );
  } catch (err) {
    console.error('Failed to clean up old tasks', err);
  }

  // Création de la tâche en arrière-plan
  let taskId = null;
  try {
    const taskRes = await dbRun(
      `INSERT INTO ai_active_tasks (user_id, project_id, status) VALUES (?, ?, 'running')`,
      [userId, projectId || null]
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

    try {
      for (let i = 0; i < apiKeys.length; i++) {
        const apiKey = apiKeys[i];
        try {
          const actions = [];
          const genAI = new GoogleGenerativeAI(apiKey);
          let sysInstruct = '';
          let currentTools = undefined;

          const currentDate = new Date().toISOString().split('T')[0];

          if (mode === 'global') {
            sysInstruct = `Tu es Galineo AI, le conseiller personnel de l'utilisateur.
            TON RÔLE :
            - Expert du logiciel Galineo. 
            - IMPORTANT : Tu n'as accès à AUCUNE donnée de projet spécifique ici. Redirige vers la 'Galineo Room' pour cela.
            - DATE DU JOUR : ${currentDate}.
            - RÈGLE D'OR : N'appelle JAMAIS d'outil sans demander confirmation.`;
            currentTools = undefined;
          } else if (mode === 'wizard') {
            sysInstruct = `Tu es l'Assistant Wizard de Galineo. Ton but est d'accompagner l'utilisateur dans la création COMPLÈTE de son projet via un dialogue structuré et collaboratif.
            
            RÈGLES CRITIQUES :
            1. DATE DU JOUR : ${currentDate}. Tout projet doit commencer au plus tôt à cette date.
            2. ÉCHÉANCES : Tu DOIS impérativement générer une 'start_date' et une 'due_date' (format YYYY-MM-DD) pour CHAQUE fonctionnalité et CHAQUE tâche créée via les outils. Ne laisse jamais ces champs vides.
            3. OUTILS : Utilise 'creer_projet' pour tout finaliser.
            4. TON : Professionnel, enthousiaste et efficace.`;
            currentTools = toolConfig;
          } else { // mode === 'project'
            sysInstruct = `Tu es l'Assistant de Projet Galineo Room dédié au projet "${projectTitle}".
            CONTEXTE CRITIQUE : ID Projet = ${projectId}. DATE DU JOUR : ${currentDate}.
            RÔLE : Tu as accès aux outils pour gérer les tâches, les membres et les paramètres.
            
            RÈGLES CRITIQUES :
            1. ÉCHÉANCES : Pour toute création d'élément (outil 'creer_elements'), tu DOIS impérativement fournir une 'start_date' et une 'due_date' logiques.
            2. Noms : Pas de noms techniques de fonctions. Parle naturellement.`;
            currentTools = toolConfig;
          }

          const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: { role: "system", parts: [{ text: sysInstruct }] }
          }, { apiVersion: 'v1beta' });

          const rawHistory = messages.slice(0, -1).map(m => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
            parts: [{ text: m.content }]
          }));

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

          const result = await sendMessageWithRetry(userText);
          let response = result.response;
          let text = "";
          let currentProjectIdTask = projectId;

          let toolCallsCount = 0;
          while (response.functionCalls()?.length > 0 && toolCallsCount < 5) {
            toolCallsCount++;
            const calls = response.functionCalls();
            const toolLogs = [];
            for (const call of calls) {
              const fn = functions[call.name];
              if (fn) {
                const apiRes = await fn(call.args, userId);

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
          const saveProjectId = (mode === 'wizard') ? (projectId || null) : (currentProjectIdTask || projectId || null);

          await dbRun(
            `INSERT INTO ai_messages (project_id, user_id, role, content) VALUES (?, ?, 'model', ?)`,
            [saveProjectId, userId, text]
          );

          // Notification finale
          await dbRun(
            'INSERT INTO notifications (user_id, type, title, message, project_id) VALUES (?, ?, ?, ?, ?)',
            [userId, 'ai_response', 'Réponse de l\'IA prête', `L'Assistant a terminé son analyse pour le projet "${projectTitle}".`, currentProjectIdTask]
          );

          success = true;
          break; // Sortie de la boucle des clés API si succès

        } catch (err) {
          lastError = err;
          if (err.message.includes('429') && i < apiKeys.length - 1) continue;
          console.error('[AI Background Error]', err);
          break;
        }
      }

      // Mise à jour finale du statut de la tâche
      if (taskId) {
        await dbRun(
          `UPDATE ai_active_tasks SET status = ? WHERE id = ?`,
          [success ? 'completed' : 'failed', taskId]
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
