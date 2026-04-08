#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════╗
 * ║              Galineo AI — Chatbot Mistral            ║
 * ║  Décris ton projet, l'IA le crée dans Galineo.       ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Lancement :
 *   node chat.js
 *
 * Variables d'environnement (.env) :
 *   MISTRAL_API_KEY    Clé API Mistral
 *   GALINEO_API_URL    URL du backend (défaut: http://localhost:3001)
 *   GALINEO_EMAIL      (optionnel) pré-rempli
 *   GALINEO_PASSWORD   (optionnel) pré-rempli
 */

import readline from 'readline';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ─── Chargement du .env ───────────────────────────────────────────────────────
// On lit le .env manuellement (pas de dépendance dotenv)
const __dir = dirname(fileURLToPath(import.meta.url));
try {
  const env = readFileSync(resolve(__dir, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0 && !process.env[key]) {
      process.env[key] = rest.join('=').trim();
    }
  }
} catch {
  // Pas de .env, on continue avec les variables système
}

// ─── Configuration ────────────────────────────────────────────────────────────
const MISTRAL_KEY = process.env.MISTRAL_API_KEY;
const GALINEO_URL = (process.env.GALINEO_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const MODEL       = 'mistral-large-latest';

if (!MISTRAL_KEY) {
  console.error('❌  MISTRAL_API_KEY manquante. Renseigne-la dans ai/.env');
  process.exit(1);
}

// ─── État de la session ───────────────────────────────────────────────────────
let galToken = null;

// ─── Galineo API helper ───────────────────────────────────────────────────────
async function galApi(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (galToken) headers['Authorization'] = `Bearer ${galToken}`;
  const opts = { method, headers };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(`${GALINEO_URL}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

// ─── Implémentation des outils ────────────────────────────────────────────────

async function toolSeConnecter({ email, password }) {
  const data = await galApi('POST', '/auth/login', { email, password });
  galToken = data.token;
  return {
    succes: true,
    utilisateur: data.user.name,
    message: `Connecté en tant que "${data.user.name}"`
  };
}

async function toolCreerProjet({ titre, description, deadline }) {
  const body = { title: titre };
  if (description) body.description = description;
  if (deadline)    body.deadline    = deadline;
  const data = await galApi('POST', '/projects', body);
  return {
    project_id: data.id,
    titre: data.title,
    message: `Projet "${data.title}" créé avec succès (ID: ${data.id})`
  };
}

async function toolCreerElements({ project_id, elements }) {
  // Valider que seuls feature/task sont utilisés
  for (const el of elements) {
    if (el.type !== 'feature' && el.type !== 'task') {
      throw new Error(`Type interdit : "${el.type}". Seuls "feature" et "task" sont autorisés.`);
    }
  }

  // Construction du CSV
  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const header = 'type,title,description,status,priority,phase,start_date,due_date,assigned_email,parent_title';
  const rows = elements.map(e => [
    e.type        || 'feature',
    csvEscape(e.title),
    csvEscape(e.description   || ''),
    e.status      || 'todo',
    e.priority    || 'normal',
    csvEscape(e.phase         || ''),
    e.start_date  || '',
    e.due_date    || '',
    e.assigned_email || '',
    csvEscape(e.parent_title  || ''),
  ].join(','));

  const csv = [header, ...rows].join('\n');
  const result = await galApi('POST', `/projects/${project_id}/tasks/import`, { csv });

  return {
    succes: true,
    crees: result.created,
    message: `${result.created} éléments créés dans le projet`
  };
}

async function toolListerProjets() {
  const projects = await galApi('GET', '/projects');
  if (projects.length === 0) return { projets: [], message: 'Aucun projet trouvé.' };
  return {
    projets: projects.map(p => ({
      id:      p.id,
      titre:   p.title,
      statut:  p.status,
      membres: p.member_count
    }))
  };
}

async function toolVoirTaches({ project_id }) {
  const tasks = await galApi('GET', `/projects/${project_id}/tasks`);
  if (tasks.length === 0) return { elements: [], message: 'Aucune tâche dans ce projet.' };
  return {
    elements: tasks.map(t => ({
      id:      t.id,
      titre:   t.title,
      type:    t.parent_id ? 'task' : 'feature',
      statut:  t.status,
      assigne: t.assignee_name || '—',
      parent:  t.parent_id || null
    }))
  };
}

// ─── Définition des outils pour Mistral ──────────────────────────────────────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'se_connecter',
      description: "Se connecter à Galineo. Demander l'email et le mot de passe à l'utilisateur si non fournis.",
      parameters: {
        type: 'object',
        properties: {
          email:    { type: 'string', description: 'Adresse email Galineo' },
          password: { type: 'string', description: 'Mot de passe Galineo' }
        },
        required: ['email', 'password']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'creer_projet',
      description: "Créer un nouveau projet dans Galineo. Toujours appeler AVANT d'ajouter des fonctionnalités.",
      parameters: {
        type: 'object',
        properties: {
          titre:       { type: 'string', description: 'Titre du projet' },
          description: { type: 'string', description: 'Description du projet' },
          deadline:    { type: 'string', description: "Date limite au format YYYY-MM-DD (optionnel)" }
        },
        required: ['titre']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'creer_elements',
      description: `Créer des fonctionnalités (features) et des tâches (tasks) dans un projet.
- "feature" = grande catégorie / module du projet
- "task"    = action concrète sous une feature (doit avoir parent_title = titre exact de la feature parente)
Types autorisés UNIQUEMENT : "feature" et "task".
Créer toujours les features en premier, puis les tasks.`,
      parameters: {
        type: 'object',
        properties: {
          project_id: {
            type: 'number',
            description: 'ID du projet cible (obtenu via creer_projet ou lister_projets)'
          },
          elements: {
            type: 'array',
            description: 'Liste des fonctionnalités et tâches à créer dans le projet',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['feature', 'task'],
                  description: '"feature" pour une fonctionnalité, "task" pour une sous-tâche'
                },
                title: {
                  type: 'string',
                  description: 'Titre de la fonctionnalité ou tâche'
                },
                description: {
                  type: 'string',
                  description: 'Description détaillée (optionnel)'
                },
                status: {
                  type: 'string',
                  enum: ['todo', 'in_progress', 'done'],
                  description: 'Statut — défaut: "todo"'
                },
                priority: {
                  type: 'string',
                  enum: ['normal', 'urgent_important', 'urgent_not_important', 'not_urgent_important'],
                  description: 'Priorité — défaut: "normal"'
                },
                phase: {
                  type: 'string',
                  description: 'Phase ou sprint (ex: "Phase 1", "Sprint 2") — optionnel'
                },
                start_date: {
                  type: 'string',
                  description: 'Date de début au format YYYY-MM-DD — optionnel'
                },
                due_date: {
                  type: 'string',
                  description: "Date d'échéance au format YYYY-MM-DD — optionnel"
                },
                assigned_email: {
                  type: 'string',
                  description: "Email de la personne assignée — optionnel"
                },
                parent_title: {
                  type: 'string',
                  description: 'OBLIGATOIRE pour les tasks : titre EXACT de la feature parente'
                }
              },
              required: ['type', 'title']
            }
          }
        },
        required: ['project_id', 'elements']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lister_projets',
      description: 'Lister tous les projets Galineo existants de cet utilisateur.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'voir_taches',
      description: "Voir toutes les fonctionnalités et tâches d'un projet existant.",
      parameters: {
        type: 'object',
        properties: {
          project_id: { type: 'number', description: 'ID du projet' }
        },
        required: ['project_id']
      }
    }
  }
];

// ─── Prompt système ───────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];
const SYSTEM_PROMPT = `Tu es Galineo AI, un assistant de gestion de projet intelligent et bienveillant.
Tu aides les utilisateurs à créer et structurer leurs projets directement dans l'outil Galineo.

== CE QUE TU PEUX CRÉER ==
- Des PROJETS avec titre, description et deadline optionnelle
- Des FONCTIONNALITÉS (type "feature") : les grands modules ou catégories du projet
- Des TÂCHES (type "task") : les actions concrètes rattachées à une fonctionnalité

== RÈGLES ABSOLUES ==
1. Tu ne crées QUE des types "feature" et "task" — jamais d'autre type
2. Chaque task DOIT avoir un parent_title = titre exact d'une feature existante dans ce projet
3. Toujours créer les features AVANT les tasks dans le même appel creer_elements (ou en deux appels séparés)
4. Si l'utilisateur n'est pas connecté, demande-lui son email et mot de passe Galineo

== COMPORTEMENT ==
- Si le projet est vague, pose 1-2 questions ciblées (deadline ? membres ? phases ?)
- Propose une structure logique et complète, même si l'utilisateur est bref
- Après création, fais un résumé clair : projet créé, X features, Y tâches
- Tu peux consulter les projets existants avant d'en créer un nouveau
- Sois concis, professionnel et en français

Date d'aujourd'hui : ${today}`;

// ─── Appel Mistral API ────────────────────────────────────────────────────────
async function mistralChat(messages) {
  const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MISTRAL_KEY}`
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 4096,
      temperature: 0.3
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral API ${res.status}: ${err}`);
  }
  return await res.json();
}

// ─── Dispatcher des outils ────────────────────────────────────────────────────
async function callTool(name, args) {
  switch (name) {
    case 'se_connecter':   return toolSeConnecter(args);
    case 'creer_projet':   return toolCreerProjet(args);
    case 'creer_elements': return toolCreerElements(args);
    case 'lister_projets': return toolListerProjets();
    case 'voir_taches':    return toolVoirTaches(args);
    default: throw new Error(`Outil inconnu : ${name}`);
  }
}

// ─── Boucle de chat principale ────────────────────────────────────────────────
async function main() {
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    terminal: true
  });
  const ask = (prompt) => new Promise(r => rl.question(prompt, r));

  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║         Galineo AI  —  Chatbot Mistral        ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('Décris ton projet en langage naturel, l\'IA s\'occupe du reste.');
  console.log('Commandes spéciales : "exit" pour quitter\n');

  // Pré-connexion si identifiants dans .env
  if (process.env.GALINEO_EMAIL && process.env.GALINEO_PASSWORD) {
    try {
      await toolSeConnecter({
        email:    process.env.GALINEO_EMAIL,
        password: process.env.GALINEO_PASSWORD
      });
      console.log(`✓ Connecté automatiquement (${process.env.GALINEO_EMAIL})\n`);
    } catch (e) {
      console.log(`⚠ Connexion automatique échouée: ${e.message}\n`);
    }
  }

  const history = [{ role: 'system', content: SYSTEM_PROMPT }];

  while (true) {
    // Saisie utilisateur
    const input = await ask('Vous > ');
    if (!input.trim()) continue;
    if (input.toLowerCase().trim() === 'exit') {
      console.log('\nAu revoir !\n');
      rl.close();
      break;
    }

    history.push({ role: 'user', content: input });

    try {
      // Boucle agentique : on tourne jusqu'à ce que l'IA n'appelle plus d'outil
      let firstResponse = true;
      while (true) {
        const response = await mistralChat(history);
        const msg = response.choices[0].message;
        history.push(msg);

        // Affichage de la réponse texte
        if (msg.content) {
          if (firstResponse) process.stdout.write('\nGalineo AI > ');
          console.log(msg.content);
          firstResponse = false;
        }

        // Pas d'appel d'outil → fin du tour
        if (!msg.tool_calls || msg.tool_calls.length === 0) break;

        // Exécution des outils
        if (firstResponse) {
          process.stdout.write('\nGalineo AI > ');
          firstResponse = false;
        }

        for (const call of msg.tool_calls) {
          const toolName = call.function.name;
          let toolArgs;
          try {
            toolArgs = JSON.parse(call.function.arguments);
          } catch {
            toolArgs = {};
          }

          // Affichage de l'action en cours
          const labels = {
            se_connecter:   '🔐 Connexion à Galineo',
            creer_projet:   `🗂  Création du projet "${toolArgs.titre || ''}"`,
            creer_elements: `📋 Création de ${toolArgs.elements?.length ?? '?'} éléments`,
            lister_projets: '📂 Récupération des projets',
            voir_taches:    `👁  Lecture des tâches (projet ${toolArgs.project_id})`
          };
          process.stdout.write(`  ${labels[toolName] || toolName}... `);

          try {
            const result = await callTool(toolName, toolArgs);
            console.log('✓');
            history.push({
              role:        'tool',
              tool_call_id: call.id,
              name:        toolName,
              content:     JSON.stringify(result)
            });
          } catch (err) {
            console.log(`✗  ${err.message}`);
            history.push({
              role:        'tool',
              tool_call_id: call.id,
              name:        toolName,
              content:     JSON.stringify({ erreur: err.message })
            });
          }
        }
      }
    } catch (err) {
      console.error(`\n❌ Erreur: ${err.message}`);
    }

    console.log(); // ligne vide entre les tours
  }
}

main().catch(console.error);
