const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'control@reyescomputing.com';
const FROM_EMAIL  = process.env.FROM_EMAIL  || 'Powerbud <onboarding@resend.dev>';
const API_BASE    = process.env.API_BASE_URL || process.env.RENDER_EXTERNAL_URL || 'https://powerbud-api.onrender.com';

async function deliverEmail(payload) {
    if (!resend) {
        console.warn(`[mailer] RESEND_API_KEY no configurada. Se omitió el correo: ${payload.subject}`);
        return { skipped: true };
    }
    console.log(`[mailer] Enviando email → to:${payload.to} from:${payload.from} subject:"${payload.subject}"`);
    const result = await resend.emails.send(payload);
    if (result.error) {
        console.error(`[mailer] Resend retornó error → ${JSON.stringify(result.error)}`);
        throw new Error(result.error.message || 'Error al enviar el correo (Resend)');
    }
    console.log(`[mailer] Email enviado OK → id:${result.data?.id}`);
    return result;
}

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

    await deliverEmail({
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

    await deliverEmail({
        from: FROM_EMAIL,
        to: userEmail,
        subject,
        html
    });
}

module.exports = { sendCertificateApprovalEmail, sendVerificationResultEmail, sendWelcomeEmail, sendEmailVerification, sendPasswordReset };

/**
 * Envía email con enlace para resetear la contraseña (expira en 1h).
 */
async function sendPasswordReset({ userEmail, userName, resetToken }) {
    const resetUrl = `${API_BASE}/api/v2/auth/reset-password-page?token=${resetToken}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;padding:20px;">
<div style="background:#1a1a2e;color:#e2e8f0;border-radius:12px;padding:36px;max-width:520px;margin:auto;">
  <h1 style="color:#f59e0b;font-size:26px;">Restablecer contraseña 🔐</h1>
  <p>Hola <strong>${userName}</strong>, recibimos una solicitud para restablecer la contraseña de tu cuenta en Powerbud.</p>
  <p>Este enlace es válido por <strong>1 hora</strong>. Si no lo solicitaste, ignora este mensaje.</p>
  <p style="text-align:center;margin:32px 0;">
    <a href="${resetUrl}" style="background:#f59e0b;color:#0f0f1a;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;text-decoration:none;">
      🔑 Restablecer contraseña
    </a>
  </p>
  <p style="color:#64748b;font-size:13px;">Si no pediste esto, tu cuenta está segura.</p>
</div>
</body>
</html>`;

    await deliverEmail({
        from: FROM_EMAIL,
        to: userEmail,
        subject: '[Powerbud] Restablecer tu contraseña',
        html
    });
}

/**
 * Envía email de verificación de cuenta (link expira en 24h).
 */
async function sendEmailVerification({ userEmail, userName, verifyToken }) {
    const verifyUrl = `${API_BASE}/api/v2/auth/verify-email?token=${verifyToken}`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;padding:20px;">
<div style="background:#1a1a2e;color:#e2e8f0;border-radius:12px;padding:36px;max-width:520px;margin:auto;">
  <h1 style="color:#4ade80;font-size:26px;">Verifica tu correo 📧</h1>
  <p>Hola <strong>${userName}</strong>, gracias por registrarte en <strong>Powerbud</strong>.</p>
  <p>Tienes <strong>24 horas</strong> para verificar tu correo. Si no lo haces, tu cuenta será suspendida.</p>
  <p style="text-align:center;margin:32px 0;">
    <a href="${verifyUrl}" style="background:#4ade80;color:#0f0f1a;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;text-decoration:none;">
      ✅ Verificar mi correo
    </a>
  </p>
  <p style="color:#64748b;font-size:13px;">Si no creaste esta cuenta, ignora este mensaje.</p>
</div>
</body>
</html>`;

    return deliverEmail({
        from: FROM_EMAIL,
        to: userEmail,
        subject: '[Powerbud] Verifica tu correo electrónico',
        html
    });
}

/**
 * Envía email de bienvenida/confirmación al nuevo usuario.
 */
async function sendWelcomeEmail({ userEmail, userName, role }) {
    const roleLabels = { trainer: 'Entrenador', nutritionist: 'Nutricionista', client: 'Cliente' };
    const roleLabel = roleLabels[role] || 'Usuario';

    const extraNote = (role === 'trainer' || role === 'nutritionist')
        ? `<p style="background:#1e293b;border-left:4px solid #6366f1;padding:12px 16px;border-radius:4px;">
            Para activar tu cuenta debes subir tu <strong>certificado profesional</strong> desde la app. 
            Lo revisaremos y te notificaremos por este correo.
           </p>`
        : `<p>Ya puedes buscar entrenadores y nutricionistas, registrar tus comidas y hacer seguimiento de tu progreso.</p>`;

    const html = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;padding:20px;">
<div style="background:#1a1a2e;color:#e2e8f0;border-radius:12px;padding:36px;max-width:520px;margin:auto;">
  <h1 style="color:#4ade80;font-size:28px;margin-bottom:4px;">¡Bienvenido a Powerbud! 💪</h1>
  <p style="color:#94a3b8;margin-top:0;">Tu cuenta fue creada exitosamente</p>
  <hr style="border:none;border-top:1px solid #2d2d44;margin:20px 0;"/>
  <p>Hola <strong>${userName}</strong>,</p>
  <p>Tu cuenta como <strong>${roleLabel}</strong> ya está activa en Powerbud.</p>
  ${extraNote}
  <p style="color:#64748b;font-size:13px;margin-top:32px;">El equipo de Powerbud</p>
</div>
</body>
</html>`;

    await deliverEmail({
        from: FROM_EMAIL,
        to: userEmail,
        subject: '¡Bienvenido a Powerbud! Tu cuenta fue creada',
        html
    });
}
