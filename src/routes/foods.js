const express = require('express');
const pgDb = require('../pg-database');
const { authenticateToken, requireRole } = require('../auth');

const router = express.Router();

function parseLocaleNumber(value) {
    if (typeof value === 'string') {
        return Number(value.replace(',', '.').trim());
    }
    return Number(value);
}

// 1. Search Foods (Todos los usuarios autenticados)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        let sql = `SELECT * FROM foods`;
        let params = [];

        if (rawQuery) {
            sql += ` WHERE name ILIKE $1`;
            params.push(`%${rawQuery}%`);
        }

        sql += ` ORDER BY name ASC LIMIT 50`;

        const result = await pgDb.query(sql, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching foods:', err);
        res.status(500).json({ error: 'Error al buscar alimentos' });
    }
});

// 2. Create Food (Cualquier usuario autenticado puede crear sus alimentos si no los encuentra)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, calories, protein, carbs, fat } = req.body;
        const normalizedName = typeof name === 'string' ? name.trim() : '';

        if (!normalizedName) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const values = [parseLocaleNumber(calories), parseLocaleNumber(protein), parseLocaleNumber(carbs), parseLocaleNumber(fat)];
        const hasInvalid = values.some(v => !Number.isFinite(v) || v < 0);
        if (hasInvalid) {
            return res.status(400).json({ error: 'Los valores de macros son inválidos' });
        }

        // trainer_id es el id del usuario que crea el alimento
        const trainerId = req.user.id;

        const sql = `
            INSERT INTO foods (name, calories, protein, carbs, fat, trainer_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`;

        const result = await pgDb.query(sql, [normalizedName, ...values, trainerId]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('Error creating food:', err);
        res.status(500).json({ error: 'Error al crear el alimento' });
    }
});

// 3. Update Food (Cualquier usuario puede editar el alimento que él mismo creó)
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const foodId = Number(req.params.id);
        const { name, calories, protein, carbs, fat } = req.body;
        const normalizedName = typeof name === 'string' ? name.trim() : '';

        if (!Number.isInteger(foodId) || foodId <= 0) {
            return res.status(400).json({ error: 'ID de alimento inválido' });
        }

        if (!normalizedName) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }

        const values = [parseLocaleNumber(calories), parseLocaleNumber(protein), parseLocaleNumber(carbs), parseLocaleNumber(fat)];
        const hasInvalid = values.some(v => !Number.isFinite(v) || v < 0);
        if (hasInvalid) {
            return res.status(400).json({ error: 'Los valores de macros son inválidos' });
        }

        const trainerId = req.user.id;

        // Solo puede editarlo si él lo creó (o podríamos agregar lógica de admin)
        const sql = `
            UPDATE foods
            SET name = $1, calories = $2, protein = $3, carbs = $4, fat = $5
            WHERE id = $6 AND (trainer_id = $7 OR trainer_id IS NULL)
            RETURNING *`;

        const result = await pgDb.query(sql, [normalizedName, ...values, foodId, trainerId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Alimento no encontrado o no tienes permiso para editarlo' });
        }

        res.json({ success: true, data: result.rows[0] });

    } catch (err) {
        console.error('Error updating food:', err);
        res.status(500).json({ error: 'Error al actualizar el alimento' });
    }
});

module.exports = router;
