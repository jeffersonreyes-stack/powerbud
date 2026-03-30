require('dotenv').config(); // <-- CARGAR VARIABLES DE ENTORNO PRIMERO
const express = require('express');
const bodyParser = require('body-parser');
const pgDb = require('./pg-database'); // <--- NUEVA BASE DE DATOS
const { authController, authenticateToken, requireRole } = require('./auth'); // <--- AUTENTICACIÓN
const aiService = require('./ai'); // <--- IA DE GEMINI
const path = require('path');

// RUTAS v2 (MIGRACIÓN A POSTGRESQL)
const foodsRoutes = require('./routes/foods');
const logsRoutes = require('./routes/logs');
const metricsRoutes = require('./routes/metrics');
const workoutsRoutes = require('./routes/workouts');
const relationsRoutes = require('./routes/relations');
const reviewsRoutes = require('./routes/reviews');
const uploadRoutes = require('./routes/upload');

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

// -- SERVICIOS DE INTELIGENCIA ARTIFICIAL (GEMINI) --
// ¡EL ENTRENADOR VIRTUAL!
// Ahora cualquier usuario (cliente o entrenador humano) puede pedirle a Gemini una rutina automática.
app.post('/api/v2/ai/generate-workout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let clientProfile = {};

    // 1. Si es un CLIENTE NORMAL: Él no tiene que llenar nada extra.
    // Vamos a la base de datos y le armamos el perfil automáticamente leyendo sus métricas y metas.
    if (req.user.role === 'client') {

      // Consultamos su peso, edad y metas más recientes de PostgreSQL:
      // A. Su meta principal (para saber si quiere perder peso o hipertrofia)
      const goalRes = await pgDb.query(`SELECT calories FROM goals WHERE user_id = $1 LIMIT 1`, [userId]);
      const clientGoal = goalRes.rows.length > 0 ? (goalRes.rows[0].calories > 2500 ? "Volumen/Hipertrofia" : "Pérdida de grasa") : "Mejora de la condición física";

      // B. Su peso y altura más recientes
      const metricsRes = await pgDb.query(`
        SELECT weight_kg, height_cm, notes
        FROM body_metrics
        WHERE user_id = $1 ORDER BY date DESC LIMIT 1
      `, [userId]);

      const metrics = metricsRes.rows.length > 0 ? metricsRes.rows[0] : {};

      // Armamos el perfil "silencioso" para dárselo a Gemini
      clientProfile = {
        age: 'No especificada', // Podríamos agregar edad a la tabla users después
        weight_kg: metrics.weight_kg || 'No especificado',
        height_cm: metrics.height_cm || 'No especificada',
        goal: clientGoal,
        days_per_week: 3, // Días predeterminados para un cliente normal
        experience_level: 'Principiante',
        injuries: metrics.notes || 'Ninguna reportada' // Si en "notes" de body_metrics puso "me duele la rodilla", la IA lo lee
      };

    }
    // 2. Si es un ENTRENADOR: Él sí manda el perfil personalizado de un cliente suyo por el body (req.body)
    let targetClientIdForTrainer = null;
    if (req.user.role === 'trainer') {

      // BLOQUEO: Entrenadores No Verificados no pueden usar la IA
      const statusRes = await pgDb.query(`SELECT verification_status FROM users WHERE id = $1`, [userId]);
      if (statusRes.rows[0].verification_status !== 'verified') {
        return res.status(403).json({ error: 'Tu cuenta de entrenador aún no ha sido verificada. Sube tu certificado para usar el Asistente Virtual.' });
      }

      if (!req.body.clientProfile || !req.body.client_id) {
        return res.status(400).json({ error: 'Como entrenador, debes enviar el perfil del cliente (clientProfile) y su ID (client_id).' });
      }
      clientProfile = req.body.clientProfile;
      targetClientIdForTrainer = req.body.client_id;
    }

    // Llamamos a la magia de Gemini (Entrenador Virtual) usando los datos recolectados
    console.log('Generando rutina mágica con Gemini. Objetivo:', clientProfile.goal);
    const workoutPlan = await aiService.generateWorkoutPlan(clientProfile);

    // GUARDADO AUTOMÁTICO EN BASE DE DATOS
    // El Entrenador Virtual itera sobre los días y ejercicios para inyectarlos en la tabla 'workouts'
    const today = new Date();

    for (const day of workoutPlan.workout_plan.days) {
      // Por cada día del plan, sumamos un día a la fecha actual para crear el calendario
      const workoutDate = new Date(today);
      workoutDate.setDate(today.getDate() + (day.day_number - 1));
      const sqlDate = workoutDate.toISOString().split('T')[0];

      for (const exercise of day.exercises) {
        // Asumimos un peso predeterminado (ej. 10kg) para que el cliente lo modifique después
        const defaultWeight = 10;

        // Interpretar los reps (Si Gemini devuelve "8-12", agarramos el 10 como promedio para la BD)
        let repsToSave = 10;
        if (typeof exercise.reps === 'number') {
           repsToSave = exercise.reps;
        } else if (typeof exercise.reps === 'string') {
           const match = exercise.reps.match(/\d+/);
           if (match) repsToSave = parseInt(match[0], 10);
        }

        const exerciseName = `${day.focus}: ${exercise.name}`;

        // Determinar a quién se le asigna la rutina en la base de datos
        // Si el rol es cliente, usa su propio ID (userId) y el trainer_id queda NULL (Entrenador Virtual)
        // Si el rol es entrenador, asigna la rutina al cliente objetivo y se firma con el userId del entrenador
        const assignToClientId = req.user.role === 'trainer' ? targetClientIdForTrainer : userId;
        const assignedByTrainerId = req.user.role === 'trainer' ? userId : null;

        await pgDb.query(`
          INSERT INTO workouts (client_id, trainer_id, date, exercise, weight, reps, modified_by_client)
          VALUES ($1, $2, $3, $4, $5, $6, FALSE)
        `, [assignToClientId, assignedByTrainerId, sqlDate, exerciseName, defaultWeight, repsToSave]);
      }
    }

    // Devolvemos el JSON estructurado
    res.json({
      success: true,
      message: 'El Entrenador Virtual ha generado tu rutina y la ha guardado en tu historial.',
      data: workoutPlan,
      profileUsed: clientProfile
    });

  } catch (error) {
    console.error('Error en el Entrenador Virtual (IA):', error);
    res.status(500).json({ error: 'Hubo un problema al contactar a la Inteligencia Artificial. Inténtalo más tarde.' });
  }
});


// -- RUTAS v2 (PostgreSQL) --
// Registramos las rutas migradas bajo el prefijo /api/v2/
app.use('/api/v2/foods', foodsRoutes);
app.use('/api/v2/logs', logsRoutes);
app.use('/api/v2/progress', metricsRoutes);
app.use('/api/v2/workouts', workoutsRoutes);
app.use('/api/v2/relations', relationsRoutes);
app.use('/api/v2/reviews', reviewsRoutes);
app.use('/api/v2/upload', uploadRoutes);

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
