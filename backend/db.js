const { Pool } = require('pg');
const path = require('path');

const isProd = !!process.env.DATABASE_URL;
let db;

if (isProd) {
  console.log('Using PostgreSQL (Production) 🐘');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Helper to convert SQLite syntax to PostgreSQL
  const convertSql = (sql) => {
    let converted = sql
      .replace(/\?/g, (_, i, s) => `$${s.substring(0, i).split('?').length}`) 
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/INSERT OR IGNORE/gi, 'INSERT')
      .replace(/INSERT OR REPLACE/gi, 'INSERT')
      .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      .replace(/DATETIME/gi, 'TIMESTAMP')
      .replace(/GROUP_CONCAT\s*\(\s*(.*?)\s*\)/gi, (match, p1) => {
        if (p1.toLowerCase().includes('distinct')) {
          return `STRING_AGG(DISTINCT ${p1.replace(/distinct/gi, '').trim()}::text, ',')`;
        }
        return `STRING_AGG(${p1.trim()}::text, ',')`;
      })
      .replace(/datetime\('now'(.*?)\)/gi, (match, p1) => {
        const args = p1.split(',').map(a => a.trim()).filter(a => a !== '');
        let pgResult = 'NOW()';
        for (const arg of args) {
          if ((arg.startsWith("'") && arg.endsWith("'")) || (arg.startsWith('"') && arg.endsWith('"'))) {
             pgResult += ` + INTERVAL ${arg}`;
          } else {
             pgResult += ` + (${arg})::interval`;
          }
        }
        return pgResult;
      });

    if (sql.toUpperCase().includes('INSERT OR IGNORE')) {
      converted += ' ON CONFLICT DO NOTHING';
    } else if (sql.toUpperCase().includes('INSERT OR REPLACE')) {
      if (sql.toLowerCase().includes('project_members')) {
        converted = converted.replace(/INSERT OR REPLACE/gi, 'INSERT');
        converted += ' ON CONFLICT (project_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id';
      } else {
        converted = converted.replace(/INSERT OR REPLACE/gi, 'INSERT');
      }
    }

    if (sql.toUpperCase().includes('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
      const isLinkTable = sql.toLowerCase().includes('project_members') ||
        sql.toLowerCase().includes('role_permissions') ||
        sql.toLowerCase().includes('chat_group_members') ||
        sql.toLowerCase().includes('project_ai_settings');
      if (!isLinkTable) {
        converted += ' RETURNING id';
      }
    }
    return converted;
  };

  db = {
    serialize: (cb) => cb(),
    run: function (sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      const finalSql = convertSql(sql);
      pool.query(finalSql, params || [])
        .then(res => {
          // Sur PostgreSQL avec RETURNING id, le résultat est dans res.rows[0].id
          const lastID = res.rows?.[0]?.id || null;
          const result = { lastID, changes: res.rowCount };
          if (cb) cb.call(result, null);
        })
        .catch(err => {
          console.error('❌ [PG RUN ERROR]', { sql: finalSql, params, error: err.message });
          if (cb) cb(err);
        });
      return this;
    },
    get: function (sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      const finalSql = convertSql(sql);
      pool.query(finalSql, params || [])
        .then(res => {
          if (cb) cb(null, res.rows[0]);
        })
        .catch(err => {
          console.error('❌ [PG GET ERROR]', { sql: finalSql, params, error: err.message });
          if (cb) cb(err);
        });
      return this;
    },
    all: function (sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = []; }
      const finalSql = convertSql(sql);
      pool.query(finalSql, params || [])
        .then(res => {
          if (cb) cb(null, res.rows);
        })
        .catch(err => {
          console.error('❌ [PG ALL ERROR]', { sql: finalSql, params, error: err.message });
          if (cb) cb(err);
        });
      return this;
    },
    prepare: function (sql) {
      return {
        run: (...args) => {
          const cb = typeof args[args.length - 1] === 'function' ? args.pop() : null;
          db.run(sql, args, cb);
        },
        finalize: () => { }
      };
    }
  };
} else {
  console.log('Using SQLite (Local) 📁');
  const sqlite3 = require('sqlite3').verbose();
  const sqliteDb = new sqlite3.Database(path.join(__dirname, '../database/dev.db'), (err) => {
    if (err) console.error('DB connection error:', err.message);
    else console.log('Connected to SQLite database ✅');
  });
  db = sqliteDb;
}

/**
 * Sécurise l'ajout d'une colonne (Migration robuste)
 */
async function ensureColumn(tableName, columnName, columnDefinition) {
  return new Promise((resolve, reject) => {
    if (isProd) {
      // Postgres: ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...
      db.run(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${columnName} ${columnDefinition}`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      // SQLite: PRAGMA table_info
      db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
        if (err) return reject(err);
        const exists = columns.some(c => c.name === columnName);
        if (!exists) {
          db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, (err2) => {
            if (err2) reject(err2);
            else {
              console.log(`✅ Column added: ${tableName}.${columnName}`);
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    }
  });
}

// Initialisation des tables
const initDb = async () => {
  const isPostgres = !!process.env.DATABASE_URL;
  const autoInc = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const ignore = isPostgres ? '' : 'OR IGNORE';
  const conflict = isPostgres ? 'ON CONFLICT DO NOTHING' : '';

  // 1. Création des tables de base (Si non existantes)
  const baseTables = [
    `CREATE TABLE IF NOT EXISTS users (
      id ${autoInc},
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id ${autoInc},
      title TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER,
      PRIMARY KEY (project_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS roles (
      id ${autoInc},
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS permissions (
      id ${autoInc},
      name TEXT NOT NULL UNIQUE,
      description TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id ${autoInc},
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'normal',
      due_date TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id ${autoInc},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id ${autoInc},
      project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      action_type TEXT NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  try {
    for (const q of baseTables) {
      await new Promise((res, rej) => db.run(q, (err) => err ? rej(err) : res()));
    }

    // --- MIGRATIONS FORCÉES (POSTGRESQL PRODUCTION) ---
    if (isPostgres) {
      console.log('🐘 PostgreSQL migration: ensuring created_by/user_id columns are nullable...');
      const migrateNull = async (table, column = 'created_by') => {
        return new Promise(res => {
          db.run(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP NOT NULL`, (err) => {
            if (err) console.log(`ℹ️ [Migration] ${table}.${column} already nullable or table missing.`);
            res();
          });
        });
      };
      await migrateNull('tasks', 'created_by');
      await migrateNull('messages', 'user_id');
      await migrateNull('chat_groups', 'created_by');
      await migrateNull('chat_group_messages', 'user_id');
      await migrateNull('support_tickets', 'user_id');
      await migrateNull('ai_active_tasks', 'user_id');
    }

    // 2. Tables additionnelles
    const extraTables = [
      `CREATE TABLE IF NOT EXISTS task_comments (
        id ${autoInc},
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS milestones (
        id ${autoInc},
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS calendar_events (
        id ${autoInc},
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        start_datetime TEXT NOT NULL,
        end_datetime TEXT NOT NULL,
        location TEXT,
        created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS event_attendees (
        event_id INTEGER NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        notified INTEGER DEFAULT 0,
        PRIMARY KEY (event_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS calendar_date_notes (
        id ${autoInc},
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS invitations (
        id ${autoInc},
        project_id INTEGER NOT NULL REFERENCES projects(id),
        email TEXT NOT NULL,
        role_id INTEGER NOT NULL REFERENCES roles(id),
        inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS project_share_links (
        id ${autoInc},
        project_id INTEGER NOT NULL REFERENCES projects(id),
        role_id INTEGER NOT NULL DEFAULT 3,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS project_ai_settings (
        project_id INTEGER PRIMARY KEY REFERENCES projects(id),
        allow_create INTEGER DEFAULT 1,
        allow_modify INTEGER DEFAULT 1,
        allow_members INTEGER DEFAULT 1,
        allow_delete INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS support_tickets (
        id ${autoInc},
        user_id INTEGER NOT NULL REFERENCES users(id),
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        priority TEXT DEFAULT 'normal',
        admin_reply TEXT,
        replied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS ai_active_tasks (
        id ${autoInc},
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'running',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        id ${autoInc},
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS chat_groups (
        id ${autoInc},
        title TEXT NOT NULL,
        description TEXT,
        avatar TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS chat_group_members (
        group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role TEXT DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (group_id, user_id)
      )`,
      `CREATE TABLE IF NOT EXISTS chat_group_messages (
        id ${autoInc},
        group_id INTEGER REFERENCES chat_groups(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS email_verifications (
        id ${autoInc},
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const q of extraTables) {
      await new Promise((res, rej) => db.run(q, (err) => err ? rej(err) : res()));
    }

    // 3. Migrations (Colonnes manquantes) - APRES la création des tables
    await ensureColumn('users', 'last_login_at', 'TIMESTAMP');
    await ensureColumn('users', 'plan', "TEXT DEFAULT 'free'");
    await ensureColumn('users', 'ai_prompts_count', 'INTEGER DEFAULT 0');
    await ensureColumn('users', 'notif_project_updates', 'INTEGER DEFAULT 1');
    await ensureColumn('users', 'notif_added_to_project', 'INTEGER DEFAULT 1');
    await ensureColumn('users', 'notif_deadlines', 'INTEGER DEFAULT 1');
    await ensureColumn('users', 'notif_mentions', 'INTEGER DEFAULT 1');
    await ensureColumn('users', 'notif_task_completed', 'INTEGER DEFAULT 1');
    await ensureColumn('users', 'notif_ai_responses', 'INTEGER DEFAULT 1');
    await ensureColumn('users', 'notif_chat_messages', 'INTEGER DEFAULT 1');
    await ensureColumn('users', 'ai_history_duration', 'INTEGER DEFAULT 60');
    await ensureColumn('users', 'stripe_customer_id', 'TEXT');
    await ensureColumn('users', 'stripe_subscription_id', 'TEXT');
    await ensureColumn('users', 'login_attempts', 'INTEGER DEFAULT 0');
    await ensureColumn('users', 'locked_until', 'TIMESTAMP');
    await ensureColumn('users', 'banned', 'INTEGER DEFAULT 0');
    await ensureColumn('users', 'onboarding_status', 'INTEGER DEFAULT 0');
    await ensureColumn('users', 'marketing_source', 'TEXT');
    await ensureColumn('users', 'user_type', 'TEXT');
    await ensureColumn('users', 'usage_intent', 'TEXT');
    await ensureColumn('messages', 'attachment_url', 'TEXT');
    await ensureColumn('messages', 'attachment_name', 'TEXT');
    await ensureColumn('messages', 'attachment_type', 'TEXT');
    await ensureColumn('chat_group_messages', 'attachment_url', 'TEXT');
    await ensureColumn('chat_group_messages', 'attachment_name', 'TEXT');
    await ensureColumn('chat_group_messages', 'attachment_type', 'TEXT');
    await ensureColumn('ai_messages', 'attachment_url', 'TEXT');
    await ensureColumn('ai_messages', 'attachment_name', 'TEXT');
    await ensureColumn('ai_messages', 'attachment_type', 'TEXT');

    await ensureColumn('projects', 'status', "TEXT DEFAULT 'active'");
    await ensureColumn('projects', 'avatar', 'TEXT');
    await ensureColumn('projects', 'deadline', 'TIMESTAMP');
    await ensureColumn('projects', 'start_date', 'TEXT');
    await ensureColumn('email_verifications', 'attempts', 'INTEGER DEFAULT 0');

    await ensureColumn('notifications', 'from_user_id', 'INTEGER');
    await ensureColumn('notifications', 'task_id', 'INTEGER');

    await ensureColumn('project_members', 'is_favorite', 'INTEGER DEFAULT 0');
    await ensureColumn('tasks', 'color', 'TEXT');
    await ensureColumn('tasks', 'phase', 'TEXT');
    await ensureColumn('tasks', 'start_date', 'TEXT');
    await ensureColumn('calendar_events', 'link', 'TEXT');
    await ensureColumn('calendar_events', 'recurrence_group', 'TEXT');

    // 4. Données par défaut
    const defaults = [
      `INSERT ${ignore} INTO roles (id, name, is_default) VALUES (1, 'Propriétaire', 1) ${conflict}`,
      `INSERT ${ignore} INTO roles (id, name, is_default) VALUES (2, 'Admin', 1) ${conflict}`,
      `INSERT ${ignore} INTO roles (id, name, is_default) VALUES (3, 'Membre', 1) ${conflict}`,
      `INSERT ${ignore} INTO roles (id, name, is_default) VALUES (4, 'Observateur', 1) ${conflict}`,
      `INSERT ${ignore} INTO permissions (id, name, description) VALUES (1, 'manage_members', 'Ajouter et retirer des membres') ${conflict}`,
      `INSERT ${ignore} INTO permissions (id, name, description) VALUES (2, 'manage_roles', 'Créer et modifier des rôles') ${conflict}`,
      `INSERT ${ignore} INTO permissions (id, name, description) VALUES (3, 'edit_project', 'Modifier les informations du projet') ${conflict}`,
      `INSERT ${ignore} INTO permissions (id, name, description) VALUES (4, 'view_project', 'Voir le projet') ${conflict}`,
      `INSERT ${ignore} INTO permissions (id, name, description) VALUES (5, 'delete_project', 'Supprimer le projet') ${conflict}`,
      `INSERT ${ignore} INTO permissions (id, name, description) VALUES (6, 'view_activities', 'Voir le journal d''activités') ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (1,1) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (1,2) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (1,3) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (1,4) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (1,5) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (1,6) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (2,1) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (2,3) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (2,4) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (2,6) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (3,3) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (3,4) ${conflict}`,
      `INSERT ${ignore} INTO role_permissions VALUES (4,4) ${conflict}`
    ];

    for (const q of defaults) {
      await new Promise((res, rej) => db.run(q, (err) => err ? rej(err) : res()));
    }

    console.log('✅ Database Schema Initialized successfully');
  } catch (err) {
    console.error('❌ Failed to initialize database schema:', err.message);
  }
};

initDb();

module.exports = db;
