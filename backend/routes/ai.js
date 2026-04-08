const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { GoogleGenerativeAI } = require("@google/generative-ai");

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
    return { message: `Tâche ${task_id} mise à jour` };
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
      }
    ]
  }
];

// ─── Historique ──────────────────────────────────────────────────────────────
router.get('/history/:projectId', authMiddleware, async (req, res) => {
  const { projectId } = req.params;
  try {
    const rows = await dbAll(
      `SELECT m.role, m.content, u.name as user_name 
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
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages, projectId } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: "Clé API Gemini manquante. Configurez GEMINI_API_KEY sur Render." });

  try {
    const userText = messages[messages.length - 1].content;

    // Persister le message utilisateur si on est dans un projet
    if (projectId) {
      await dbRun(
        `INSERT INTO ai_messages (project_id, user_id, role, content) VALUES (?, ?, 'user', ?)`,
        [projectId, req.user.id, userText]
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      systemInstruction: {
        role: "system",
        parts: [{ text: `Tu es Galineo AI. Date: ${new Date().toISOString().split('T')[0]}. ${projectId ? `ID Projet: ${projectId}.` : "Dashboard."} Assistant de gestion de projet. Réponds en français.` }]
      }
    }, { apiVersion: 'v1beta' });

    const chat = model.startChat({
      history: messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      tools: toolConfig
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

    // Persister la réponse de l'IA si on est dans un projet
    if (projectId) {
      await dbRun(
        `INSERT INTO ai_messages (project_id, role, content) VALUES (?, 'model', ?)`,
        [projectId, text]
      );
    }

    res.json({ reply: text });
  } catch (err) {
    console.error('[AI Error]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
