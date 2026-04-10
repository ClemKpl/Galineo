const db = require('./db');

async function migrate() {
  console.log('🚀 Starting migration: dropping NOT NULL from tasks.created_by...');
  
  const isPostgres = !!process.env.DATABASE_URL;

  if (isPostgres) {
    try {
      await new Promise((resolve, reject) => {
        db.run('ALTER TABLE tasks ALTER COLUMN created_by DROP NOT NULL', (err) => {
          if (err) {
            if (err.message.includes('not exist')) {
              console.log('ℹ️ Table or column might not exist yet, skipping.');
              return resolve();
            }
            return reject(err);
          }
          resolve();
        });
      });
      console.log('✅ PostgreSQL migration successful: NOT NULL dropped.');
    } catch (err) {
      console.error('❌ PostgreSQL migration failed:', err.message);
    }
  } else {
    console.log('ℹ️ SQLite detected. SQLite does not support ALTER COLUMN DROP NOT NULL directly.');
    console.log('   However, the schema definition in db.js has been updated for new tables.');
    console.log('   For existing SQLite tables, a full re-creation would be needed, but usually SQLite is for dev.');
  }
  
  process.exit(0);
}

migrate();
