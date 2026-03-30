const express = require('express');
const pgDb = require('../pg-database');
const { authenticateToken } = require('../auth');

const router = express.Router();

router.use(authenticateToken);

// 1. Obtener todas las reseñas de un entrenador
router.get('/:trainerId', async (req, res) => {
    try {
        const trainerId = Number(req.params.trainerId);

        if (!Number.isInteger(trainerId) || trainerId <= 0) {
            return res.status(400).json({ error: 'ID de entrenador inválido' });
        }

        // Obtener el promedio de estrellas y la lista de comentarios
        const avgRes = await pgDb.query(`
            SELECT ROUND(AVG(rating), 1) as average_rating, COUNT(id) as total_reviews
            FROM trainer_reviews WHERE trainer_id = $1
        `, [trainerId]);

        const reviewsRes = await pgDb.query(`
            SELECT r.id, r.rating, r.comment, r.created_at, u.email as client_email
            FROM trainer_reviews r
            JOIN users u ON r.client_id = u.id
            WHERE r.trainer_id = $1
            ORDER BY r.created_at DESC
        `, [trainerId]);

        res.json({
            stats: avgRes.rows[0],
            reviews: reviewsRes.rows
        });

    } catch (err) {
        console.error('Error fetching reviews:', err);
        res.status(500).json({ error: 'Error al obtener las reseñas del entrenador' });
    }
});

// 2. Crear o Actualizar una reseña (Upsert) - Solo clientes pueden hacerlo
router.post('/', async (req, res) => {
    try {
        const { trainer_id, rating, comment } = req.body;
        const clientId = req.user.id;

        // Validaciones
        if (req.user.role !== 'client') {
            return res.status(403).json({ error: 'Solo los atletas pueden calificar a los entrenadores' });
        }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'La calificación debe ser un número entero entre 1 y 5' });
        }

        // Verificar que realmente es o fue su entrenador (para evitar SPAM o reseñas falsas)
        const relCheck = await pgDb.query(`
            SELECT status FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2
        `, [trainer_id, clientId]);

        if (relCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Solo puedes calificar a un entrenador que te haya asesorado' });
        }

        // Insertar o actualizar reseña (UPSERT por la restricción UNIQUE)
        const sql = `
            INSERT INTO trainer_reviews (trainer_id, client_id, rating, comment)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (trainer_id, client_id)
            DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await pgDb.query(sql, [trainer_id, clientId, rating, comment || null]);

        res.status(201).json({
            success: true,
            message: 'Reseña guardada exitosamente. ¡Gracias por tu opinión!',
            data: result.rows[0]
        });

    } catch (err) {
        console.error('Error posting review:', err);
        res.status(500).json({ error: 'Error al guardar la calificación' });
    }
});

// 3. Eliminar la reseña que el cliente dejó
router.delete('/:trainerId', async (req, res) => {
    try {
        const trainerId = Number(req.params.trainerId);
        const clientId = req.user.id;

        const result = await pgDb.query(`
            DELETE FROM trainer_reviews
            WHERE trainer_id = $1 AND client_id = $2
            RETURNING id
        `, [trainerId, clientId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No se encontró una reseña tuya para este entrenador' });
        }

        res.json({ success: true, message: 'Reseña eliminada correctamente' });

    } catch (err) {
        console.error('Error deleting review:', err);
        res.status(500).json({ error: 'Error al eliminar la reseña' });
    }
});

module.exports = router;
