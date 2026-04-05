const express = require('express');
const pgDb = require('../pg-database');
const { authenticateToken } = require('../auth');

const router = express.Router();

function parseLocaleNumber(value) {
    if (typeof value === 'string') {
        return Number(value.replace(',', '.').trim());
    }
    return Number(value);
}

// Middleware: Todas las rutas requieren estar logueado.
router.use(authenticateToken);

// ---------------------------------------------------------
// -- METAS (GOALS) --
// ---------------------------------------------------------

// 1. Get/Set Goals (Metas del usuario logueado)
router.get('/goals', async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pgDb.query("SELECT * FROM goals WHERE user_id = $1 LIMIT 1", [userId]);

        if (result.rows.length === 0) {
            return res.json({ message: 'Aún no se han configurado metas.' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error fetching goals:', err);
        res.status(500).json({ error: 'Error al obtener las metas' });
    }
});

router.post('/goals', async (req, res) => {
    try {
        const { calories, protein, carbs, fat } = req.body;
        const userId = req.user.id;

        // Upsert logic (Insertar si no existe, actualizar si ya existe)
        const sql = `
            INSERT INTO goals (user_id, calories, protein, carbs, fat)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id)
            DO UPDATE SET
                calories = EXCLUDED.calories,
                protein = EXCLUDED.protein,
                carbs = EXCLUDED.carbs,
                fat = EXCLUDED.fat
            RETURNING *`;

        const result = await pgDb.query(sql, [userId, calories, protein, carbs, fat]);
        res.json({ success: true, data: result.rows[0] });

    } catch (err) {
        console.error('Error setting goals:', err);
        res.status(500).json({ error: 'Error al actualizar las metas' });
    }
});

// ---------------------------------------------------------
// -- MÉTRICAS CORPORALES (BODY METRICS) --
// ---------------------------------------------------------

// 2. Body Metrics History (30 días de progreso)
router.get('/body-metrics', async (req, res) => {
    try {
        const userId = req.user.id;
        const sql = `SELECT * FROM body_metrics WHERE user_id = $1 ORDER BY date DESC LIMIT 30`;
        const result = await pgDb.query(sql, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching body metrics:', err);
        res.status(500).json({ error: 'Error al obtener las métricas' });
    }
});

// 3. Log Body Metric (Registrar peso o medidas de hoy)
router.post('/body-metrics', async (req, res) => {
    try {
        const { date, weight_kg, height_cm, waist_cm, chest_cm, hips_cm, notes, sleep_hours, stress_level } = req.body;
        const userId = req.user.id;

        if (!date) {
            return res.status(400).json({ error: 'La fecha es obligatoria' });
        }

        const toNum = v => (v !== undefined && v !== null && v !== '') ? parseLocaleNumber(v) : null;
        const w = toNum(weight_kg);
        const h = toNum(height_cm);
        const waist = toNum(waist_cm);
        const chest = toNum(chest_cm);
        const hips = toNum(hips_cm);
        const sleep = toNum(sleep_hours);
        const stress = stress_level !== undefined && stress_level !== null && stress_level !== '' ? parseInt(stress_level, 10) : null;

        if (w !== null && (!Number.isFinite(w) || w <= 0)) return res.status(400).json({ error: 'Peso inválido' });
        if (h !== null && (!Number.isFinite(h) || h <= 0)) return res.status(400).json({ error: 'Altura inválida' });
        if (stress !== null && (stress < 1 || stress > 5)) return res.status(400).json({ error: 'Estrés debe ser entre 1 y 5' });

        const sql = `
            INSERT INTO body_metrics (user_id, date, weight_kg, height_cm, waist_cm, chest_cm, hips_cm, notes, sleep_hours, stress_level)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`;

        const result = await pgDb.query(sql, [userId, date, w, h, waist, chest, hips, notes || null, sleep, stress]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('Error logging body metric:', err);
        res.status(500).json({ error: 'Error al registrar las medidas' });
    }
});

// 4. Delete Body Metric
router.delete('/body-metrics/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID inválido' });
        }

        const sql = `DELETE FROM body_metrics WHERE id = $1 AND user_id = $2 RETURNING id`;
        const result = await pgDb.query(sql, [id, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado o no autorizado' });
        }

        res.json({ success: true, message: 'Medida eliminada correctamente' });

    } catch (err) {
        console.error('Error deleting body metric:', err);
        res.status(500).json({ error: 'Error al eliminar la medida' });
    }
});

module.exports = router;
