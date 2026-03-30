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
        const role = req.user.role;
        const requestedClientId = req.query.client_id; // Si un entrenador quiere ver a su cliente
        const exercise = req.query.exercise;

        let targetClientId = userId; // Por defecto, el usuario se ve a sí mismo

        // Si es entrenador y pide ver a un cliente específico, verificamos que tenga permiso
        if (role === 'trainer' && requestedClientId) {
            const relCheck = await pgDb.query(`
                SELECT status FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2
            `, [userId, requestedClientId]);

            if (relCheck.rows.length === 0 || relCheck.rows[0].status !== 'active') {
                return res.status(403).json({ error: 'No tienes permisos para ver las rutinas de este cliente (Relación inactiva o inexistente)' });
            }
            targetClientId = requestedClientId;
        }

        let sql = `SELECT * FROM workouts WHERE client_id = $1 ORDER BY date DESC`;
        let params = [targetClientId];

        if (exercise) {
            sql = `SELECT * FROM workouts WHERE client_id = $1 AND exercise ILIKE $2 ORDER BY date DESC`;
            params = [targetClientId, `%${exercise}%`];
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
            INSERT INTO workouts (client_id, trainer_id, date, exercise, weight, reps, modified_by_client)
            VALUES ($1, $2, $3, $4, $5, $6, FALSE)
            RETURNING *`;

        const result = await pgDb.query(sql, [clientIdToInsert, trainerIdToInsert, date, exercise, weight, reps]);
        res.status(201).json(result.rows[0]);

    } catch (err) {
        console.error('Error logging workout:', err);
        res.status(500).json({ error: 'Error al registrar el entrenamiento' });
    }
});

// 3. Update Workout Set (Edición) - AQUÍ ESTÁ LA LÓGICA DE LA ETIQUETA
router.put('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { date, exercise, weight, reps } = req.body;
        const userRole = req.user.role;
        const userId = req.user.id;

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID inválido' });
        }

        // 1. Buscamos quién es el dueño original de esta rutina
        const workoutRes = await pgDb.query(`SELECT trainer_id, client_id, modified_by_client FROM workouts WHERE id = $1`, [id]);

        if (workoutRes.rows.length === 0) {
            return res.status(404).json({ error: 'Rutina no encontrada' });
        }

        const workout = workoutRes.rows[0];

        // 2. Reglas de edición y Flag de "Modificada por el Cliente"
        let modifiedByClientFlag = workout.modified_by_client; // Conservar el estado actual por defecto

        if (userRole === 'trainer') {
            if (workout.trainer_id !== userId) {
                return res.status(403).json({ error: 'Como entrenador solo puedes editar rutinas creadas por ti.' });
            }
            // Si el entrenador la edita, le quita la etiqueta de modificada por cliente porque el entrenador tomó el control de nuevo
            modifiedByClientFlag = false;

        } else if (userRole === 'client') {
            if (workout.client_id !== userId) {
                return res.status(403).json({ error: 'Solo puedes editar tus propias rutinas.' });
            }

            // Si el cliente edita la rutina y originalmente fue creada por un ENTRENADOR, encendemos la etiqueta de advertencia.
            if (workout.trainer_id !== null) {
                modifiedByClientFlag = true;
            }
            // Si fue creada por el mismo cliente desde cero, no hace falta advertir (modifiedByClientFlag se queda igual/falso)
        }

        const sql = `
            UPDATE workouts
            SET date = $1, exercise = $2, weight = $3, reps = $4, modified_by_client = $5
            WHERE id = $6
            RETURNING *
        `;

        const result = await pgDb.query(sql, [date, exercise, weight, reps, modifiedByClientFlag, id]);

        res.json({
            success: true,
            message: modifiedByClientFlag ? 'Rutina actualizada (marcada como personalizada por ti)' : 'Rutina actualizada',
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Error updating workout:', err);
        res.status(500).json({ error: 'Error al actualizar el entrenamiento' });
    }
});

// 4. Delete Workout Set
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
