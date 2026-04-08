const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const activityLogger = require('../utils/activityLogger');

const MODEL_NAME = "gemini-flash-latest";

// ─── Promisify db ─────────────────────────────────────────────────────────────
const dbGet = (sql, params) =>
  new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, params) =>
  new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (sql, params) =>
  new Promise((res, rej) => db.run(sql, params, function (err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); }));

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
    await activityLogger.log(projectId, userId, 'Projet créé via Assistant IA', 'create_project', { 
      title: titre,
      details: "Configuration initiale du projet par l'IA"
    });

    return { message: `Projet "${titre}" créé avec succès (ID: ${projectId})` };
  },

  creer_elements: async ({ project_id, elements }, userId) => {
    let created = 0;
    const featureMap = {};
    for (const el of elements.filter(e => e.type === 'feature')) {
      const r = await dbRun(
        `INSERT INTO tasks (project_id, title, description, status, priority, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
        [project_id, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', userId]
      );
      featureMap[el.title] = r.lastID;
      created++;
    }
    for (const el of elements.filter(e => e.type === 'task')) {
      const r = await dbRun(
        `INSERT INTO tasks (project_id, parent_id, title, description, status, priority, due_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [project_id, featureMap[el.parent_title] || null, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', el.due_date || null, userId]
      );
      created++;
    }

    // Log the batch creation
    await activityLogger.log(project_id, userId, `${created} éléments créés via Assistant IA`, 'create_task', { 
      batch_count: created,
      details: "Génération automatique d'éléments de projet" 
    });

    return { message: `${created} éléments créés dans le projet ${project_id}` };
  },

  modifier_tache: async ({ task_id, title, status, priority, due_date, assigned_email }) => {
    let assignedTo = undefined;
    if (assigned_email) {
      const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [assigned_email]);
      if (u) assignedTo = u.id;
    }
    const fields = []; const params = [];
    if (title) { fields.push('title = ?'); params.push(title); }
    if (status) { fields.push('status = ?'); params.push(status); }
    if (priority) { fields.push('priority = ?'); params.push(priority); }
    if (due_date) { fields.push('due_date = ?'); params.push(due_date); }
    if (assignedTo !== undefined) { fields.push('assigned_to = ?'); params.push(assignedTo); }
    if (fields.length === 0) return { message: 'Aucune modification' };
    params.push(task_id);
    await dbRun(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);

    // Log modification
    await activityLogger.log(undefined, userId, `Tâche #${task_id} modifiée via Assistant IA`, 'update_task', { 
      task_id, 
      changes: fields.join(', ') 
    });

    return { message: `Tâche ${task_id} mise à jour` };
  },

  gerer_membres: async ({ project_id, email, action }, userId) => {
    // action: "add" ou "remove"
    const u = await dbGet('SELECT id, name FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (!u) return { error: `Utilisateur avec l'email ${email} introuvable.` };

    if (action === 'add') {
      await dbRun(`INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, 3)`, [project_id, u.id]);
      await activityLogger.log(project_id, userId, `Membre ${u.name} ajouté via Assistant IA`, 'add_member', { email });
      return { message: `Membre ${u.name} (${email}) ajouté au projet.` };
    } else {
      await dbRun(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [project_id, u.id]);
      await activityLogger.log(project_id, userId, `Membre ${u.name} retiré via Assistant IA`, 'remove_member', { email });
      return { message: `Membre ${u.name} (${email}) retiré du projet.` };
    }
  },

  voir_taches: async ({ project_id }) => {
    const rows = await dbAll(`SELECT id, title, status, priority, due_date FROM tasks WHERE project_id = ?`, [project_id]);
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
                  due_date: { type: "string" }
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
            due_date: { type: "string" },
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
        - ACTION : Exécute 'creer_projet' IMMÉDIATEMENT si l'utilisateur valide (ex: "Oui", "OK", "Vas-y"). Ne redemande JAMAIS une deuxième confirmation.`;
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
        - DÉCLENCHEMENT : Si le message précédent de l'utilisateur est une confirmation (ex: "Oui", "OK", "Fais-le"), appelle l'outil DIRECTEMENT sans aucun blabla et sans reposer de question.
        - Ne redemande JAMAIS deux fois.`;
        currentTools = toolConfig;
      }

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

      const calls = response.functionCalls();
      if (calls && calls.length > 0) {
        const toolLogs = [];
        for (const call of calls) {
          const fn = functions[call.name];
          if (fn) {
            const apiRes = await fn(call.args, req.user.id);
            toolLogs.push({ name: call.name, res: apiRes });
          }
        }
        const toolResponses = toolLogs.map(l => ({
          functionResponse: { name: l.name, response: l.res }
        }));
        const secondResult = await chat.sendMessage(toolResponses);
        text = secondResult.response.text();
        const actionNames = toolLogs.map(l => l.name).join(', ');
        text = `[Actions: ${actionNames}] ${text}`;
      } else {
        text = response.text();
      }

      // Persister la réponse de l'IA
      if (projectId && mode === 'project') {
        await dbRun(`INSERT INTO ai_messages (project_id, role, content) VALUES (?, 'model', ?)`, [projectId, text]);
      }

      // Si on arrive ici, c'est un succès, on sort de la boucle
      return res.json({ reply: text });

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
