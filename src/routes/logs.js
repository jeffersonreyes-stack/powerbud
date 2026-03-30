const express = require('express');
const pgDb = require('../pg-database');
const { authenticateToken } = require('../auth');

const router = express.Router();

// Middleware: Todas las rutas de Logs requieren que el usuario esté autenticado.
router.use(authenticateToken);

// 1. Get Today's Meal Logs (para el usuario autenticado)
router.get('/', async (req, res) => {
    try {
        // Si no envía fecha, asume hoy
        const date = req.query.date || new Date().toISOString().split('T')[0];
        const userId = req.user.id;

        const sql = `
            SELECT l.id, l.date, l.quantity, l.unit, l.food_id, f.name, f.calories, f.protein, f.carbs, f.fat
            FROM logs l
            JOIN foods f ON l.food_id = f.id
            WHERE l.user_id = $1 AND l.date = $2
            ORDER BY l.id ASC
        `;

        const result = await pgDb.query(sql, [userId, date]);
        res.json(result.rows);

    } catch (err) {
        console.error('Error fetching logs:', err);
        res.status(500).json({ error: 'Error al obtener el diario de comidas' });
    }
});

// 2. Log a Meal (El cliente registra que comió algo)
router.post('/', async (req, res) => {
    try {
        const { date, food_id, quantity, unit } = req.body;
        const normalizedUnit = ['g', 'unit', 'serving'].includes(unit) ? unit : 'g';
        const userId = req.user.id;

        if (!date || !food_id || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
            return res.status(400).json({ error: 'Faltan datos obligatorios o son inválidos' });
        }

        // Validar que el alimento exista
        const foodCheck = await pgDb.query(`SELECT id FROM foods WHERE id = $1`, [food_id]);
        if (foodCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Alimento no encontrado en la base de datos' });
        }

        const sql = `
            INSERT INTO logs (user_id, date, food_id, quantity, unit)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`;

        const result = await pgDb.query(sql, [userId, date, food_id, quantity, normalizedUnit]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('Error logging meal:', err);
        res.status(500).json({ error: 'Error al registrar la comida' });
    }
});

// 3. Update Meal Log (Editar la cantidad que comió)
router.put('/:id', async (req, res) => {
    try {
        const logId = Number(req.params.id);
        const { quantity, unit, food_id } = req.body;
        const normalizedUnit = ['g', 'unit', 'serving'].includes(unit) ? unit : 'g';
        const userId = req.user.id; // El log debe pertenecer al usuario

        if (!Number.isInteger(logId) || logId <= 0) {
            return res.status(400).json({ error: 'ID de registro inválido' });
        }

        if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
            return res.status(400).json({ error: 'Cantidad inválida' });
        }

        const hasFoodUpdate = Number.isInteger(Number(food_id)) && Number(food_id) > 0;

        let sql;
        let params;

        if (hasFoodUpdate) {
            // Verificar que el nuevo alimento exista
            const foodCheck = await pgDb.query(`SELECT id FROM foods WHERE id = $1`, [food_id]);
            if (foodCheck.rows.length === 0) {
                return res.status(404).json({ error: 'Nuevo alimento no encontrado' });
            }

            sql = `UPDATE logs SET quantity = $1, unit = $2, food_id = $3 WHERE id = $4 AND user_id = $5 RETURNING *`;
            params = [quantity, normalizedUnit, Number(food_id), logId, userId];
        } else {
            sql = `UPDATE logs SET quantity = $1, unit = $2 WHERE id = $3 AND user_id = $4 RETURNING *`;
            params = [quantity, normalizedUnit, logId, userId];
        }

        const result = await pgDb.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado o no autorizado' });
        }

        res.json({ success: true, data: result.rows[0] });

    } catch (err) {
        console.error('Error updating log:', err);
        res.status(500).json({ error: 'Error al actualizar el registro' });
    }
});

// 4. Delete Meal Log
router.delete('/:id', async (req, res) => {
    try {
        const logId = Number(req.params.id);
        const userId = req.user.id;

        if (!Number.isInteger(logId) || logId <= 0) {
            return res.status(400).json({ error: 'ID de registro inválido' });
        }

        const sql = `DELETE FROM logs WHERE id = $1 AND user_id = $2 RETURNING id`;
        const result = await pgDb.query(sql, [logId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado o no autorizado' });
        }

        res.json({ success: true, message: 'Registro eliminado', id: logId });

    } catch (err) {
        console.error('Error deleting log:', err);
        res.status(500).json({ error: 'Error al eliminar el registro' });
    }
});

module.exports = router;
