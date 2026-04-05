const express = require('express');
const pgDb = require('../pg-database');
const { authenticateToken } = require('../auth');

const router = express.Router();

router.use(authenticateToken);

// Helper exportable para crear notificación desde otros módulos
async function createNotification({ userId, senderId = null, type = 'system', title, body }) {
    await pgDb.query(
        `INSERT INTO notifications (user_id, sender_id, type, title, body)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, senderId, type, title, body]
    );
}

// GET /api/v2/notifications — listar notificaciones del usuario autenticado
router.get('/', async (req, res) => {
    try {
        const result = await pgDb.query(
            `SELECT n.*, u.name AS sender_name, u.email AS sender_email, u.role AS sender_role
             FROM notifications n
             LEFT JOIN users u ON n.sender_id = u.id
             WHERE n.user_id = $1
             ORDER BY n.created_at DESC
             LIMIT 50`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching notifications:', err);
        res.status(500).json({ error: 'Error al obtener notificaciones' });
    }
});

// GET /api/v2/notifications/unread-count
router.get('/unread-count', async (req, res) => {
    try {
        const result = await pgDb.query(
            `SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND read = FALSE`,
            [req.user.id]
        );
        res.json({ count: Number(result.rows[0].count) });
    } catch (err) {
        res.status(500).json({ error: 'Error al contar notificaciones' });
    }
});

// PUT /api/v2/notifications/:id/read — marcar como leída
router.put('/:id/read', async (req, res) => {
    try {
        const id = Number(req.params.id);
        await pgDb.query(
            `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al marcar notificación' });
    }
});

// PUT /api/v2/notifications/read-all — marcar todas como leídas
router.put('/read-all', async (req, res) => {
    try {
        await pgDb.query(
            `UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`,
            [req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al marcar notificaciones' });
    }
});

// DELETE /api/v2/notifications/:id
router.delete('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        await pgDb.query(
            `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
            [id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Error al eliminar notificación' });
    }
});

// POST /api/v2/notifications/send — entrenador/nutricionista envía mensaje manual a cliente
router.post('/send', async (req, res) => {
    try {
        const senderRole = req.user.role;
        if (!['trainer', 'nutritionist'].includes(senderRole)) {
            return res.status(403).json({ error: 'Solo entrenadores y nutricionistas pueden enviar notificaciones' });
        }

        const { client_id, title, body } = req.body;
        if (!client_id || !title || !body) {
            return res.status(400).json({ error: 'client_id, title y body son obligatorios' });
        }

        // Verificar relación activa
        const relCheck = await pgDb.query(
            `SELECT status FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2`,
            [req.user.id, client_id]
        );
        if (relCheck.rows.length === 0 || relCheck.rows[0].status !== 'active') {
            return res.status(403).json({ error: 'No tienes permiso para enviar mensajes a este cliente' });
        }

        const type = senderRole === 'nutritionist' ? 'nutritionist' : 'trainer';
        await createNotification({ userId: client_id, senderId: req.user.id, type, title, body });

        res.status(201).json({ success: true });
    } catch (err) {
        console.error('Error enviando notificación:', err);
        res.status(500).json({ error: 'Error al enviar notificación' });
    }
});

module.exports = router;
module.exports.createNotification = createNotification;
