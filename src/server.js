const express = require('express');
const bodyParser = require('body-parser');
const pgDb = require('./pg-database'); // <--- NUEVA BASE DE DATOS
const { authController, authenticateToken, requireRole } = require('./auth'); // <--- AUTENTICACIÓN
const path = require('path');

// Mantenemos vivo el backend antiguo para que las rutas no se rompan
const db = require('./database');
require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa PostgreSQL al arrancar el servidor
pgDb.initDb().catch(console.error);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

function parseLocaleNumber(value) {
    if (typeof value === 'string') {
        return Number(value.replace(',', '.').trim());
    }
    return Number(value);
}

// --- API ROUTES ---

// -- RUTAS DE AUTENTICACIÓN Y USUARIOS (NUEVAS) --
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);

// Rutas protegidas de perfil (Cualquier usuario logueado)
app.get('/api/profile', authenticateToken, authController.getProfile);

// -- EJEMPLO RUTA DE ENTRENADOR --
// Solo entrenadores pueden listar todos sus clientes
app.get('/api/trainer/clients', authenticateToken, requireRole('trainer'), async (req, res) => {
  try {
    const clients = await pgDb.query(`
      SELECT u.id, u.email, tc.status, tc.assigned_at
      FROM users u
      JOIN trainer_clients tc ON u.id = tc.client_id
      WHERE tc.trainer_id = $1
    `, [req.user.id]);
    res.json(clients.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// 1. Search Foods
app.get('/api/foods', (req, res) => {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const sql = rawQuery
        ? `SELECT * FROM foods WHERE name LIKE ? ORDER BY name ASC LIMIT 50`
        : `SELECT * FROM foods ORDER BY name ASC LIMIT 50`;
    const params = rawQuery ? [`%${rawQuery}%`] : [];

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/foods', (req, res) => {
    const { name, calories, protein, carbs, fat } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedName) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const values = [parseLocaleNumber(calories), parseLocaleNumber(protein), parseLocaleNumber(carbs), parseLocaleNumber(fat)];
    const hasInvalid = values.some(v => !Number.isFinite(v) || v < 0);
    if (hasInvalid) {
        return res.status(400).json({ error: 'Invalid macro values' });
    }

    const sql = `INSERT INTO foods (name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [normalizedName, ...values], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        return res.status(201).json({
            id: this.lastID,
            name: normalizedName,
            calories: values[0],
            protein: values[1],
            carbs: values[2],
            fat: values[3]
        });
    });
});

app.put('/api/foods/:id', (req, res) => {
    const foodId = Number(req.params.id);
    const { name, calories, protein, carbs, fat } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!Number.isInteger(foodId) || foodId <= 0) {
        return res.status(400).json({ error: 'Invalid food id' });
    }

    if (!normalizedName) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const values = [parseLocaleNumber(calories), parseLocaleNumber(protein), parseLocaleNumber(carbs), parseLocaleNumber(fat)];
    const hasInvalid = values.some(v => !Number.isFinite(v) || v < 0);
    if (hasInvalid) {
        return res.status(400).json({ error: 'Invalid macro values' });
    }

    const sql = `UPDATE foods SET name = ?, calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?`;
    db.run(sql, [normalizedName, ...values, foodId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Food not found' });
        }

        return res.json({
            success: true,
            id: foodId,
            name: normalizedName,
            calories: values[0],
            protein: values[1],
            carbs: values[2],
            fat: values[3]
        });
    });
});

// 2. Get Today's Meal Logs
app.get('/api/logs', (req, res) => {
    // Expects date in query YYYY-MM-DD
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const sql = `
        SELECT l.id, l.date, l.quantity, l.unit, l.food_id, f.name, f.calories, f.protein, f.carbs, f.fat
        FROM logs l
        JOIN foods f ON l.food_id = f.id
        WHERE l.date = ?`;

    db.all(sql, [date], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 3. Log a Meal
app.post('/api/logs', (req, res) => {
    const { date, food_id, quantity, unit } = req.body;
    const normalizedUnit = ['g', 'unit', 'serving'].includes(unit) ? unit : 'g';

    if (!date || !food_id || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    const sql = `INSERT INTO logs (date, food_id, quantity, unit) VALUES (?, ?, ?, ?)`;

    db.run(sql, [date, food_id, quantity, normalizedUnit], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, date, food_id, quantity, unit: normalizedUnit });
    });
});

app.put('/api/logs/:id', (req, res) => {
    const logId = Number(req.params.id);
    const { quantity, unit, food_id } = req.body;
    const normalizedUnit = ['g', 'unit', 'serving'].includes(unit) ? unit : 'g';

    if (!Number.isInteger(logId) || logId <= 0) {
        return res.status(400).json({ error: 'Invalid log id' });
    }

    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: 'Invalid quantity' });
    }

    const hasFoodUpdate = Number.isInteger(Number(food_id)) && Number(food_id) > 0;
    const sql = hasFoodUpdate
        ? `UPDATE logs SET quantity = ?, unit = ?, food_id = ? WHERE id = ?`
        : `UPDATE logs SET quantity = ?, unit = ? WHERE id = ?`;
    const params = hasFoodUpdate
        ? [quantity, normalizedUnit, Number(food_id), logId]
        : [quantity, normalizedUnit, logId];

    db.run(sql, params, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Log not found' });
        }

        return res.json({ success: true, id: logId, quantity, unit: normalizedUnit, food_id: hasFoodUpdate ? Number(food_id) : undefined });
    });
});

app.delete('/api/logs/:id', (req, res) => {
    const logId = Number(req.params.id);
    if (!Number.isInteger(logId) || logId <= 0) {
        return res.status(400).json({ error: 'Invalid log id' });
    }

    db.run(`DELETE FROM logs WHERE id = ?`, [logId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Log not found' });
        }

        return res.json({ success: true, id: logId });
    });
});

// 4. Get Workout History (for charts)
app.get('/api/workouts', (req, res) => {
    const exercise = req.query.exercise; // Optional filter
    let sql = `SELECT * FROM workouts ORDER BY date ASC`;
    let params = [];

    if (exercise) {
        sql = `SELECT * FROM workouts WHERE exercise = ? ORDER BY date ASC`;
        params = [exercise];
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 5. Log a Workout Set
app.post('/api/workouts', (req, res) => {
    const { date, exercise, weight, reps } = req.body;
    const sql = `INSERT INTO workouts (date, exercise, weight, reps) VALUES (?, ?, ?, ?)`;

    db.run(sql, [date, exercise, weight, reps], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, date, exercise, weight, reps });
    });
});

// 6. Get/Set Goals
app.get('/api/goals', (req, res) => {
    db.get("SELECT * FROM goals LIMIT 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

app.post('/api/goals', (req, res) => {
    const { calories, protein, carbs, fat } = req.body;
    // Assuming single user single goal for now
    db.run(`UPDATE goals SET calories = ?, protein = ?, carbs = ?, fat = ?`,
        [calories, protein, carbs, fat],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        }
    );
});

// 7. Body Metrics
app.get('/api/body-metrics', (req, res) => {
    db.all(`SELECT * FROM body_metrics ORDER BY date DESC LIMIT 30`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/body-metrics', (req, res) => {
    const { date, weight_kg, height_cm, waist_cm, chest_cm, hips_cm, notes } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const toNum = v => (v !== undefined && v !== null && v !== '') ? parseLocaleNumber(v) : null;
    const w = toNum(weight_kg);
    const h = toNum(height_cm);
    const waist = toNum(waist_cm);
    const chest = toNum(chest_cm);
    const hips = toNum(hips_cm);

    if (w !== null && (!Number.isFinite(w) || w <= 0)) return res.status(400).json({ error: 'Invalid weight' });
    if (h !== null && (!Number.isFinite(h) || h <= 0)) return res.status(400).json({ error: 'Invalid height' });

    db.run(
        `INSERT INTO body_metrics (date, weight_kg, height_cm, waist_cm, chest_cm, hips_cm, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [date, w, h, waist, chest, hips, notes || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, date, weight_kg: w, height_cm: h, waist_cm: waist, chest_cm: chest, hips_cm: hips, notes: notes || null });
        }
    );
});

app.delete('/api/body-metrics/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    db.run(`DELETE FROM body_metrics WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
        res.json({ success: true });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
