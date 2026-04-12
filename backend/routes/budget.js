const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { projectMemberMiddleware } = require('../middleware/projectMember');

// ─── Promisify db ─────────────────────────────────────────────────────────────
const dbGet = (sql, params) =>
  new Promise((res, rej) => db.get(sql, params, (err, row) => err ? rej(err) : res(row)));
const dbAll = (sql, params) =>
  new Promise((res, rej) => db.all(sql, params, (err, rows) => err ? rej(err) : res(rows)));
const dbRun = (sql, params) =>
  new Promise((res, rej) => db.run(sql, params, function (err) { err ? rej(err) : res({ lastID: this.lastID, changes: this.changes }); }));

function csvEscape(str) {
  if (!str) return '""';
  if (typeof str !== 'string') str = String(str);
  return `"${str.replace(/"/g, '""')}"`;
}

async function getUserRole(projectId, userId) {
  return dbGet(
    `SELECT p.owner_id, pm.role_id
     FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
     WHERE p.id = ?`,
    [userId, projectId]
  );
}

// ─── GET /projects/:projectId/budget — Résumé budgétaire ─────────────────────
router.get('/', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { projectId } = req.params;
  try {
    const config = await dbGet('SELECT * FROM budget_config WHERE project_id = ?', [projectId]);
    const entries = await dbAll(
      `SELECT amount_cents, status FROM budget_entries WHERE project_id = ?`,
      [projectId]
    );

    const budgetTotal = config?.budget_total || 0;
    const devise = config?.devise || 'EUR';

    let totalDepensesCents = 0;
    let totalRevenusCents = 0;
    let depensesPrevisCents = 0;

    for (const e of entries) {
      if (e.status === 'annulé') continue;
      if (e.amount_cents < 0) {
        if (e.status === 'payé' || e.status === 'engagé') {
          totalDepensesCents += Math.abs(e.amount_cents);
        } else if (e.status === 'prévu') {
          depensesPrevisCents += Math.abs(e.amount_cents);
        }
      } else if (e.amount_cents > 0) {
        if (e.status === 'payé' || e.status === 'engagé') {
          totalRevenusCents += e.amount_cents;
        }
      }
    }

    const soldeNetCents = totalRevenusCents - totalDepensesCents;
    const pctConsomme = budgetTotal > 0 ? Math.round((totalDepensesCents / budgetTotal) * 100) : 0;

    let alerte = null;
    if (budgetTotal > 0) {
      if (totalDepensesCents > budgetTotal) alerte = 'critique';
      else if (totalDepensesCents > budgetTotal * 0.8) alerte = 'warning';
    }

    res.json({
      budget_total: budgetTotal,
      devise,
      solde_net: soldeNetCents,
      total_depenses: totalDepensesCents,
      total_revenus: totalRevenusCents,
      depenses_previsionnelles: depensesPrevisCents,
      pct_consomme: pctConsomme,
      alerte,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /projects/:projectId/budget/config — Configurer le budget total ─────
router.put('/config', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;
  const { budget_total, devise } = req.body;

  try {
    const row = await getUserRole(projectId, userId);
    const isOwnerOrAdmin =
      row && (row.owner_id === userId || (row.role_id && row.role_id <= 2) || req.user.isAdmin);
    if (!isOwnerOrAdmin) return res.status(403).json({ error: 'Seuls les propriétaires et admins peuvent configurer le budget.' });

    const existing = await dbGet('SELECT project_id FROM budget_config WHERE project_id = ?', [projectId]);
    if (existing) {
      const fields = [];
      const values = [];
      if (budget_total !== undefined) {
        fields.push('budget_total = ?');
        values.push(Math.round(parseFloat(budget_total) * 100));
      }
      if (devise) { fields.push('devise = ?'); values.push(devise); }
      if (fields.length > 0) {
        values.push(projectId);
        await dbRun(`UPDATE budget_config SET ${fields.join(', ')} WHERE project_id = ?`, values);
      }
    } else {
      await dbRun(
        'INSERT INTO budget_config (project_id, budget_total, devise) VALUES (?, ?, ?)',
        [projectId, Math.round(parseFloat(budget_total || 0) * 100), devise || 'EUR']
      );
    }
    res.json({ message: 'Budget configuré' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /projects/:projectId/budget/entries — Liste des lignes budgétaires ──
router.get('/entries', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const { status, category, dateFrom, dateTo } = req.query;

  try {
    let sql = `
      SELECT be.*, u.email as created_by_email, u.name as created_by_name
      FROM budget_entries be
      LEFT JOIN users u ON u.id = be.created_by
      WHERE be.project_id = ?
    `;
    const params = [projectId];

    if (status) { sql += ' AND be.status = ?'; params.push(status); }
    if (category) { sql += ' AND be.category = ?'; params.push(category); }
    if (dateFrom) { sql += ' AND be.entry_date >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND be.entry_date <= ?'; params.push(dateTo); }

    sql += ' ORDER BY be.entry_date DESC, be.created_at DESC';

    const rows = await dbAll(sql, params);
    const result = rows.map(r => ({ ...r, amount: r.amount_cents / 100 }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /projects/:projectId/budget/entries — Créer une ligne ───────────────
router.post('/entries', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;
  const { title, amount, category, status, entry_date, notes, attachment_url } = req.body;

  if (!title) return res.status(400).json({ error: 'Titre requis' });
  if (amount === undefined || amount === null) return res.status(400).json({ error: 'Montant requis' });

  try {
    const row = await getUserRole(projectId, userId);
    const roleId = row?.role_id;
    const isOwnerOrAdmin = row && (row.owner_id === userId || (roleId && roleId <= 2) || req.user.isAdmin);
    const isMember = isOwnerOrAdmin || roleId === 3;
    if (!isMember) return res.status(403).json({ error: 'Droits insuffisants (Observateur : lecture seule).' });

    const amountCents = Math.round(parseFloat(amount) * 100);
    const result = await dbRun(
      `INSERT INTO budget_entries (project_id, title, amount_cents, category, status, entry_date, notes, attachment_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [projectId, title, amountCents, category || 'Divers', status || 'prévu', entry_date || null, notes || null, attachment_url || null, userId]
    );
    res.json({ id: result.lastID, message: 'Ligne créée avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /projects/:projectId/budget/entries/:eid — Modifier une ligne ────────
router.put('/entries/:eid', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { projectId, eid } = req.params;
  const userId = req.user.id;
  const { title, amount, category, status, entry_date, notes, attachment_url } = req.body;

  try {
    const entry = await dbGet('SELECT * FROM budget_entries WHERE id = ? AND project_id = ?', [eid, projectId]);
    if (!entry) return res.status(404).json({ error: 'Ligne budgétaire introuvable.' });

    const row = await getUserRole(projectId, userId);
    const roleId = row?.role_id;
    const isOwnerOrAdmin = row && (row.owner_id === userId || (roleId && roleId <= 2) || req.user.isAdmin);
    const isMemberCreator = roleId === 3 && entry.created_by === userId;
    if (!isOwnerOrAdmin && !isMemberCreator) {
      return res.status(403).json({ error: 'Droits insuffisants pour modifier cette ligne.' });
    }

    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (amount !== undefined) { fields.push('amount_cents = ?'); values.push(Math.round(parseFloat(amount) * 100)); }
    if (category !== undefined) { fields.push('category = ?'); values.push(category); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (entry_date !== undefined) { fields.push('entry_date = ?'); values.push(entry_date || null); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes || null); }
    if (attachment_url !== undefined) { fields.push('attachment_url = ?'); values.push(attachment_url || null); }

    if (fields.length === 0) return res.status(400).json({ error: 'Aucun champ à modifier.' });

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(eid, projectId);
    await dbRun(`UPDATE budget_entries SET ${fields.join(', ')} WHERE id = ? AND project_id = ?`, values);
    res.json({ message: 'Ligne mise à jour' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /projects/:projectId/budget/entries/:eid — Supprimer une ligne ───
// Choix : hard delete (suppression définitive)
// Justification : les lignes annulées peuvent être filtrées par status='annulé' ;
// la suppression définitive est plus propre et réservée aux propriétaires/admins.
router.delete('/entries/:eid', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { projectId, eid } = req.params;
  const userId = req.user.id;

  try {
    const entry = await dbGet('SELECT * FROM budget_entries WHERE id = ? AND project_id = ?', [eid, projectId]);
    if (!entry) return res.status(404).json({ error: 'Ligne budgétaire introuvable.' });

    const row = await getUserRole(projectId, userId);
    const roleId = row?.role_id;
    const isOwnerOrAdmin = row && (row.owner_id === userId || (roleId && roleId <= 2) || req.user.isAdmin);
    if (!isOwnerOrAdmin) {
      return res.status(403).json({ error: 'Seuls les propriétaires et admins peuvent supprimer des lignes budgétaires.' });
    }

    await dbRun('DELETE FROM budget_entries WHERE id = ? AND project_id = ?', [eid, projectId]);
    res.json({ message: 'Ligne supprimée' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /projects/:projectId/budget/export — Export CSV ─────────────────────
router.get('/export', authMiddleware, projectMemberMiddleware, async (req, res) => {
  const { projectId } = req.params;
  try {
    const rows = await dbAll(
      `SELECT be.id, be.title, be.amount_cents, be.category, be.status,
              be.entry_date, be.notes, u.email as created_by_email, be.created_at
       FROM budget_entries be
       LEFT JOIN users u ON u.id = be.created_by
       WHERE be.project_id = ?
       ORDER BY be.entry_date DESC, be.created_at DESC`,
      [projectId]
    );

    const config = await dbGet('SELECT budget_total, devise FROM budget_config WHERE project_id = ?', [projectId]);
    const devise = config?.devise || 'EUR';

    const header = ['id', 'titre', `montant_${devise}`, 'categorie', 'statut', 'date', 'notes', 'cree_par', 'cree_le'].join(',');
    const csvRows = [header, ...rows.map(r => [
      r.id,
      csvEscape(r.title),
      (r.amount_cents / 100).toFixed(2),
      csvEscape(r.category),
      csvEscape(r.status),
      csvEscape(r.entry_date),
      csvEscape(r.notes),
      csvEscape(r.created_by_email),
      csvEscape(r.created_at),
    ].join(','))];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="project-${projectId}-budget.csv"`);
    res.send(csvRows.join('\n'));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
