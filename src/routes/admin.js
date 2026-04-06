const express = require('express');
const jwt = require('jsonwebtoken');
const pgDb = require('../pg-database');
const { sendVerificationResultEmail } = require('../mailer');
const { createNotification } = require('./notifications');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'powerbud-secret-key-dev-only';

// GET /api/v2/admin/verify-trainer?token=xxx
// Link de aprobación/rechazo enviado por email al admin.
// No requiere autenticación — el token firmado garantiza la seguridad.
router.get('/verify-trainer', async (req, res) => {
    const { token } = req.query;

    if (!token) {
        return res.status(400).send(renderPage('Error', 'Token no proporcionado.', false));
    }

    let payload;
    try {
        payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return res.status(400).send(renderPage('Token inválido o expirado', 'El link ya fue usado o expiró. Pide al profesional que suba el certificado de nuevo.', false));
    }

    const { userId, action } = payload;

    if (!userId || !['approve', 'reject'].includes(action)) {
        return res.status(400).send(renderPage('Error', 'Acción no válida.', false));
    }

    try {
        // Verificar que el usuario existe y sigue en estado pending
        const userRes = await pgDb.query(
            'SELECT id, email, full_name, role, verification_status FROM users WHERE id = $1',
            [userId]
        );

        if (!userRes.rows.length) {
            return res.status(404).send(renderPage('Usuario no encontrado', `No existe el usuario con ID ${userId}.`, false));
        }

        const user = userRes.rows[0];

        if (user.verification_status !== 'pending') {
            const already = user.verification_status === 'verified' ? 'ya fue aprobada' : 'ya fue rechazada';
            return res.send(renderPage('Acción ya realizada', `La cuenta de ${user.full_name || user.email} ${already}.`, true));
        }

        const newStatus = action === 'approve' ? 'verified' : 'unverified';

        await pgDb.query(
            'UPDATE users SET verification_status = $1 WHERE id = $2',
            [newStatus, userId]
        );

        // Notificación interna en la app
        const notifMsg = action === 'approve'
            ? '✅ Tu certificado fue aprobado. ¡Ya puedes empezar a trabajar con clientes!'
            : '❌ Tu certificado fue rechazado. Por favor sube un documento válido e inténtalo de nuevo.';

        try {
            await createNotification(userId, notifMsg, 'verification');
        } catch (notifErr) {
            console.error('[admin] Error enviando notificación interna:', notifErr.message);
        }

        // Email al profesional
        try {
            await sendVerificationResultEmail({
                userEmail: user.email,
                userName: user.full_name || user.email,
                role: user.role,
                approved: action === 'approve'
            });
        } catch (mailErr) {
            console.error('[admin] Error enviando email al profesional:', mailErr.message);
        }

        const title  = action === 'approve' ? 'Cuenta aprobada ✅' : 'Cuenta rechazada ❌';
        const detail = action === 'approve'
            ? `La cuenta de <strong>${user.full_name || user.email}</strong> fue marcada como verificada.`
            : `La cuenta de <strong>${user.full_name || user.email}</strong> fue rechazada. El usuario recibirá un aviso.`;

        return res.send(renderPage(title, detail, true));

    } catch (err) {
        console.error('[admin] Error procesando verificación:', err);
        return res.status(500).send(renderPage('Error interno', 'Ocurrió un error inesperado. Revisa los logs del servidor.', false));
    }
});

function renderPage(title, message, success) {
    const color = success ? '#22c55e' : '#ef4444';
    const icon  = success ? '✅' : '❌';
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Powerbud — ${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f0f1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #1a1a2e; color: #e2e8f0; border-radius: 12px; padding: 40px; max-width: 480px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,.4); }
    h1 { color: ${color}; font-size: 24px; margin-bottom: 12px; }
    p { font-size: 16px; color: #94a3b8; line-height: 1.6; }
    .icon { font-size: 56px; margin-bottom: 16px; }
    .brand { color: #6366f1; font-weight: bold; font-size: 14px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="brand">Powerbud — Panel de Administración</p>
  </div>
</body>
</html>`;
}

module.exports = router;
