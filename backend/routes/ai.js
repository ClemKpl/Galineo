const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logActivity } = require('../utils/activityLogger');
const { checkAiPromptLimit } = require('../middleware/planLimits');
const { createNotification } = require('../utils/notifService');
const { sendProjectInvitation, sendMemberAdded } = require('../utils/mailer');

const MODEL_NAME = "gemini-1.5-flash";

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

  modifier_tache: async ({ task_id, title, status, priority, start_date, due_date, assigned_email, color }, userId, contextProjectId) => {
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
    if (color) { fields.push('color = ?'); params.push(color); }
    if (fields.length === 0) return { message: 'Aucune modification' };
    params.push(task_id);
    await dbRun(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, params);

    await logActivity(projectId, userId, 'task', task_id, 'updated', { details: "Via Assistant IA" });
    return { message: `Tâche ${task_id} mise à jour` };
  },

  gerer_membres: async ({ project_id, email, action, role }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Vous ne pouvez pas gérer les membres d'un autre projet." };
    }
    if (!targetProjectId) return { error: "ID de projet manquant." };

    const roleMap = { owner: 1, admin: 2, membre: 3, member: 3, observateur: 4, observer: 4 };
    const roleId = roleMap[(role || 'membre').toLowerCase()] || 3;

    const u = await dbGet('SELECT id, name FROM users WHERE LOWER(email) = LOWER(?)', [email]);

    if (action === 'remove') {
      if (!u) return { error: `Email ${email} introuvable.` };
      await dbRun(`DELETE FROM project_members WHERE project_id = ? AND user_id = ?`, [targetProjectId, u.id]);
      return { message: `Membre ${u.name} retiré.` };
    }

    // action === 'add'
    if (!u) {
      // Utilisateur non inscrit → envoyer une invitation par email
      const existing = await dbGet(
        `SELECT id FROM invitations WHERE project_id = ? AND LOWER(email) = LOWER(?) AND status = 'pending'`,
        [targetProjectId, email]
      );
      if (existing) return { message: `Une invitation est déjà en attente pour ${email}.` };

      const crypto = require('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      await dbRun(
        `INSERT INTO invitations (project_id, email, role_id, inviter_id, token, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
        [targetProjectId, email, roleId, userId, token]
      );

      const project = await dbGet('SELECT title FROM projects WHERE id = ?', [targetProjectId]);
      const inviter = await dbGet('SELECT name FROM users WHERE id = ?', [userId]);
      await sendProjectInvitation({
        email,
        projectName: project?.title || 'un projet',
        inviterName: inviter?.name || 'Un collaborateur',
        token
      });

      const roleLabels = { 1: 'Propriétaire', 2: 'Admin', 3: 'Membre', 4: 'Observateur' };
      return { message: `Invitation envoyée à ${email} avec le rôle ${roleLabels[roleId] || 'Membre'}.` };
    }

    // Utilisateur existant → ajout direct
    await dbRun(
      `INSERT OR REPLACE INTO project_members (project_id, user_id, role_id) VALUES (?, ?, ?)`,
      [targetProjectId, u.id, roleId]
    );
    const project = await dbGet('SELECT id, title FROM projects WHERE id = ?', [targetProjectId]);
    await sendMemberAdded({ userId: u.id, projectName: project?.title || '', projectId: targetProjectId });
    const roleLabels = { 1: 'Propriétaire', 2: 'Admin', 3: 'Membre', 4: 'Observateur' };
    return { message: `${u.name} ajouté au projet avec le rôle ${roleLabels[roleId] || 'Membre'}.` };
  },

  voir_taches: async ({ project_id }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Impossible de consulter un autre projet." };
    }
    if (!targetProjectId) return { error: "ID de projet manquant." };

    const rows = await dbAll(`
      SELECT t.id, CASE WHEN t.parent_id IS NULL THEN 'feature' ELSE 'task' END as type,
             t.title, t.status, t.priority, t.start_date, t.due_date, t.parent_id, u.email as assigned_email
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE t.project_id = ? AND t.status != 'deleted'
      ORDER BY t.parent_id ASC NULLS FIRST, t.id ASC
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
  
  creer_jalon: async ({ project_id, title, date, color }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) return { error: "Accès refusé." };
    if (!title || !date) return { error: "Titre et date requis." };
    const result = await dbRun(
      `INSERT INTO milestones (project_id, title, date, color) VALUES (?, ?, ?, ?)`,
      [targetProjectId, title, date, color || '#a855f7']
    );
    return { message: `Jalon "${title}" créé le ${date}.`, id: result.lastID };
  },

  modifier_jalon: async ({ milestone_id, title, date, color }, userId, contextProjectId) => {
    const milestone = await dbGet('SELECT project_id FROM milestones WHERE id = ?', [milestone_id]);
    if (!milestone) return { error: `Jalon #${milestone_id} introuvable.` };
    if (contextProjectId && Number(milestone.project_id) !== Number(contextProjectId)) return { error: "Accès refusé." };
    const fields = []; const params = [];
    if (title) { fields.push('title = ?'); params.push(title); }
    if (date)  { fields.push('date = ?');  params.push(date); }
    if (color) { fields.push('color = ?'); params.push(color); }
    if (fields.length === 0) return { message: 'Aucune modification.' };
    params.push(milestone_id);
    await dbRun(`UPDATE milestones SET ${fields.join(', ')} WHERE id = ?`, params);
    return { message: `Jalon #${milestone_id} mis à jour.` };
  },

  supprimer_jalon: async ({ milestone_id }, userId, contextProjectId) => {
    const milestone = await dbGet('SELECT project_id FROM milestones WHERE id = ?', [milestone_id]);
    if (!milestone) return { error: `Jalon #${milestone_id} introuvable.` };
    if (contextProjectId && Number(milestone.project_id) !== Number(contextProjectId)) return { error: "Accès refusé." };
    await dbRun('DELETE FROM milestones WHERE id = ?', [milestone_id]);
    return { message: `Jalon #${milestone_id} supprimé.` };
  },

  supprimer_elements: async ({ project_id, element_ids }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé." };
    }
    if (!element_ids || !Array.isArray(element_ids) || element_ids.length === 0) return { error: "IDs manquants ou liste vide." };
    const validIds = element_ids.filter(id => Number.isInteger(Number(id)) && Number(id) > 0);
    if (validIds.length === 0) return { error: "Aucun ID valide fourni." };

    await dbRun(`UPDATE tasks SET status = 'deleted' WHERE project_id = ? AND id IN (${validIds.map(() => '?').join(',')})`, [targetProjectId, ...validIds]);
    return { message: `${element_ids.length} élément(s) supprimé(s).` };
  },

  // ─── FONCTIONS BUDGET ─────────────────────────────────────────────────────

  voir_budget: async ({ project_id }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Impossible de consulter le budget d'un autre projet." };
    }
    if (!targetProjectId) return { error: "ID de projet manquant." };

    const config = await dbGet('SELECT * FROM budget_config WHERE project_id = ?', [targetProjectId]);
    const entries = await dbAll(
      'SELECT amount_cents, status FROM budget_entries WHERE project_id = ?',
      [targetProjectId]
    );

    const budgetTotal = config?.budget_total || 0;
    const devise = config?.devise || 'EUR';

    let totalDepensesCents = 0;
    let totalRevenusCents = 0;
    let depensesPrevisCents = 0;
    for (const e of entries) {
      if (e.status === 'annulé') continue;
      if (e.amount_cents < 0) {
        if (e.status === 'payé' || e.status === 'engagé') totalDepensesCents += Math.abs(e.amount_cents);
        else if (e.status === 'prévu') depensesPrevisCents += Math.abs(e.amount_cents);
      } else if (e.amount_cents > 0 && (e.status === 'payé' || e.status === 'engagé')) {
        totalRevenusCents += e.amount_cents;
      }
    }
    const soldeNetCents = totalRevenusCents - totalDepensesCents;
    const pctConsomme = budgetTotal > 0 ? Math.round((totalDepensesCents / budgetTotal) * 100) : 0;
    let alerte = null;
    if (budgetTotal > 0) {
      if (totalDepensesCents > budgetTotal) alerte = 'critique';
      else if (totalDepensesCents > budgetTotal * 0.8) alerte = 'warning';
    }

    const fmtEur = (cents) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise, minimumFractionDigits: 2 }).format(cents / 100);

    return {
      budget_total: fmtEur(budgetTotal),
      devise,
      solde_net: fmtEur(soldeNetCents),
      total_depenses: fmtEur(totalDepensesCents),
      total_revenus: fmtEur(totalRevenusCents),
      depenses_previsionnelles: fmtEur(depensesPrevisCents),
      pct_consomme: pctConsomme,
      alerte: alerte || 'aucune',
      message: alerte === 'critique'
        ? `⚠️ BUDGET DÉPASSÉ : ${pctConsomme}% consommé !`
        : alerte === 'warning'
        ? `⚠️ Attention : ${pctConsomme}% du budget consommé (seuil d'alerte > 80%)`
        : null,
    };
  },

  voir_lignes_budget: async ({ project_id, status, category, date_from, date_to }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Impossible de consulter les lignes d'un autre projet." };
    }
    if (!targetProjectId) return { error: "ID de projet manquant." };

    let sql = `
      SELECT be.id, be.title, be.amount_cents, be.category, be.status,
             be.entry_date, be.notes, u.email as created_by_email
      FROM budget_entries be
      LEFT JOIN users u ON u.id = be.created_by
      WHERE be.project_id = ?
    `;
    const params = [targetProjectId];
    if (status) { sql += ' AND be.status = ?'; params.push(status); }
    if (category) { sql += ' AND be.category = ?'; params.push(category); }
    if (date_from) { sql += ' AND be.entry_date >= ?'; params.push(date_from); }
    if (date_to) { sql += ' AND be.entry_date <= ?'; params.push(date_to); }
    sql += ' ORDER BY be.entry_date DESC, be.id DESC';

    const rows = await dbAll(sql, params);
    const config = await dbGet('SELECT devise FROM budget_config WHERE project_id = ?', [targetProjectId]);
    const devise = config?.devise || 'EUR';
    const fmtEur = (cents) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise, minimumFractionDigits: 2 }).format(cents / 100);

    const lignes = rows.map(r => ({
      id: r.id,
      title: r.title,
      montant: fmtEur(r.amount_cents),
      type: r.amount_cents < 0 ? 'dépense' : 'revenu',
      category: r.category,
      status: r.status,
      date: r.entry_date || 'non définie',
      notes: r.notes || null,
      cree_par: r.created_by_email,
    }));
    return { lignes, total: lignes.length };
  },

  creer_ligne_budget: async ({ project_id, title, amount, category, status, date, notes }, userId, contextProjectId) => {
    const targetProjectId = contextProjectId || project_id;
    if (contextProjectId && project_id && Number(project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Vous ne pouvez pas modifier le budget d'un autre projet." };
    }
    if (!targetProjectId) return { error: "ID de projet manquant." };
    if (!title) return { error: "Le titre est requis." };
    if (amount === undefined || amount === null) return { error: "Le montant est requis." };

    // Vérification du rôle (Propriétaire=1, Admin=2, Membre=3)
    const membership = await dbGet(
      'SELECT p.owner_id, pm.role_id FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? WHERE p.id = ?',
      [userId, targetProjectId]
    );
    const isOwnerOrAdmin = membership && (membership.owner_id === userId || (membership.role_id && membership.role_id <= 2));
    const isMember = isOwnerOrAdmin || (membership && membership.role_id === 3);
    if (!isMember) return { error: "Action refusée : Droits insuffisants (Observateur : lecture seule)." };

    const amountCents = Math.round(parseFloat(amount) * 100);
    const result = await dbRun(
      'INSERT INTO budget_entries (project_id, title, amount_cents, category, status, entry_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [targetProjectId, title, amountCents, category || 'Divers', status || 'prévu', date || null, notes || null, userId]
    );
    return { id: result.lastID, message: `Ligne budgétaire "${title}" créée avec succès.` };
  },

  modifier_ligne_budget: async ({ entry_id, title, amount, category, status, date, notes }, userId, contextProjectId) => {
    if (!entry_id) return { error: "entry_id requis." };

    const entry = await dbGet('SELECT * FROM budget_entries WHERE id = ?', [entry_id]);
    if (!entry) return { error: `Ligne budgétaire #${entry_id} introuvable.` };

    // VALIDATION ISOLATION
    if (contextProjectId && Number(entry.project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Cette ligne appartient à un autre projet." };
    }

    const membership = await dbGet(
      'SELECT p.owner_id, pm.role_id FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? WHERE p.id = ?',
      [userId, entry.project_id]
    );
    const isOwnerOrAdmin = membership && (membership.owner_id === userId || (membership.role_id && membership.role_id <= 2));
    const isMemberCreator = membership && membership.role_id === 3 && entry.created_by === userId;
    if (!isOwnerOrAdmin && !isMemberCreator) {
      return { error: "Action refusée : Vous n'avez pas les droits pour modifier cette ligne." };
    }

    const fields = [];
    const params = [];
    if (title !== undefined) { fields.push('title = ?'); params.push(title); }
    if (amount !== undefined) { fields.push('amount_cents = ?'); params.push(Math.round(parseFloat(amount) * 100)); }
    if (category !== undefined) { fields.push('category = ?'); params.push(category); }
    if (status !== undefined) { fields.push('status = ?'); params.push(status); }
    if (date !== undefined) { fields.push('entry_date = ?'); params.push(date || null); }
    if (notes !== undefined) { fields.push('notes = ?'); params.push(notes || null); }
    if (fields.length === 0) return { message: 'Aucune modification demandée.' };
    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(entry_id);
    await dbRun(`UPDATE budget_entries SET ${fields.join(', ')} WHERE id = ?`, params);
    return { message: `Ligne budgétaire #${entry_id} mise à jour avec succès.` };
  },

  supprimer_ligne_budget: async ({ entry_id, project_id }, userId, contextProjectId) => {
    if (!entry_id) return { error: "entry_id requis." };

    const entry = await dbGet('SELECT * FROM budget_entries WHERE id = ?', [entry_id]);
    if (!entry) return { error: `Ligne budgétaire #${entry_id} introuvable.` };

    // VALIDATION ISOLATION
    if (contextProjectId && Number(entry.project_id) !== Number(contextProjectId)) {
      return { error: "Accès refusé : Cette ligne appartient à un autre projet." };
    }

    // Réservé aux Propriétaires et Admins
    const membership = await dbGet(
      'SELECT p.owner_id, pm.role_id FROM projects p LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ? WHERE p.id = ?',
      [userId, entry.project_id]
    );
    const isOwnerOrAdmin = membership && (membership.owner_id === userId || (membership.role_id && membership.role_id <= 2));
    if (!isOwnerOrAdmin) {
      return { error: "Action refusée : Seuls les propriétaires et admins peuvent supprimer des lignes budgétaires." };
    }

    await dbRun('DELETE FROM budget_entries WHERE id = ?', [entry_id]);
    return { message: `Ligne budgétaire #${entry_id} supprimée définitivement.` };
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
        description: "Modifie une tâche existante (date, statut, assignation, couleur dans le Gantt)",
        parameters: {
          type: "object",
          properties: {
            task_id: { type: "number" },
            status: { type: "string", enum: ["todo", "in_progress", "done"] },
            start_date: { type: "string" },
            due_date: { type: "string" },
            assigned_email: { type: "string" },
            color: { type: "string", description: "Couleur hexadécimale de la tâche dans le Gantt (ex: #f97316, #ef4444, #3b82f6, #10b981, #a855f7, #64748b)" }
          },
          required: ["task_id"]
        }
      },
      {
        name: "voir_taches",
        description: "Récupère la liste complète des fonctionnalités (type='feature') et tâches (type='task') du projet, avec leur id, titre, statut, priorité, dates, parent_id et email assigné. Appelle cet outil AVANT toute création ou modification pour connaître l'état exact du projet.",
        parameters: {
          type: "object",
          properties: { project_id: { type: "number", description: "ID du projet (optionnel si déjà en contexte projet)" } },
          required: []
        }
      },
      {
        name: "gerer_membres",
        description: "Ajoute ou retire un membre du projet. Si l'email n'est pas encore inscrit sur Galineo, envoie automatiquement une invitation par email avec un lien d'inscription.",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            email: { type: "string" },
            action: { type: "string", enum: ["add", "remove"] },
            role: { type: "string", enum: ["membre", "observateur", "admin"], description: "Rôle à attribuer : 'membre' (défaut), 'observateur' (lecture seule), 'admin'" }
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
        name: "creer_jalon",
        description: "Crée un jalon (milestone) sur le Gantt à une date précise.",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            title: { type: "string", description: "Nom du jalon (ex: 'Livraison v1.0')" },
            date: { type: "string", description: "Date du jalon au format YYYY-MM-DD" },
            color: { type: "string", description: "Couleur hex (défaut: #a855f7)" }
          },
          required: ["title", "date"]
        }
      },
      {
        name: "modifier_jalon",
        description: "Modifie un jalon existant (titre, date ou couleur).",
        parameters: {
          type: "object",
          properties: {
            milestone_id: { type: "number" },
            title: { type: "string" },
            date: { type: "string" },
            color: { type: "string" }
          },
          required: ["milestone_id"]
        }
      },
      {
        name: "supprimer_jalon",
        description: "Supprime un jalon du Gantt.",
        parameters: {
          type: "object",
          properties: { milestone_id: { type: "number" } },
          required: ["milestone_id"]
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
      },
      {
        name: "voir_budget",
        description: "Récupère le résumé budgétaire du projet : budget total configuré, solde net, total dépenses (payées + engagées), total revenus, dépenses prévisionnelles, pourcentage consommé et alertes actives. Appelle cette fonction en premier pour toute question financière.",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number", description: "ID du projet (optionnel si déjà en contexte projet)" }
          },
          required: []
        }
      },
      {
        name: "voir_lignes_budget",
        description: "Récupère la liste des lignes budgétaires (dépenses et revenus) avec filtres optionnels par statut, catégorie et période.",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            status: { type: "string", enum: ["prévu", "engagé", "payé", "annulé"], description: "Filtrer par statut" },
            category: { type: "string", enum: ["Personnel", "Matériel", "Logiciel", "Sous-traitance", "Marketing", "Divers"], description: "Filtrer par catégorie" },
            date_from: { type: "string", description: "Date de début au format YYYY-MM-DD" },
            date_to: { type: "string", description: "Date de fin au format YYYY-MM-DD" }
          },
          required: []
        }
      },
      {
        name: "creer_ligne_budget",
        description: "Crée une nouvelle ligne budgétaire (dépense ou revenu). Pour une dépense, fournir un montant négatif (ex: -2500). Pour un revenu, un montant positif (ex: 5000). Accessible aux Propriétaires, Admins et Membres.",
        parameters: {
          type: "object",
          properties: {
            project_id: { type: "number" },
            title: { type: "string", description: "Libellé de la ligne (ex: 'Hébergement serveur')" },
            amount: { type: "number", description: "Montant en euros. Négatif = dépense, positif = revenu. Ex: -2500 pour une dépense de 2 500 €" },
            category: { type: "string", enum: ["Personnel", "Matériel", "Logiciel", "Sous-traitance", "Marketing", "Divers"] },
            status: { type: "string", enum: ["prévu", "engagé", "payé", "annulé"], description: "Statut de la ligne (défaut: prévu)" },
            date: { type: "string", description: "Date de la dépense au format YYYY-MM-DD" },
            notes: { type: "string", description: "Notes ou référence de facture" }
          },
          required: ["title", "amount"]
        }
      },
      {
        name: "modifier_ligne_budget",
        description: "Modifie une ligne budgétaire existante. Propriétaires et Admins peuvent tout modifier. Un Membre ne peut modifier que ses propres lignes.",
        parameters: {
          type: "object",
          properties: {
            entry_id: { type: "number", description: "ID de la ligne budgétaire à modifier" },
            title: { type: "string" },
            amount: { type: "number", description: "Nouveau montant en euros (négatif = dépense, positif = revenu)" },
            category: { type: "string", enum: ["Personnel", "Matériel", "Logiciel", "Sous-traitance", "Marketing", "Divers"] },
            status: { type: "string", enum: ["prévu", "engagé", "payé", "annulé"] },
            date: { type: "string", description: "Date au format YYYY-MM-DD" },
            notes: { type: "string" }
          },
          required: ["entry_id"]
        }
      },
      {
        name: "supprimer_ligne_budget",
        description: "Supprime définitivement une ligne budgétaire. Réservé aux Propriétaires et Admins uniquement.",
        parameters: {
          type: "object",
          properties: {
            entry_id: { type: "number", description: "ID de la ligne budgétaire à supprimer" },
            project_id: { type: "number" }
          },
          required: ["entry_id"]
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

  console.log('[AI Debug] rawKeys length:', rawKeys?.length, '| first key prefix:', apiKeys[0]?.substring(0, 8), '| keys count:', apiKeys.length);

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

STRUCTURE WBS (CSV/Export Galineo) :
Si l'utilisateur te fournit un fichier CSV ou un texte structuré comme un WBS GANTT, voici les colonnes à interpréter pour tes outils ('creer_elements' ou 'creer_projet') :
- type : 'feature' ou 'task'.
- title : Le titre de l'élément (ex: "Développement API").
- description : Détails textuels.
- status : 'todo', 'in_progress' ou 'done'.
- priority : 'low', 'normal', 'high' ou 'urgent'.
- phase : Nom de la phase organisationnelle.
- start_date : Date de début (YYYY-MM-DD).
- due_date : Date d'échéance (YYYY-MM-DD).
- assigned_email : Email de la personne assignée (doit être un membre du projet).
- parent_title : Pour les 'task', doit être le titre EXACT de la 'feature' parente.

RÈGLE D'IMPORT WBS :
Si tu détectes cette structure, analyse son contenu et propose à l'utilisateur de l'importer massivement dans le projet en utilisant tes outils de création. Ne crée RIEN sans confirmation.
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
            // Injection de l'état actuel du projet dans le contexte
            const projectMilestones = await dbAll(
              `SELECT id, title, date, color FROM milestones WHERE project_id = ? ORDER BY date ASC`,
              [projectId]
            );

            const projectTasks = await dbAll(`
              SELECT t.id, CASE WHEN t.parent_id IS NULL THEN 'feature' ELSE 'task' END as type,
                     t.title, t.status, t.priority, t.start_date, t.due_date, t.parent_id, t.color,
                     u.email as assigned_email
              FROM tasks t
              LEFT JOIN users u ON t.assigned_to = u.id
              WHERE t.project_id = ? AND t.status != 'deleted'
              ORDER BY t.parent_id ASC NULLS FIRST, t.id ASC
            `, [projectId]);

            let milestoneSnapshot = '';
            if (projectMilestones.length > 0) {
              milestoneSnapshot = '\n  [JALONS]\n' + projectMilestones.map(m =>
                `    - [JALON #${m.id}] "${m.title}" | date: ${m.date}`
              ).join('\n');
            }

            let taskSnapshot = '';
            if (projectTasks.length === 0) {
              taskSnapshot = 'Aucune fonctionnalité ni tâche pour l\'instant.';
            } else {
              const features = projectTasks.filter(t => t.type === 'feature');
              const tasks = projectTasks.filter(t => t.type === 'task');
              taskSnapshot = features.map(f => {
                const children = tasks.filter(t => t.parent_id === f.id);
                const childLines = children.map(t =>
                  `    - [TÂCHE #${t.id}] "${t.title}" | statut: ${t.status} | priorité: ${t.priority}${t.start_date ? ` | début: ${t.start_date}` : ''}${t.due_date ? ` | échéance: ${t.due_date}` : ''}${t.assigned_email ? ` | assigné: ${t.assigned_email}` : ''}${t.color ? ` | couleur: ${t.color}` : ''}`
                ).join('\n');
                return `  [FONCTIONNALITÉ #${f.id}] "${f.title}" | statut: ${f.status}${f.due_date ? ` | échéance: ${f.due_date}` : ''}\n${childLines}`;
              }).join('\n');
              // Tâches orphelines (sans feature parente connue)
              const orphans = tasks.filter(t => !features.find(f => f.id === t.parent_id));
              if (orphans.length > 0) {
                taskSnapshot += '\n  [TÂCHES SANS FONCTIONNALITÉ]\n' + orphans.map(t =>
                  `    - [TÂCHE #${t.id}] "${t.title}" | statut: ${t.status}`
                ).join('\n');
              }
            }

            sysInstruct = `Tu es l'Assistant Galineo Room dédié au projet "${projectTitle}".
            UTILISATEUR ACTUEL : ${userName} (${userEmail}).
            CONTEXTE : ID Projet = ${projectId}. DATE DU JOUR : ${currentDate}.

            ── ÉTAT ACTUEL DU PROJET (mis à jour en temps réel) ──
${taskSnapshot}${milestoneSnapshot}
            ── FIN DE L'ÉTAT DU PROJET ──

            IMPORTANT : Tu connais déjà l'état complet du projet ci-dessus. Tu n'as PAS besoin d'appeler 'voir_taches' sauf si tu as besoin de vérifier un détail très précis après une modification récente.

            VOUS ÊTES DANS UN ENVIRONNEMENT MULTI-UTILISATEURS (Galineo Room).
            - Chaque message de l'historique utilisateur est préfixé par son nom : [Nom].
            - Tu dois être capable de distinguer qui a dit quoi.
            - Adresse-toi aux utilisateurs par leur nom si la situation s'y prête.

            ${hierarchyInfo}

            RÈGLES CRITIQUES :
            1. STRUCTURE : Pour toute nouvelle fonctionnalité créée, génère AU MOINS 2 tâches liées.
            2. ÉCHÉANCES : Fournis TOUJOURS une 'start_date' et une 'due_date' pour toute création.
            3. CONFIRMATION OBLIGATOIRE : Tu as l'interdiction de créer, modifier ou supprimer quoi que ce soit sans l'accord explicite de l'utilisateur ("Oui", "Ok", "C'est bon"). Présente ton plan, puis attends sa validation.
            4. SUPPRESSION : L'outil 'supprimer_elements' est EXPÉRIMENTAL. Ne l'utilise que si explicitement demandé et confirme toujours avant. Tu ne peux PAS supprimer un projet entier, seulement ses tâches/fonctionnalités.

            BUDGET :
            - Tu peux consulter le budget du projet avec 'voir_budget' et 'voir_lignes_budget' avant de répondre à toute question financière.
            - Tu peux créer, modifier ou supprimer des lignes budgétaires si l'utilisateur te le demande explicitement.
            - Avant toute action budgétaire (création, modification, suppression), appelle 'voir_budget' pour connaître l'état actuel.
            - Affiche toujours les montants en euros formatés (ex: 1 500,00 €).
            - Pour une dépense, le montant doit être négatif (ex: -2500 pour 2 500 €). Pour un revenu, positif.
            - Si le budget dépasse 80%, signale-le proactivement dans ta réponse même si l'utilisateur ne le demande pas.
            - CONFIRMATION OBLIGATOIRE avant toute action budgétaire (création, modification, suppression).`;
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
          const actions = [];
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
                const canDelete = !settings || settings.allow_delete === 1;
                const canInvite = !settings || settings.allow_invite === 1;
                const canColor = !settings || settings.allow_color === 1;

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
                  // Restriction spécifique aux invitations externes
                  if (call.args?.action === 'add' && !canInvite) {
                    toolLogs.push({ name: call.name, response: { error: "Action refusée : L'envoi d'invitations externes par l'IA est désactivé pour ce projet." } });
                    continue;
                  }
                }

                // Restriction de COULEUR (modifier_tache avec champ color)
                if (call.name === 'modifier_tache' && call.args?.color && !canColor) {
                  toolLogs.push({ name: call.name, response: { error: "Action refusée : La modification des couleurs par l'IA est désactivée pour ce projet." } });
                  continue;
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

                // Restriction BUDGET — création/modification réservée aux membres (role <= 3)
                if (call.name === 'creer_ligne_budget' && !canCreate) {
                  toolLogs.push({ name: call.name, response: { error: "Action refusée : La création par l'IA est désactivée pour ce projet." } });
                  continue;
                }
                if (call.name === 'modifier_ligne_budget' && !canModify) {
                  toolLogs.push({ name: call.name, response: { error: "Action refusée : La modification par l'IA est désactivée pour ce projet." } });
                  continue;
                }
                if (call.name === 'supprimer_ligne_budget') {
                  if (!canDelete) {
                    toolLogs.push({ name: call.name, response: { error: "Action refusée : La suppression par l'IA est désactivée pour ce projet." } });
                    continue;
                  }
                  if (!isAdminOrOwner) {
                    toolLogs.push({ name: call.name, response: { error: "Action refusée : Seuls les propriétaires et admins peuvent supprimer des lignes budgétaires via l'IA." } });
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

          // Message d'erreur lisible selon le type d'erreur
          let errorText;
          if (err.message.includes('503') || err.message.includes('Service Unavailable') || err.message.includes('high demand')) {
            errorText = "L'IA est actuellement surchargée en raison d'une forte demande. Réessaie dans quelques instants.";
          } else if (err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) {
            errorText = "Le quota de requêtes IA a été atteint. Réessaie dans quelques secondes.";
          } else if (err.message.includes('timeout') || err.message.includes('DEADLINE_EXCEEDED')) {
            errorText = "L'IA a mis trop de temps à répondre. Réessaie ta demande.";
          } else {
            errorText = "Une erreur inattendue s'est produite. Réessaie ta demande.";
          }

          const saveProjectId = (mode === 'wizard') ? null : (currentProjectIdTask || dbProjectId);
          await dbRun(
            `INSERT INTO ai_messages (project_id, user_id, role, content) VALUES (?, ?, 'model', ?)`,
            [saveProjectId, userId, errorText]
          ).catch(console.error);

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
