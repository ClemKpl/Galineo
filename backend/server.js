const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('../database/dev.db', (err) => {
  if (err) {
    console.error(err.message);
  } else {
    console.log('Connected to SQLite database ✅');
  }
});

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT
  )
`);

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// route test
app.get('/test', (req, res) => {
  res.json({ message: 'Backend OK 🚀' });
});

app.post('/users', (req, res) => {
  const { name } = req.body;

  db.run(
    'INSERT INTO users (name) VALUES (?)',
    [name],
    function (err) {
      if (err) {
        return res.status(500).json(err);
      }
      res.json({ id: this.lastID, name });
    }
  );
});

app.get('/users', (req, res) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json(rows);
  });
});

app.listen(3001, () => {
  console.log('Server running on http://localhost:3001');
});