const express = require('express');
const pgDb = require('../pg-database');
const { authenticateToken, requireRole } = require('../auth');

const router = express.Router();

// Middleware: Todas las rutas de Workouts requieren autenticación
router.use(authenticateToken);

// 1. Get Workout History (Cliente ve su historial o rutina asignada)
// También un entrenador podría ver la rutina si pasamos un client_id, pero simplificaremos para que el usuario autenticado vea lo suyo.
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const exercise = req.query.exercise; // Opcional para filtrar un ejercicio específico

        let sql = `SELECT * FROM workouts WHERE client_id = $1 ORDER BY date ASC`;
        let params = [userId];

        if (exercise) {
            sql = `SELECT * FROM workouts WHERE client_id = $1 AND exercise ILIKE $2 ORDER BY date ASC`;
            params = [userId, `%${exercise}%`];
        }

        const result = await pgDb.query(sql, params);
        res.json(result.rows);

    } catch (err) {
        console.error('Error fetching workouts:', err);
        res.status(500).json({ error: 'Error al obtener el historial de entrenamiento' });
    }
});

// 2. Log a Workout Set (El cliente registra lo que hizo, o el entrenador se lo asigna)
router.post('/', async (req, res) => {
    try {
        const { date, exercise, weight, reps, client_id } = req.body;

        let clientIdToInsert;
        let trainerIdToInsert = null;

        // Si el usuario es un entrenador, está asignando/registrando esto para un cliente
        if (req.user.role === 'trainer') {
            if (!client_id) {
                return res.status(400).json({ error: 'Debes especificar el client_id al que le asignas el ejercicio' });
            }
            // Verificar que exista la relación
            const relCheck = await pgDb.query(`SELECT status FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2`, [req.user.id, client_id]);
            if (relCheck.rows.length === 0 || relCheck.rows[0].status !== 'active') {
                return res.status(403).json({ error: 'No tienes permisos para asignar rutinas a este cliente o la relación no está activa' });
            }
            clientIdToInsert = client_id;
            trainerIdToInsert = req.user.id; // Queda guardado qué entrenador lo creó
        } else {
            // Es un cliente registrando su propio progreso
            clientIdToInsert = req.user.id;
        }

        if (!date || !exercise || !Number.isFinite(Number(weight)) || !Number.isInteger(Number(reps))) {
            return res.status(400).json({ error: 'Datos de entrenamiento inválidos' });
        }

        const sql = `
            INSERT INTO workouts (client_id, trainer_id, date, exercise, weight, reps)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`;

        const result = await pgDb.query(sql, [clientIdToInsert, trainerIdToInsert, date, exercise, weight, reps]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('Error logging workout:', err);
        res.status(500).json({ error: 'Error al registrar el entrenamiento' });
    }
});

// 3. Delete Workout Set
router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const userId = req.user.id;
        const role = req.user.role;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID inválido' });
        }

        let sql;
        let params;

        if (role === 'trainer') {
            // Un entrenador puede borrar rutinas que él haya asignado
            sql = `DELETE FROM workouts WHERE id = $1 AND trainer_id = $2 RETURNING id`;
            params = [id, userId];
        } else {
            // Un cliente puede borrar lo que haya registrado (siempre y cuando le pertenezca a él)
            sql = `DELETE FROM workouts WHERE id = $1 AND client_id = $2 RETURNING id`;
            params = [id, userId];
        }

        const result = await pgDb.query(sql, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Registro no encontrado o no tienes permiso para eliminarlo' });
        }

        res.json({ success: true, message: 'Entrenamiento eliminado' });

    } catch (err) {
        console.error('Error deleting workout:', err);
        res.status(500).json({ error: 'Error al eliminar el entrenamiento' });
    }
});

module.exports = router;
