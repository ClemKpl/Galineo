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
  new Promise((res, rej) => db.run(sql, params, function(err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); }));

// ─── Outils (Tools) ───────────────────────────────────────────────────────────
async function toolCreerProjet({ titre, description, deadline }, userId) {
  const result = await dbRun(
    `INSERT INTO projects (title, description, deadline, owner_id, status) VALUES (?, ?, ?, ?, 'active')`,
    [titre, description || null, deadline || null, userId]
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
      `INSERT INTO tasks (project_id, title, description, status, priority, phase, start_date, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, el.title, el.description || null, el.status || 'todo',
       el.priority || 'normal', el.phase || null, el.start_date || null, el.due_date || null, userId]
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
    const r = await dbRun(
      `INSERT INTO tasks (project_id, parent_id, title, description, status, priority, phase, start_date, due_date, created_by, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [project_id, parentId, el.title, el.description || null, el.status || 'todo',
       el.priority || 'normal', el.phase || null, el.start_date || null, el.due_date || null, userId, assignedTo]
    );
    created++;
  }
  return { succes: true, crees: created, message: `${created} élément(s) créé(s)` };
}

async function toolListerProjets(userId) {
  const rows = await dbAll(
    `SELECT p.id, p.title, p.status FROM projects p JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ? WHERE p.status = 'active'`,
    [userId]
  );
  return { projets: rows };
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
            titre: { type: 'STRING', description: 'Titre du projet' },
            description: { type: 'STRING', description: 'Description du projet' },
            deadline: { type: 'STRING', description: 'Date limite YYYY-MM-DD' }
          },
          required: ['titre']
        }
      },
      {
        name: 'creer_elements',
        description: 'Créer des fonctionnalités et tâches dans un projet.',
        parameters: {
          type: 'OBJECT',
          properties: {
            project_id: { type: 'NUMBER', description: 'ID du projet cible' },
            elements: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  type: { type: 'STRING', enum: ['feature', 'task'] },
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  parent_title: { type: 'STRING', description: 'Titre de la feature parente (obligatoire pour tasks)' }
                },
                required: ['type', 'title']
              }
            }
          },
          required: ['project_id', 'elements']
        }
      },
      {
        name: 'lister_projets',
        description: 'Lister les projets de l\'utilisateur.',
        parameters: { type: 'OBJECT', properties: {} }
      }
    ]
  }
];

// ─── Route Chat ───────────────────────────────────────────────────────────────
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages } = req.body;
  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY non configurée dans le fichier .env du backend.' });

  try {
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        tools: GOOGLE_TOOLS,
        system_instruction: { parts: [{ text: "Tu es Galineo AI. Tu aides à structurer des projets. Réponds en français. Utilise les outils pour créer projets et tâches." }] }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Erreur Gemini');

    let candidate = data.candidates?.[0]?.content;
    if (!candidate) return res.json({ reply: "Désolé, je n'ai pas pu générer de réponse." });

    let finalMessage = "";
    const textPart = candidate.parts.find(p => p.text);
    if (textPart) finalMessage = textPart.text;

    // Gestion des appels d'outils
    const toolPart = candidate.parts.find(p => p.functionCall);
    if (toolPart) {
      const name = toolPart.functionCall.name;
      const args = toolPart.functionCall.args;
      let toolResult;
      
      try {
        if (name === 'creer_projet') toolResult = await toolCreerProjet(args, req.user.id);
        else if (name === 'creer_elements') toolResult = await toolCreerElements(args, req.user.id);
        else if (name === 'lister_projets') toolResult = await toolListerProjets(req.user.id);
        
        finalMessage = `Action effectuée : ${toolResult?.message || 'Succès'}. ${finalMessage}`;
      } catch (toolErr) {
        finalMessage = `Erreur lors de l'action : ${toolErr.message}. ${finalMessage}`;
      }
    }

    res.json({ reply: finalMessage || "J'ai bien pris en compte votre demande." });
  } catch (err) {
    console.error('[AI] Erreur:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
