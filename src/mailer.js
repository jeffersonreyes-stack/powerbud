const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'control@reyescomputing.com';
const FROM_EMAIL  = process.env.FROM_EMAIL  || 'Powerbud App <noreply@reyescomputing.com>';
const API_BASE    = process.env.API_BASE_URL || 'https://powerbud-api.onrender.com';

/**
 * Envía email al administrador para aprobar/rechazar un certificado.
 * @param {object} params
 * @param {number} params.userId
 * @param {string} params.userName
 * @param {string} params.userEmail
 * @param {string} params.role - 'trainer' | 'nutritionist'
 * @param {string} params.certificateUrl
 * @param {string} params.approveToken - JWT firmado para aprobar
 * @param {string} params.rejectToken  - JWT firmado para rechazar
 */
async function sendCertificateApprovalEmail({ userId, userName, userEmail, role, certificateUrl, approveToken, rejectToken }) {
    const roleLabel = role === 'nutritionist' ? 'Nutricionista' : 'Entrenador';
    const approveUrl = `${API_BASE}/api/v2/admin/verify-trainer?token=${approveToken}`;
    const rejectUrl  = `${API_BASE}/api/v2/admin/verify-trainer?token=${rejectToken}`;

    const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(certificateUrl);

    const certBlock = isImage
        ? `<p><a href="${certificateUrl}" target="_blank"><img src="${certificateUrl}" alt="Certificado" style="max-width:600px;border:1px solid #ddd;border-radius:4px;" /></a></p>`
        : `<p><a href="${certificateUrl}" target="_blank" style="font-size:16px;">📄 Ver certificado (PDF)</a></p>`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;}
.card{background:#fff;border-radius:8px;padding:30px;max-width:640px;margin:auto;box-shadow:0 2px 8px rgba(0,0,0,.1);}
h2{color:#1a1a2e;}
.btn{display:inline-block;padding:14px 28px;border-radius:6px;font-size:16px;font-weight:bold;text-decoration:none;margin:8px 4px;}
.approve{background:#22c55e;color:#fff;}
.reject{background:#ef4444;color:#fff;}
.info{background:#f8fafc;border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;margin:16px 0;}
</style></head>
<body>
<div class="card">
  <h2>🏋️ Revisión de Certificado — Powerbud</h2>
  <div class="info">
    <strong>Nombre:</strong> ${userName}<br/>
    <strong>Email:</strong> ${userEmail}<br/>
    <strong>Rol:</strong> ${roleLabel}<br/>
    <strong>ID:</strong> ${userId}
  </div>
  <p>Este ${roleLabel.toLowerCase()} ha subido su certificado y está esperando verificación:</p>
  ${certBlock}
  <p>
    <a href="${approveUrl}" class="btn approve">✅ Aprobar cuenta</a>
    <a href="${rejectUrl}"  class="btn reject">❌ Rechazar cuenta</a>
  </p>
  <p style="color:#888;font-size:12px;">Los links expiran en 7 días. Si ya tomaste acción, ignora este correo.</p>
</div>
</body>
</html>`;

    await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_EMAIL,
        subject: `[Powerbud] Verificar certificado — ${roleLabel}: ${userName}`,
        html
    });
}

/**
 * Notifica al entrenador/nutricionista el resultado de la verificación.
 */
async function sendVerificationResultEmail({ userEmail, userName, role, approved }) {
    const roleLabel = role === 'nutritionist' ? 'Nutricionista' : 'Entrenador';
    const subject = approved
        ? '[Powerbud] ✅ Tu cuenta fue verificada'
        : '[Powerbud] ❌ Tu certificado fue rechazado';

    const body = approved
        ? `<p>¡Felicidades <strong>${userName}</strong>! Tu certificado fue aprobado. Ya puedes empezar a trabajar con clientes en Powerbud.</p>`
        : `<p>Hola <strong>${userName}</strong>, lamentablemente tu certificado no pudo ser verificado. Por favor sube un documento válido desde la app e inténtalo de nuevo.</p>`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;padding:20px;background:#f4f4f4;">
<div style="background:#fff;border-radius:8px;padding:30px;max-width:520px;margin:auto;">
  <h2 style="color:#1a1a2e;">${subject}</h2>
  ${body}
  <p style="color:#888;font-size:13px;">El equipo de Powerbud</p>
</div>
</body>
</html>`;

    await resend.emails.send({
        from: FROM_EMAIL,
        to: userEmail,
        subject,
        html
    });
}

module.exports = { sendCertificateApprovalEmail, sendVerificationResultEmail };
