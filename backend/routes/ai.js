const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const MODEL = 'gemini-1.5-flash';

// ─── Promisify db ─────────────────────────────────────────────────────────────
const dbGet = (sql, params) =>
  new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, params) =>
  new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (sql, params) =>
  new Promise((res, rej) => db.run(sql, params, function (err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); }));

// ─── Outils (Tools) ───────────────────────────────────────────────────────────
async function toolCreerProjet({ titre, description, deadline, start_date }, userId) {
  const result = await dbRun(
    `INSERT INTO projects (title, description, deadline, start_date, owner_id, status) VALUES (?, ?, ?, ?, ?, 'active')`,
    [titre, description || null, deadline || null, start_date || null, userId]
  );
  const projectId = result.lastID;
  await dbRun(
    `INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, 1)`,
    [projectId, userId]
  );
  return { project_id: projectId, titre, message: `Projet "${titre}" créé (ID: ${projectId})` };
}

async function toolCreerElements({ project_id, elements }, userId) {
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
    const parentId = featureMap[el.parent_title] || null;
    let assignedTo = null;
    if (el.assigned_email) {
      const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [el.assigned_email]);
      if (u) assignedTo = u.id;
    }
    await dbRun(
      `INSERT INTO tasks (project_id, parent_id, title, description, status, priority, due_date, created_by, assigned_to) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, parentId, el.title, el.description || null, el.status || 'todo', el.priority || 'normal', el.due_date || null, userId, assignedTo]
    );
    created++;
  }
  return { succes: true, crees: created, message: `${created} élément(s) créé(s)` };
}

async function toolModifierTache({ task_id, title, status, priority, due_date, assigned_email }, userId) {
  const task = await dbGet('SELECT project_id FROM tasks WHERE id = ?', [task_id]);
  if (!task) throw new Error('Tâche introuvable');
  
  let assignedTo = undefined;
  if (assigned_email) {
    const u = await dbGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [assigned_email]);
    if (u) assignedTo = u.id;
  }

  const fields = [];
  const params = [];
  if (title !== undefined) { fields.push('title = ?'); params.push(title); }
  if (status !== undefined) { fields.push('status = ?'); params.push(status); }
  if (priority !== undefined) { fields.push('priority = ?'); params.push(priority); }
  if (due_date !== undefined) { fields.push('due_date = ?'); params.push(due_date); }
  if (assignedTo !== undefined) { fields.push('assigned_to = ?'); params.push(assignedTo); }

  if (fields.length === 0) return { message: 'Aucune modification demandée' };
  
  params.push(task_id);
  await dbRun(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);
  return { message: `Tâche ${task_id} mise à jour avec succès` };
}

async function toolVoirTaches({ project_id }, userId) {
  const rows = await dbAll(`SELECT id, title, status, priority, due_date FROM tasks WHERE project_id = ?`, [project_id]);
  return { tasks: rows };
}

// ─── Définition des outils pour Gemini ───────────────────────────────────────
const GOOGLE_TOOLS = [
  {
    function_declarations: [
      {
        name: 'creer_projet',
        description: 'Créer un nouveau projet Galineo.',
        parameters: {
          type: 'OBJECT',
          properties: {
            titre: { type: 'STRING' },
            description: { type: 'STRING' },
            deadline: { type: 'STRING' },
            start_date: { type: 'STRING' }
          },
          required: ['titre']
        }
      },
      {
        name: 'creer_elements',
        description: 'Créer des fonctionnalités et tâches.',
        parameters: {
          type: 'OBJECT',
          properties: {
            project_id: { type: 'NUMBER' },
            elements: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  type: { type: 'STRING', enum: ['feature', 'task'] },
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  parent_title: { type: 'STRING' },
                  due_date: { type: 'STRING' }
                },
                required: ['type', 'title']
              }
            }
          },
          required: ['project_id', 'elements']
        }
      },
      {
        name: 'modifier_tache',
        description: 'Modifier une tâche existante (date, assignation, statut).',
        parameters: {
          type: 'OBJECT',
          properties: {
            task_id: { type: 'NUMBER' },
            title: { type: 'STRING' },
            status: { type: 'STRING', enum: ['todo', 'in_progress', 'done'] },
            priority: { type: 'STRING' },
            due_date: { type: 'STRING' },
            assigned_email: { type: 'STRING' }
          },
          required: ['task_id']
        }
      },
      {
        name: 'voir_taches',
        description: 'Voir les tâches d\'un projet pour avoir du contexte.',
        parameters: {
          type: 'OBJECT',
          properties: { project_id: { type: 'NUMBER' } },
          required: ['project_id']
        }
      }
    ]
  }
];

// ─── Route Chat ───────────────────────────────────────────────────────────────
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages, projectId } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY non configurée.' });

  try {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const sysInstruct = `Tu es Galineo AI. Date actuelle: ${new Date().toISOString().split('T')[0]}.
    Tu es un assistant de gestion de projet. ${projectId ? `Tu es actuellement DANS le projet ID ${projectId}.` : 'Tu es sur le dashboard global.'}
    Actions autorisées : 
    - Réajuster des dates (modifier_tache)
    - Assigner des membres par email (modifier_tache)
    - Créer des tâches/fonctionnalités (creer_elements)
    - Créer de nouveaux projets (creer_projet)
    Toujours demander confirmation avant de grosses modifications. Réponds en français de façon concise.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        tools: GOOGLE_TOOLS,
        system_instruction: { parts: [{ text: sysInstruct }] }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erreur Gemini');

    let candidate = data.candidates?.[0]?.content;
    if (!candidate) return res.json({ reply: "Désolé, je n'ai pas pu générer de réponse." });

    let finalMessage = "";
    const textPart = candidate.parts.find(p => p.text);
    if (textPart) finalMessage = textPart.text;

    const toolPart = candidate.parts.find(p => p.functionCall);
    if (toolPart) {
      const { name, args } = toolPart.functionCall;
      let result;
      if (name === 'creer_projet') result = await toolCreerProjet(args, req.user.id);
      else if (name === 'creer_elements') result = await toolCreerElements(args, req.user.id);
      else if (name === 'modifier_tache') result = await toolModifierTache(args, req.user.id);
      else if (name === 'voir_taches') result = await toolVoirTaches(args, req.user.id);
      
      finalMessage = `[Action: ${name}] ${result?.message || 'Exécuté'}. ${finalMessage}`;
    }

    res.json({ reply: finalMessage || "J'ai bien pris en compte votre demande." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
