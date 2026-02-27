const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'powerbud.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initDb();
  }
});

function initDb() {
  db.serialize(() => {
    // Foods table
    db.run(`CREATE TABLE IF NOT EXISTS foods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL
    )`);

    // Logs table (for meals)
    db.run(`CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      food_id INTEGER,
      quantity REAL NOT NULL, -- in grams or servings
      FOREIGN KEY (food_id) REFERENCES foods(id)
    )`);

    // Workouts table
    db.run(`CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      exercise TEXT NOT NULL,
      weight REAL NOT NULL,
      reps INTEGER NOT NULL
    )`);

    // Daily Goals table
    db.run(`CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      calories INTEGER NOT NULL,
      protein INTEGER NOT NULL,
      carbs INTEGER NOT NULL,
      fat INTEGER NOT NULL
    )`);

    // Insert default goals if not exists
    db.get("SELECT count(*) as count FROM goals", (err, row) => {
        if (row && row.count === 0) {
            db.run(`INSERT INTO goals (calories, protein, carbs, fat) VALUES (2000, 150, 200, 65)`);
            console.log("Default goals inserted.");
        }
    });

    console.log('Database tables initialized.');
  });
}

module.exports = db;
