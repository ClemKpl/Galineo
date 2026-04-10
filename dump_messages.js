const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'backend', 'galineo.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Querying ai_messages from:', dbPath);
db.all('SELECT * FROM ai_messages ORDER BY id DESC LIMIT 10', (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Results:', JSON.stringify(rows, null, 2));
  }
  db.close();
});
