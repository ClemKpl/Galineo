const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, '../database/dev.db'), (err) => {
  if (err) {
    console.error('DB connection error:', err.message);
  } else {
    console.log('Connected to SQLite database ✅');
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    is_default INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER,
    permission_id INTEGER,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    deadline TEXT,
    owner_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS project_members (
    project_id INTEGER,
    user_id INTEGER,
    role_id INTEGER,
    PRIMARY KEY (project_id, user_id),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  )`);

  // Seed default roles
  db.run(`INSERT OR IGNORE INTO roles (id, name, is_default) VALUES
    (1, 'Propriétaire', 1),
    (2, 'Admin', 1),
    (3, 'Membre', 1),
    (4, 'Observateur', 1)`);

  // Seed permissions
  db.run(`INSERT OR IGNORE INTO permissions (id, name, description) VALUES
    (1, 'manage_members', 'Ajouter et retirer des membres'),
    (2, 'manage_roles', 'Créer et modifier des rôles'),
    (3, 'edit_project', 'Modifier les informations du projet'),
    (4, 'view_project', 'Voir le projet'),
    (5, 'delete_project', 'Supprimer le projet')`);

  // Seed role_permissions
  db.run(`INSERT OR IGNORE INTO role_permissions VALUES (1,1),(1,2),(1,3),(1,4),(1,5)`);
  db.run(`INSERT OR IGNORE INTO role_permissions VALUES (2,1),(2,3),(2,4)`);
  db.run(`INSERT OR IGNORE INTO role_permissions VALUES (3,3),(3,4)`);
  db.run(`INSERT OR IGNORE INTO role_permissions VALUES (4,4)`);
});

module.exports = db;
