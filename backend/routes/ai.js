const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const MODEL = 'mistral-large-latest';

// ─── Promisify db ─────────────────────────────────────────────────────────────
const dbGet = (sql, params) =>
  new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, params) =>
  new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (sql, params) =>
  new Promise((res, rej) => db.run(sql, params, function(err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); }));

// ─── Outils ───────────────────────────────────────────────────────────────────
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

  // 1) Features d'abord
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

  // 2) Tasks ensuite
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
    if (assignedTo) {
      await dbRun(
        `INSERT INTO notifications (user_id, type, title, message, project_id, task_id, from_user_id)
         VALUES (?, 'task_assigned', ?, ?, ?, ?, ?)`,
        [assignedTo, `Tâche assignée : ${el.title}`, `Vous avez été assigné à la tâche "${el.title}"`, project_id, r.lastID, userId]
      );
    }
    created++;
  }

  return { succes: true, crees: created, message: `${created} élément(s) créé(s)` };
}

async function toolListerProjets(userId) {
  const rows = await dbAll(
    `SELECT p.id, p.title, p.status, COUNT(pm2.user_id) as member_count
     FROM projects p
     JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = ?
     LEFT JOIN project_members pm2 ON p.id = pm2.project_id
     WHERE p.status = 'active'
     GROUP BY p.id`,
    [userId]
  );
  return { projets: rows };
}

async function toolVoirTaches({ project_id }, userId) {
  // Vérifier l'accès
  const member = await dbGet('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?', [project_id, userId]);
  if (!member) throw new Error('Accès refusé à ce projet');
  const rows = await dbAll(
    `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.parent_id,
            u.name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.project_id = ?
     ORDER BY t.parent_id NULLS FIRST, t.id`,
    [project_id]
  );
  const elements = rows.map(r => ({
    id: r.id,
    titre: r.title,
    type: r.parent_id ? 'task' : 'feature',
    statut: r.status,
    priorite: r.priority,
    echeance: r.due_date || '—',
    assigne: r.assignee_name || '—',
  }));
  return { elements };
}

// ─── Définition des outils pour Mistral ──────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'creer_projet',
      description: "Créer un nouveau projet Galineo. À appeler avant d'ajouter des éléments.",
      parameters: {
        type: 'object',
        properties: {
          titre:       { type: 'string', description: 'Titre du projet' },
          description: { type: 'string', description: 'Description du projet (optionnel)' },
          deadline:    { type: 'string', description: 'Date limite YYYY-MM-DD (optionnel)' },
        },
        required: ['titre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'creer_elements',
      description: `Créer des fonctionnalités (features) et des tâches (tasks) dans un projet.
Types autorisés UNIQUEMENT : "feature" (module/catégorie) et "task" (action concrète).
Créer les features en premier. Les tasks doivent avoir parent_title = titre exact de leur feature parente.`,
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'number', description: 'ID du projet cible' },
          elements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type:           { type: 'string', enum: ['feature', 'task'] },
                title:          { type: 'string' },
                description:    { type: 'string' },
                status:         { type: 'string', enum: ['todo', 'in_progress', 'done'] },
                priority:       { type: 'string', enum: ['normal', 'urgent_important', 'urgent_not_important', 'not_urgent_important'] },
                phase:          { type: 'string' },
                start_date:     { type: 'string', description: 'YYYY-MM-DD' },
                due_date:       { type: 'string', description: 'YYYY-MM-DD' },
                assigned_email: { type: 'string' },
                parent_title:   { type: 'string', description: 'Titre exact de la feature parente (obligatoire pour les tasks)' },
              },
              required: ['type', 'title'],
            },
          },
        },
        required: ['project_id', 'elements'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lister_projets',
      description: "Lister les projets actifs de l'utilisateur.",
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'voir_taches',
      description: "Voir les fonctionnalités et tâches d'un projet.",
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'number', description: 'ID du projet' },
        },
        required: ['project_id'],
      },
    },
  },
];

// ─── Prompt système ───────────────────────────────────────────────────────────
function getSystemPrompt() {
  const today = new Date().toISOString().split('T')[0];
  return `Tu es Galineo AI, un assistant de gestion de projet intégré à la plateforme Galineo.
Tu aides l'utilisateur à créer et structurer des projets directement dans Galineo.

== CE QUE TU PEUX CRÉER ==
- Des PROJETS avec titre, description et deadline optionnelle
- Des FONCTIONNALITÉS (type "feature") : les grands modules du projet
- Des TÂCHES (type "task") : les actions concrètes sous une feature

== RÈGLES ==
1. Seuls les types "feature" et "task" sont autorisés
2. Chaque task DOIT avoir parent_title = titre exact d'une feature du projet
3. Toujours créer les features avant les tasks (dans le même appel ou en premier)
4. Si le projet est vague, pose 1-2 questions ciblées

== STYLE ==
- Réponds en français, de façon concise et professionnelle
- Après création, fais un résumé : X features, Y tâches créées
- Tu peux lister les projets existants si l'utilisateur veut enrichir un projet existant

Date du jour : ${today}`;
}

// ─── Boucle agentique ─────────────────────────────────────────────────────────
async function runAgenticLoop(messages, userId) {
  const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
  if (!MISTRAL_KEY) throw new Error('MISTRAL_API_KEY non configurée sur le serveur');

  const history = [{ role: 'system', content: getSystemPrompt() }, ...messages];
  const MAX_STEPS = 8;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: history,
        tools: TOOLS,
        tool_choice: 'auto',
        max_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Mistral API ${res.status}: ${err}`);
    }

    const data = await res.json();
    const msg = data.choices[0].message;
    history.push(msg);

    // Pas d'outil → réponse finale
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content;
    }

    // Exécution des outils
    for (const call of msg.tool_calls) {
      let args;
      try { args = JSON.parse(call.function.arguments); } catch { args = {}; }

      let result;
      try {
        switch (call.function.name) {
          case 'creer_projet':   result = await toolCreerProjet(args, userId);     break;
          case 'creer_elements': result = await toolCreerElements(args, userId);   break;
          case 'lister_projets': result = await toolListerProjets(userId);         break;
          case 'voir_taches':    result = await toolVoirTaches(args, userId);      break;
          default: result = { erreur: `Outil inconnu : ${call.function.name}` };
        }
      } catch (e) {
        result = { erreur: e.message };
      }

      history.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: JSON.stringify(result),
      });
    }
  }

  return "J'ai atteint la limite de traitement. Peux-tu reformuler ta demande ?";
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.post('/chat', authMiddleware, async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages requis' });
  }

  try {
    const reply = await runAgenticLoop(messages, req.user.id);
    res.json({ reply });
  } catch (err) {
    console.error('[AI] Erreur:', err.message);
    const isApiKey = err.message.includes('401') || err.message.includes('Unauthorized');
    res.status(500).json({
      error: isApiKey
        ? 'Clé API Mistral invalide. Vérifie MISTRAL_API_KEY dans le fichier .env du backend.'
        : err.message,
    });
  }
});

module.exports = router;
