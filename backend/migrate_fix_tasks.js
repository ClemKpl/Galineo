const db = require('./db');

async function migrate() {
  console.log('🚀 Starting migration for Chat Groups and Task Constraints...');
  
  const isPostgres = !!process.env.DATABASE_URL;

  if (isPostgres) {
    try {
      // 1. Task constraint
      await new Promise((resolve, reject) => {
        db.run('ALTER TABLE tasks ALTER COLUMN created_by DROP NOT NULL', (err) => {
          if (err && !err.message.includes('not exist')) return reject(err);
          resolve();
        });
      });
      console.log('✅ Tasks: created_by is now nullable.');

      // 2. Chat Groups constraint
      await new Promise((resolve, reject) => {
        db.run('ALTER TABLE chat_groups ALTER COLUMN created_by DROP NOT NULL', (err) => {
          if (err && !err.message.includes('not exist')) return reject(err);
          resolve();
        });
      });
      console.log('✅ Chat Groups: created_by is now nullable.');

    } catch (err) {
      console.error('❌ PostgreSQL migration failed:', err.message);
    }
  } else {
    console.log('ℹ️ SQLite detected. Tables in db.js already have updated definitions.');
    console.log('   Any new tables (chat_groups, etc.) will be created correctly on start.');
  }
  
  process.exit(0);
}

migrate();
function run(sql, params = []) {
  return new Promise((res, rej) => db.run(sql, params, (err) => err ? rej(err) : res()));
}
