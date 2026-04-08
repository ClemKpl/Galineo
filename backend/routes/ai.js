const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logActivity } = require('../utils/activityLogger');

const MODEL_NAME = "gemini-flash-latest";

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
  creer_projet: async ({ titre, description, deadline, start_date }, userId) => {
    const result = await dbRun(
      `INSERT INTO projects (title, description, deadline, start_date, owner_id, status) VALUES (?, ?, ?, ?, ?, 'active')`,
      [titre, description || null, deadline || null, start_date || null, userId]
    );
    const projectId = result.lastID;
    await dbRun(`INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, 1)`, [projectId, userId]);

    // Log the action
    await logActivity(projectId, userId, 'project', projectId, 'created', {
      title: titre,
      details: "Configuration initiale du projet par l'IA"
    });

    return { message: `Projet "${titre}" créé avec succès (ID: ${projectId})` };
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

      // Notifier si assignation (même si c'est soi-même, car via IA)
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

      // Notifier si assignation (même si c'est soi-même, car via IA)
      if (assignedTo) {
        await dbRun(
          'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [assignedTo, 'task_assigned', 'Nouvelle tâche', `"${el.title}" vous a été assignée par l'Assistant IA.`, project_id, taskId, null]
        );
      }
    }

    // Log the batch creation (Attribuer à l'IA via null)
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

    // Notifier si nouvelle assignation (même si c'est soi-même, car via IA)
    if (assignedTo) {
      await dbRun(
        'INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [assignedTo, 'task_assigned', 'Tâche assignée', `La tâche #${task_id} ("${title || 'sans titre'}") vous a été assignée par l'Assistant IA.`, projectId, task_id, null]
      );
    }

    // Log modification (Attribuer à l'IA via null)
    await logActivity(projectId, null, 'task', task_id, 'updated', {
      task_id,
      changes: fields.join(', '),
      details: "Modification via Assistant IA"
    });

    return { message: `Tâche ${task_id} mise à jour` };
  },

  gerer_membres: async ({ project_id, email, action }, userId) => {
    // action: "add" ou "remove"
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
  }
};

const toolConfig = [
  {
    functionDeclarations: [
      {
        name: "creer_projet",
        description: "Crée un nouveau projet Galineo",
        parameters: {
          type: "object",
          properties: {
            titre: { type: "string" },
            description: { type: "string" },
            deadline: { type: "string" },
            start_date: { type: "string" }
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
                  start_date: { type: "string", description: "Date de début obligatoire (YYYY-MM-DD)" },
                  due_date: { type: "string", description: "Date d'échéance obligatoire (YYYY-MM-DD)" },
                  assigned_email: { type: "string", description: "Email de la personne à assigner" }
                },
                required: ["type", "title", "start_date", "due_date"]
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
            start_date: { type: "string", description: "Nouvelle date de début (YYYY-MM-DD)" },
            due_date: { type: "string", description: "Nouvelle date d'échéance (YYYY-MM-DD)" },
            assigned_email: { type: "string" }
          },
          required: ["task_id"]
        }
      },
      {
        name: "voir_taches",
        description: "Récupère la liste des tâches d'un projet pour analyse",
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
      }
    ]
  }
];

// ─── Historique ──────────────────────────────────────────────────────────────
router.get('/history/:projectId', authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  try {
    const rows = await dbAll(
      `SELECT m.role, m.content, m.created_at, u.name as user_name, u.avatar as user_avatar 
       FROM ai_messages m 
       LEFT JOIN users u ON u.id = m.user_id 
       WHERE m.project_id = ? 
       ORDER BY m.id ASC`,
      [projectId]
    );
    res.json({ history: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Route Chat ───────────────────────────────────────────────────────────────
// ─── Route Chat ───────────────────────────────────────────────────────────────
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages, projectId, mode = 'project' } = req.body;

  // Support either GEMINI_API_KEYS="key1,key2" or GEMINI_API_KEY="key1"
  const rawKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;
  const apiKeys = rawKeys ? rawKeys.split(',').map(k => k.trim()).filter(k => !!k) : [];

  if (apiKeys.length === 0) {
    return res.status(500).json({ error: "Clé API Gemini manquante. Configurez GEMINI_API_KEYS (séparées par des virgules) sur Render/Vercel ou dans le .env." });
  }

  let lastError = null;

  // Boucle de repli (Fallback) : on essaie chaque clé si la précédente échoue par quota
  for (let i = 0; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      const userText = messages[messages.length - 1].content;
      let projectTitle = 'ce projet';

      if (projectId) {
        const p = await dbGet(`SELECT title FROM projects WHERE id = ?`, [projectId]);
        if (p) projectTitle = p.title;
      }

      // Persister le message utilisateur (seulement au premier essai pour éviter doublons)
      if (i === 0 && projectId && mode === 'project') {
        await dbRun(
          `INSERT INTO ai_messages (project_id, user_id, role, content) VALUES (?, ?, 'user', ?)`,
          [projectId, req.user.id, userText]
        );
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      let sysInstruct = '';
      let currentTools = undefined;

      if (mode === 'global') {
        sysInstruct = `Tu es Galineo AI, le conseiller personnel de l'utilisateur.
        TON RÔLE :
        - Être un expert absolu du logiciel Galineo (Tableaux de bord, gestion de tâches, GANTT, rôles, etc.). 
        - Accompagner l'utilisateur dans sa prise en main et sa méthodologie.
        - IMPORTANT : Tu n'as accès à AUCUNE donnée de projet spécifique. Si l'utilisateur a une question sur ses tâches actuelles, redirige-le vers la 'Galineo Room' (onglet Assistant IA) de son projet.
        - Ne fais jamais de suppositions sur les projets de l'utilisateur.
        - RÈGLE D'OR : N'appelle JAMAIS d'outil (s'ils étaient disponibles) sans décrire l'action et demander "Souhaitez-vous que je réalise cette action ?".`;
        currentTools = undefined;
      } else if (mode === 'wizard') {
        sysInstruct = `Tu es l'Assistant Wizard de Galineo. Ton but est d'aider l'utilisateur à créer un nouveau projet par le dialogue.
        VÉRIFICATION : Pour créer un projet, tu dois impérativement avoir :
        1. Un Titre clair.
        2. Une Description concise des objectifs.
        3. Une idée des membres ou rôles nécessaires.
        4. Une échéance ou une durée estimée.
        
        PROCÉDURE :
        - Si des informations manquent, demande-les une par une.
        - Une fois TOUTES les informations réunies, fais un récapitulatif complet.
        - DEMANDE DE VALIDATION : Demande "Tout me semble prêt. Voulez-vous que je lance la création du projet ?".
        - ACTION : Exécute 'creer_projet' IMMÉDIATEMENT si l'utilisateur valide (ex: "Oui", "OK", "Vas-y"). Ne redemande JAMAIS une deuxième confirmation.
        - APRÈS CRÉATION : Confirme toujours chaleureusement que le projet est prêt et souhaite une bonne gestion.`;
        currentTools = toolConfig;
      } else { // mode === 'project'
        sysInstruct = `Tu es l'Assistant de Projet Galineo Room dédié au projet "${projectTitle}".
        TON RÔLE :
        - Être l'expert technique du logiciel Galineo ET du projet "${projectTitle}".
        - Tu as accès aux outils pour lister et modifier les tâches/membres de CE PROJET uniquement.
        - IMPORTANT : Appelle toujours le projet par son nom ("${projectTitle}") et non par son ID.
        - ISOLATION CRITIQUE : Tu ne connais strictement rien des autres projets de l'utilisateur.
        
        RÈGLE DE CONFIRMATION :
        - AVANT toute modification (créer/modifier/supprimer une tâche ou un membre), décris précisément ce que tu vas faire ET demande "Confirmez-vous cette action ?".
        - DÉCLENCHEMENT : Si l'utilisateur confirme (ex: "Oui", "OK", "Fais-le"), appelle l'outil IMMEDIATEMENT sans blabla inutile avant l'appel.
        - APRÈS l'exécution de l'outil, confirme TOUJOURS le succès à l'utilisateur de manière concise mais claire.
        
        RÈGLE DE PLANNING :
        - Pour CHAQUE tâche ou fonctionnalité créée, tu DOIS impérativement fournir une 'start_date' et une 'due_date' (format YYYY-MM-DD). C'est une obligation absolue.`;
        currentTools = toolConfig;
      }

      // Retry loop (3 attempts) for transient errors (503, Overloaded, etc.)
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: { role: "system", parts: [{ text: sysInstruct }] }
          }, { apiVersion: 'v1beta' });

          const chat = model.startChat({
            history: messages.slice(0, -1).map(m => ({
              role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
              parts: [{ text: m.content }]
            })),
            tools: currentTools
          });

          let result = await chat.sendMessage(userText);
          let response = result.response;
          let text = "";
          let actions = [];

          // Boucle pour gérer les appels d'outils successifs (jusqu'à 5 répétitions)
          let toolCallsCount = 0;
          while (response.functionCalls()?.length > 0 && toolCallsCount < 5) {
            toolCallsCount++;
            const calls = response.functionCalls();
            const toolLogs = [];
            for (const call of calls) {
              const fn = functions[call.name];
              if (fn) {
                const apiRes = await fn(call.args, req.user.id);
                toolLogs.push({ name: call.name, res: apiRes });
                if (!actions.includes(call.name)) actions.push(call.name);
              }
            }
            const toolResponses = toolLogs.map(l => ({
              functionResponse: { name: l.name, response: l.res }
            }));
            const secondResult = await chat.sendMessage(toolResponses);
            response = secondResult.response;
          }

          // Récupération finale du texte
          try {
            text = response.text();
          } catch (e) {
            console.warn("⚠️ [AI] Pas de texte trouvé dans la réponse finale, utilisation du fallback.");
          }

          // Fallback si le texte est vide (évite les bulles vides côté frontend)
          if (!text || text.trim() === "") {
            if (actions.length > 0) {
              text = "C'est fait ! Les modifications ont été appliquées avec succès.";
            } else {
              text = "Désolé, j'ai rencontré une difficulté pour formuler ma réponse, mais vos données sont à jour.";
            }
          }

          // Persister la réponse de l'IA
          if (projectId && mode === 'project') {
            await dbRun(`INSERT INTO ai_messages (project_id, role, content) VALUES (?, 'model', ?)`, [projectId, text]);
          }

          // Si on arrive ici, c'est un succès, on sort de la boucle
          return res.json({ reply: text, actions });

        } catch (err) {
          const errorMsg = err.message || "";
          const isRetryable = errorMsg.includes('503') || 
                             errorMsg.toLowerCase().includes('overloaded') || 
                             errorMsg.toLowerCase().includes('high demand') ||
                             errorMsg.toLowerCase().includes('service unavailable');

          if (isRetryable && attempt < 3) {
            console.warn(`⚠️ [AI Retry] Tentative ${attempt}/3 échouée pour la clé ${i + 1} (${errorMsg.substring(0, 50)}...). Nouvelle tentative dans ${attempt}s...`);
            await sleep(attempt * 1000);
            continue; // On réessaie avec la MÊME clé
          }

          // Si ce n'est pas retryable (ex: 429) ou qu'on a épuisé les essais, on laisse l'erreur remonter au block catch parent (Fallback)
          throw err;
        }
      }

    } catch (err) {
      lastError = err;
      const errorMsg = err.message || "";
      // Si c'est une erreur de quota (429) ou de clé invalide au démarrage
      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('quota') || errorMsg.toLowerCase().includes('api_key_invalid')) {
        console.warn(`⚠️ [AI Fallback] La clé ${i + 1} a échoué (quota/invalid). Tentative avec la suivante...`);
        if (i < apiKeys.length - 1) continue; // On passe à la suivante
      }

      // Si on est à la dernière clé ou que c'est une autre erreur, on s'arrête
      console.error('[AI Final Error]', err);
      break;
    }
  }

  // Si on est sorti de la boucle sans succès
  res.status(500).json({ error: lastError?.message || "Échec de l'IA après épuisement de toutes les clés disponibles." });
});

module.exports = router;
