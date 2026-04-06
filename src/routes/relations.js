const express = require('express');
const pgDb = require('../pg-database');
const { authenticateToken, requireRole } = require('../auth');

const router = express.Router();

// Middleware base: Todas las rutas aquí requieren autenticación
router.use(authenticateToken);

// ==========================================
// FLUJO DEL ENTRENADOR (El que invita)
// ==========================================

// 0. Ver todos mis clientes (Entrenador)
router.get('/trainer/clients', async (req, res) => {
    if (req.user.role !== 'trainer' && req.user.role !== 'nutritionist') {
        return res.status(403).json({ error: 'Acceso denegado.' });
    }
    try {
        const sql = `
            SELECT tc.client_id, u.email, u.name, tc.status, tc.assigned_at,
                   COALESCE(tc.payment_status, 'pending') as payment_status, tc.payment_updated_at
            FROM trainer_clients tc
            JOIN users u ON tc.client_id = u.id
            WHERE tc.trainer_id = $1
            ORDER BY tc.assigned_at DESC
        `;
        const result = await pgDb.query(sql, [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching clients:', err);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// 1. Enviar una invitación a un cliente por email (Solo Entrenadores VERIFICADOS)
router.post('/invite', requireRole('trainer'), async (req, res) => {
    try {
        const { clientEmail } = req.body;
        const trainerId = req.user.id;

        // Comprobar estado de verificación del entrenador
        const statusRes = await pgDb.query(`SELECT verification_status FROM users WHERE id = $1`, [trainerId]);
        if (statusRes.rows[0].verification_status !== 'verified') {
            return res.status(403).json({ error: 'Para invitar clientes debes subir tu certificado de educación y ser aprobado por el administrador.' });
        }

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

// 2.5 Ver entrenadores actuales (Activos o Inactivos) para poder calificarlos
router.get('/my-trainers', async (req, res) => {
    try {
        const clientId = req.user.id;

        const sql = `
            SELECT t.id as trainer_id, t.email as trainer_email, tc.status, tc.assigned_at
            FROM trainer_clients tc
            JOIN users t ON tc.trainer_id = t.id
            WHERE tc.client_id = $1 AND tc.status != 'pending'
            ORDER BY tc.assigned_at DESC
        `;

        const result = await pgDb.query(sql, [clientId]);
        res.json(result.rows);

    } catch (err) {
        console.error('Error fetching trainers:', err);
        res.status(500).json({ error: 'Error al obtener tus entrenadores' });
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

// 5. Marcar pago de un cliente (solo entrenador/nutricionista — toggle paid/pending)
router.post('/clients/:clientId/payment', async (req, res) => {
    try {
        const trainerId = req.user.id;
        const clientId  = Number(req.params.clientId);

        if (req.user.role !== 'trainer' && req.user.role !== 'nutritionist') {
            return res.status(403).json({ error: 'Solo entrenadores y nutricionistas pueden gestionar pagos.' });
        }

        // Verificar que existe la relación activa
        const rel = await pgDb.query(
            'SELECT payment_status FROM trainer_clients WHERE trainer_id = $1 AND client_id = $2 AND status = $3',
            [trainerId, clientId, 'active']
        );

        if (!rel.rows.length) {
            return res.status(404).json({ error: 'No tienes un cliente activo con ese ID.' });
        }

        // Toggle: pending → paid, paid → pending
        const newStatus = rel.rows[0].payment_status === 'paid' ? 'pending' : 'paid';

        await pgDb.query(
            'UPDATE trainer_clients SET payment_status = $1, payment_updated_at = NOW() WHERE trainer_id = $2 AND client_id = $3',
            [newStatus, trainerId, clientId]
        );

        res.json({ success: true, payment_status: newStatus });
    } catch (err) {
        console.error('Error updating payment:', err);
        res.status(500).json({ error: 'Error al actualizar el pago.' });
    }
});

module.exports = router;
