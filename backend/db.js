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
      .replace(/\?/g, (_, i, s) => `$${s.substring(0, i).split('?').length}`) // ? -> $1, $2...
      .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY')
      .replace(/INSERT OR IGNORE/gi, 'INSERT')
      .replace(/INSERT OR REPLACE/gi, 'INSERT')
      .replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
      .replace(/DATETIME/gi, 'TIMESTAMP')
      // Advanced GROUP_CONCAT to STRING_AGG conversion
      .replace(/GROUP_CONCAT\s*\(\s*(.*?)\s*\)/gi, (match, p1) => {
        // If it's already using STRING_AGG or has complex args, leave it mostly alone but ensure cast
        if (p1.toLowerCase().includes('distinct')) {
           return `STRING_AGG(DISTINCT ${p1.replace(/distinct/gi, '').trim()}::text, ',')`;
        }
        return `STRING_AGG(${p1.trim()}::text, ',')`;
      });
    
    // Add ON CONFLICT DO NOTHING for pseudo-IGNORE or DO UPDATE for REPLACE
    if (sql.toUpperCase().includes('INSERT OR IGNORE')) {
      converted += ' ON CONFLICT DO NOTHING';
    } else if (sql.toUpperCase().includes('INSERT OR REPLACE')) {
      // Specifically for project_members which uses project_id, user_id as PK
      if (sql.toLowerCase().includes('project_members')) {
        converted = converted.replace(/INSERT OR REPLACE/gi, 'INSERT');
        converted += ' ON CONFLICT (project_id, user_id) DO UPDATE SET role_id = EXCLUDED.role_id';
      } else {
        converted = converted.replace(/INSERT OR REPLACE/gi, 'INSERT');
      }
    }
    
    // Auto-return ID for inserts if needed (except for link tables without 'id' column)
    if (sql.toUpperCase().includes('INSERT') && !sql.toUpperCase().includes('RETURNING')) {
      const isLinkTable = sql.toLowerCase().includes('project_members') || sql.toLowerCase().includes('role_permissions');
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
          const result = { lastID: res.rows[0]?.id || null, changes: res.rowCount };
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
    prepare: function(sql) {
      return {
        run: (...args) => {
          const cb = typeof args[args.length-1] === 'function' ? args.pop() : null;
          db.run(sql, args, cb);
        },
        finalize: () => {}
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

// Initialisation des tables (Séquentielle)
const initDb = async () => {
  const isPostgres = !!process.env.DATABASE_URL;
  const autoInc = isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const ignore = isPostgres ? '' : 'OR IGNORE';
  const conflict = isPostgres ? 'ON CONFLICT DO NOTHING' : '';

  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id ${autoInc},
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      last_login_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP`,
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
      role_id INTEGER,
      permission_id INTEGER,
      PRIMARY KEY (role_id, permission_id)
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id ${autoInc},
      title TEXT NOT NULL,
      description TEXT,
      deadline TIMESTAMP,
      status TEXT DEFAULT 'active',
      owner_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`,
    `ALTER TABLE projects ADD COLUMN IF NOT EXISTS avatar TEXT`,
    `CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER,
      user_id INTEGER,
      role_id INTEGER,
      PRIMARY KEY (project_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id ${autoInc},
      project_id INTEGER NOT NULL,
      parent_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'normal',
      phase TEXT,
      start_date TEXT,
      due_date TEXT,
      created_by INTEGER NOT NULL,
      assigned_to INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS task_comments (
      id ${autoInc},
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id ${autoInc},
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS milestones (
      id ${autoInc},
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id ${autoInc},
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      project_id INTEGER,
      task_id INTEGER,
      from_user_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `INSERT ${ignore} INTO roles (id, name, is_default) VALUES (1, 'Propriétaire', 1) ${conflict}`,
    `INSERT ${ignore} INTO roles (id, name, is_default) VALUES (2, 'Admin', 1) ${conflict}`,
    `INSERT ${ignore} INTO roles (id, name, is_default) VALUES (3, 'Membre', 1) ${conflict}`,
    `INSERT ${ignore} INTO roles (id, name, is_default) VALUES (4, 'Observateur', 1) ${conflict}`,
    `INSERT ${ignore} INTO permissions (id, name, description) VALUES (1, 'manage_members', 'Ajouter et retirer des membres') ${conflict}`,
    `INSERT ${ignore} INTO permissions (id, name, description) VALUES (2, 'manage_roles', 'Créer et modifier des rôles') ${conflict}`,
    `INSERT ${ignore} INTO permissions (id, name, description) VALUES (3, 'edit_project', 'Modifier les informations du projet') ${conflict}`,
    `INSERT ${ignore} INTO permissions (id, name, description) VALUES (4, 'view_project', 'Voir le projet') ${conflict}`,
    `INSERT ${ignore} INTO permissions (id, name, description) VALUES (5, 'delete_project', 'Supprimer le projet') ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (1,1) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (1,2) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (1,3) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (1,4) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (1,5) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (2,1) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (2,3) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (2,4) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (3,3) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (3,4) ${conflict}`,
    `INSERT ${ignore} INTO role_permissions VALUES (4,4) ${conflict}`,
    `CREATE TABLE IF NOT EXISTS calendar_events (
      id ${autoInc},
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_datetime TEXT NOT NULL,
      end_datetime TEXT NOT NULL,
      location TEXT,
      created_by INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS event_attendees (
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      notified INTEGER DEFAULT 0,
      PRIMARY KEY (event_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS calendar_date_notes (
      id ${autoInc},
      project_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  if (isPostgres) {
    try {
      for (const q of queries) {
        await new Promise((resolve, reject) => {
          db.run(q, (err) => err ? reject(err) : resolve());
        });
      }
      console.log('✅ PostgreSQL Tables Initialized');
    } catch (err) {
      console.error('❌ Failed to initialize PG tables:', err.message);
    }
  } else {
    db.serialize(() => {
      queries.forEach(q => db.run(q));
      // Migration: add last_login_at if not exists
      db.all(`PRAGMA table_info(users)`, [], (err, columns) => {
        if (err) return console.error('DB migration error (users):', err.message);
        const hasLastLoginAt = Array.isArray(columns) && columns.some((c) => c && c.name === 'last_login_at');
        if (!hasLastLoginAt) {
          db.run(`ALTER TABLE users ADD COLUMN last_login_at DATETIME`, (alterErr) => {
            if (alterErr) console.error('DB migration error (add last_login_at):', alterErr.message);
          });
        }
      });
      console.log('✅ SQLite Tables Initialized 📁');
    });
  }
};

initDb();

module.exports = db;
