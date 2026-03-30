const express = require('express');
const pgDb = require('../pg-database');
const { authenticateToken, requireRole } = require('../auth');

const router = express.Router();

// Middleware base: Todas las rutas aquí requieren autenticación
router.use(authenticateToken);

// ==========================================
// FLUJO DEL ENTRENADOR (El que invita)
// ==========================================

// 1. Enviar una invitación a un cliente por email
router.post('/invite', requireRole('trainer'), async (req, res) => {
    try {
        const { clientEmail } = req.body;
        const trainerId = req.user.id;

        if (!clientEmail) {
            return res.status(400).json({ error: 'Debes proporcionar el email del cliente a invitar' });
        }

        // Buscar si el cliente ya existe en la app
        const clientRes = await pgDb.query(`SELECT id, role FROM users WHERE email = $1`, [clientEmail]);

        if (clientRes.rows.length === 0) {
            return res.status(404).json({ error: 'El cliente no está registrado en Powerbud aún' });
        }

        const client = clientRes.rows[0];

        if (client.role === 'trainer') {
            return res.status(400).json({ error: 'No puedes invitar a otro entrenador a ser tu cliente' });
        }

        // Verificar si ya existe una relación (activa o pendiente)
        const relRes = await pgDb.query(`
            SELECT status FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2
        `, [trainerId, client.id]);

        if (relRes.rows.length > 0) {
            const currentStatus = relRes.rows[0].status;
            if (currentStatus === 'active') {
                return res.status(400).json({ error: 'Este usuario ya es tu cliente activo' });
            } else if (currentStatus === 'pending') {
                return res.status(400).json({ error: 'Ya has enviado una invitación a este cliente. Espera a que la acepte' });
            } else {
                // Si estaba inactivo (inactive), la actualizamos a pendiente de nuevo
                await pgDb.query(`
                    UPDATE trainer_clients SET status = 'pending', assigned_at = CURRENT_TIMESTAMP
                    WHERE trainer_id = $1 AND client_id = $2
                `, [trainerId, client.id]);
                return res.json({ success: true, message: 'Invitación reenviada exitosamente' });
            }
        }

        // Crear la relación inicial como "pendiente"
        await pgDb.query(`
            INSERT INTO trainer_clients (trainer_id, client_id, status)
            VALUES ($1, $2, 'pending')
        `, [trainerId, client.id]);

        res.status(201).json({ success: true, message: 'Invitación enviada. El cliente debe aceptarla en su aplicación.' });

    } catch (err) {
        console.error('Error inviting client:', err);
        res.status(500).json({ error: 'Error al enviar la invitación' });
    }
});

// ==========================================
// FLUJO DEL CLIENTE (El que acepta/rechaza)
// ==========================================

// 2. Ver invitaciones pendientes (El cliente abre su app y ve quién lo quiere entrenar)
router.get('/invitations', async (req, res) => {
    try {
        const clientId = req.user.id;

        // Mostrar todas las solicitudes pendientes hacia este cliente, con el email del entrenador
        const sql = `
            SELECT t.id as trainer_id, t.email as trainer_email, tc.assigned_at as invited_at
            FROM trainer_clients tc
            JOIN users t ON tc.trainer_id = t.id
            WHERE tc.client_id = $1 AND tc.status = 'pending'
            ORDER BY tc.assigned_at DESC
        `;

        const result = await pgDb.query(sql, [clientId]);
        res.json(result.rows);

    } catch (err) {
        console.error('Error fetching invitations:', err);
        res.status(500).json({ error: 'Error al obtener tus invitaciones' });
    }
});

// 3. Aceptar una invitación (El cliente da permiso)
router.post('/invitations/:trainerId/accept', async (req, res) => {
    try {
        const trainerId = Number(req.params.trainerId);
        const clientId = req.user.id;

        // Actualizamos a estado activo (darle poder al entrenador sobre sus datos)
        const sql = `
            UPDATE trainer_clients
            SET status = 'active'
            WHERE trainer_id = $1 AND client_id = $2 AND status = 'pending'
            RETURNING *
        `;

        const result = await pgDb.query(sql, [trainerId, clientId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No tienes una invitación pendiente de este entrenador' });
        }

        res.json({ success: true, message: 'Has aceptado al entrenador. Ahora tiene acceso para asignarte rutinas y ver tus progresos.' });

    } catch (err) {
        console.error('Error accepting invitation:', err);
        res.status(500).json({ error: 'Error al aceptar la invitación' });
    }
});

// 4. Rechazar una invitación o Despedir al entrenador
router.post('/invitations/:trainerId/reject', async (req, res) => {
    try {
        const trainerId = Number(req.params.trainerId);
        const clientId = req.user.id;

        // Lo pasamos a estado inactivo (le quita los permisos)
        const sql = `
            UPDATE trainer_clients
            SET status = 'inactive'
            WHERE trainer_id = $1 AND client_id = $2
            RETURNING *
        `;

        const result = await pgDb.query(sql, [trainerId, clientId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No tienes relación con este entrenador' });
        }

        res.json({ success: true, message: 'Entrenador rechazado/desactivado correctamente.' });

    } catch (err) {
        console.error('Error rejecting invitation:', err);
        res.status(500).json({ error: 'Error al rechazar al entrenador' });
    }
});

module.exports = router;
