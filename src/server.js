require('dotenv').config(); // <-- CARGAR VARIABLES DE ENTORNO PRIMERO
const express = require('express');
const bodyParser = require('body-parser');
const pgDb = require('./pg-database'); // <--- NUEVA BASE DE DATOS
const { authController, authenticateToken, requireRole } = require('./auth'); // <--- AUTENTICACIÓN
const aiService = require('./ai'); // <--- IA DE GEMINI
const path = require('path');
const os = require('os');

// RUTAS v2 (MIGRACIÓN A POSTGRESQL)
const foodsRoutes = require('./routes/foods');
const logsRoutes = require('./routes/logs');
const notificationsRoutes = require('./routes/notifications');
const { createNotification } = require('./routes/notifications');
const metricsRoutes = require('./routes/metrics');
const workoutsRoutes = require('./routes/workouts');
const relationsRoutes = require('./routes/relations');
const reviewsRoutes = require('./routes/reviews');
const uploadRoutes = require('./routes/upload');
const adminRoutes = require('./routes/admin');

// Mantenemos vivo el backend antiguo para que las rutas no se rompan
const db = require('./database');
require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;

// Inicializa PostgreSQL al arrancar el servidor
pgDb.initDb().catch(console.error);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

function parseLocaleNumber(value) {
    if (typeof value === 'string') {
        return Number(value.replace(',', '.').trim());
    }
    return Number(value);
}

function getNetworkUrl(port) {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return `http://${net.address}:${port}`;
      }
    }
  }
  return null;
}

// --- API ROUTES ---

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'powerbud-api' });
});

// -- RUTAS DE AUTENTICACIÓN Y USUARIOS (NUEVAS) --
app.post('/api/auth/register', authController.register);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/resend-verification', authController.resendVerification);

// Reset de contraseña — paso 1: solicitar enlace
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email requerido.' });

  try {
    const result = await pgDb.query('SELECT id, name, email FROM users WHERE email = $1', [email]);
    // Siempre respondemos igual para no revelar si el email existe
    if (!result.rows.length) {
      return res.json({ message: 'Si ese correo está registrado, recibirás un enlace en breve.' });
    }
    const user = result.rows[0];
    const jwtLib = require('jsonwebtoken');
    const secret = process.env.JWT_SECRET || 'powerbud-secret-key-dev-only';
    const resetToken = jwtLib.sign({ userId: user.id, purpose: 'password_reset' }, secret, { expiresIn: '1h' });

    const { sendPasswordReset } = require('./mailer');
    await sendPasswordReset({ userEmail: user.email, userName: user.name || user.email, resetToken });

    res.json({ message: 'Si ese correo está registrado, recibirás un enlace en breve.' });
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ error: 'Error interno.' });
  }
});

// Reset de contraseña — paso 2a: página HTML con formulario
app.get('/api/v2/auth/reset-password-page', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('<p>Token inválido.</p>');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Powerbud — Nueva contraseña</title></head>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<div style="background:#1a1a2e;color:#e2e8f0;border-radius:12px;padding:40px;max-width:400px;width:90%;">
  <h2 style="color:#f59e0b;">🔐 Nueva contraseña</h2>
  <form method="POST" action="/api/v2/auth/reset-password">
    <input type="hidden" name="token" value="${token}" />
    <label style="display:block;margin-bottom:8px;color:#94a3b8;">Nueva contraseña</label>
    <input type="password" name="password" required minlength="6"
      style="width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:16px;box-sizing:border-box;margin-bottom:16px;" />
    <label style="display:block;margin-bottom:8px;color:#94a3b8;">Confirmar contraseña</label>
    <input type="password" name="confirm" required minlength="6"
      style="width:100%;padding:12px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;font-size:16px;box-sizing:border-box;margin-bottom:24px;" />
    <button type="submit"
      style="width:100%;padding:14px;background:#f59e0b;color:#0f0f1a;border:none;border-radius:8px;font-size:16px;font-weight:bold;cursor:pointer;">
      Guardar nueva contraseña
    </button>
  </form>
</div>
</body></html>`);
});

// Reset de contraseña — paso 2b: procesar formulario
app.post('/api/v2/auth/reset-password', express.urlencoded({ extended: false }), async (req, res) => {
  const { token, password, confirm } = req.body || {};
  const fail = (msg) => res.status(400).send(`<!DOCTYPE html><html><body style="font-family:Arial;background:#0f0f1a;color:#ef4444;display:flex;align-items:center;justify-content:center;min-height:100vh;"><div style="text-align:center"><h2>${msg}</h2><a href="javascript:history.back()" style="color:#f59e0b;">← Volver</a></div></body></html>`);

  if (!token || !password || !confirm) return fail('Faltan campos.');
  if (password !== confirm) return fail('Las contraseñas no coinciden.');
  if (password.length < 6) return fail('La contraseña debe tener al menos 6 caracteres.');

  let payload;
  try {
    const jwtLib = require('jsonwebtoken');
    payload = jwtLib.verify(token, process.env.JWT_SECRET || 'powerbud-secret-key-dev-only');
  } catch {
    return fail('El enlace expiró o es inválido. Solicita uno nuevo desde la app.');
  }

  if (payload.purpose !== 'password_reset') return fail('Token no válido.');

  try {
    const bcryptLib = require('bcrypt');
    const hashed = await bcryptLib.hash(password, 10);
    await pgDb.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hashed, payload.userId]);
    res.send(`<!DOCTYPE html><html><body style="font-family:Arial;background:#0f0f1a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<div style="background:#1a1a2e;color:#e2e8f0;border-radius:12px;padding:40px;max-width:400px;text-align:center;">
  <div style="font-size:56px;">✅</div>
  <h2 style="color:#4ade80;">Contraseña actualizada</h2>
  <p style="color:#94a3b8;">Ya puedes iniciar sesión con tu nueva contraseña desde la app.</p>
  <p style="color:#6366f1;font-weight:bold;">Powerbud</p>
</div></body></html>`);
  } catch (err) {
    console.error('[reset-password]', err);
    return fail('Error interno. Intenta de nuevo.');
  }
});

// Verificación de email (link enviado al registrarse)
app.get('/api/v2/auth/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send(renderVerifyPage('Token no proporcionado', false));

  let payload;
  try {
    payload = require('jsonwebtoken').verify(token, process.env.JWT_SECRET || 'powerbud-secret-key-dev-only');
  } catch {
    return res.status(400).send(renderVerifyPage('El link expiró o es inválido. Por favor regístrate de nuevo.', false));
  }

  if (payload.purpose !== 'email_verify') {
    return res.status(400).send(renderVerifyPage('Token no válido.', false));
  }

  try {
    const result = await pgDb.query(
      'UPDATE users SET email_verified = TRUE WHERE id = $1 AND email_verified = FALSE RETURNING email, name',
      [payload.userId]
    );
    if (!result.rows.length) {
      return res.send(renderVerifyPage('Esta cuenta ya fue verificada anteriormente.', true));
    }
    return res.send(renderVerifyPage(`¡Listo! Tu correo <strong>${result.rows[0].email}</strong> fue verificado. Ya puedes iniciar sesión en Powerbud.`, true));
  } catch (err) {
    console.error('[verify-email]', err);
    return res.status(500).send(renderVerifyPage('Error interno. Intenta de nuevo.', false));
  }
});

function renderVerifyPage(message, success) {
  const color = success ? '#4ade80' : '#ef4444';
  const icon  = success ? '✅' : '❌';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Powerbud</title></head>
<body style="font-family:Arial,sans-serif;background:#0f0f1a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
<div style="background:#1a1a2e;color:#e2e8f0;border-radius:12px;padding:40px;max-width:480px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,.4);">
  <div style="font-size:56px;">${icon}</div>
  <h1 style="color:${color};">${success ? 'Correo verificado' : 'Error de verificación'}</h1>
  <p style="color:#94a3b8;">${message}</p>
  <p style="color:#6366f1;font-weight:bold;margin-top:24px;">Powerbud</p>
</div></body></html>`;
}

// Rutas protegidas de perfil (Cualquier usuario logueado)
app.get('/api/profile', authenticateToken, authController.getProfile);

// -- ENDPOINTS DE PERFIL INICIAL (ONBOARDING) --
app.get('/api/v2/user-profile', authenticateToken, async (req, res) => {
  try {
    const result = await pgDb.query('SELECT * FROM user_profiles WHERE user_id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.json(null);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error obteniendo perfil:', err);
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});

app.post('/api/v2/user-profile', authenticateToken, async (req, res) => {
  try {
    const { age, sex, activity_level, weight_kg, height_cm, waist_cm, neck_cm, experience_level, goal, injuries, specialty, availability, rate_info } = req.body;
    const userId = req.user.id;
    console.log(`[profile save] userId=${userId} goal=${goal} weight=${weight_kg} height=${height_cm} age=${age} sex=${sex}`);
    const sql = `
      INSERT INTO user_profiles (user_id, age, sex, activity_level, weight_kg, height_cm, waist_cm, neck_cm, experience_level, goal, injuries, specialty, availability, rate_info, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        age = EXCLUDED.age, sex = EXCLUDED.sex, activity_level = EXCLUDED.activity_level,
        weight_kg = EXCLUDED.weight_kg, height_cm = EXCLUDED.height_cm, waist_cm = EXCLUDED.waist_cm,
        neck_cm = EXCLUDED.neck_cm, experience_level = EXCLUDED.experience_level, goal = EXCLUDED.goal,
        injuries = EXCLUDED.injuries, specialty = EXCLUDED.specialty, availability = EXCLUDED.availability,
        rate_info = EXCLUDED.rate_info, updated_at = NOW()
      RETURNING *`;
    const result = await pgDb.query(sql, [userId, age, sex, activity_level, weight_kg, height_cm, waist_cm, neck_cm, experience_level, goal, injuries || null, specialty || null, availability || null, rate_info || null]);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error guardando perfil:', err);
    res.status(500).json({ error: err.message || 'Error al guardar el perfil' });
  }
});

// -- SERVICIOS DE INTELIGENCIA ARTIFICIAL (GEMINI) --
// ¡EL ENTRENADOR VIRTUAL!
// Ahora cualquier usuario (cliente o entrenador humano) puede pedirle a Gemini una rutina automática.
app.post('/api/v2/ai/generate-workout', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let clientProfile = {};

    // 1. Si es un CLIENTE NORMAL: Él no tiene que llenar nada extra.
    // Vamos a la base de datos y le armamos el perfil automáticamente leyendo sus métricas y metas.
    if (req.user.role === 'client') {
      // Leer perfil completo del onboarding
      const profileRes = await pgDb.query('SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1', [userId]);
      const profile = profileRes.rows.length > 0 ? profileRes.rows[0] : {};

      // Fallback: leer métricas si no hay perfil
      const metricsRes = await pgDb.query(`SELECT weight_kg, height_cm, notes FROM body_metrics WHERE user_id = $1 ORDER BY date DESC LIMIT 1`, [userId]);
      const metrics = metricsRes.rows.length > 0 ? metricsRes.rows[0] : {};

      clientProfile = {
        age: profile.age || 'No especificada',
        sex: profile.sex || 'No especificado',
        weight_kg: profile.weight_kg || metrics.weight_kg || 'No especificado',
        height_cm: profile.height_cm || metrics.height_cm || 'No especificada',
        waist_cm: profile.waist_cm || 'No especificada',
        neck_cm: profile.neck_cm || 'No especificado',
        activity_level: profile.activity_level || 'Moderado',
        goal: profile.goal || 'Mejora de la condición física',
        days_per_week: 3,
        experience_level: profile.experience_level || 'Principiante',
        injuries: profile.injuries || metrics.notes || 'Ninguna reportada'
      };
    }
    // 2. Si es un ENTRENADOR: Él sí manda el perfil personalizado de un cliente suyo por el body (req.body)
    let targetClientIdForTrainer = null;
    if (req.user.role === 'trainer') {

      // BLOQUEO: Entrenadores No Verificados no pueden usar la IA
      const statusRes = await pgDb.query(`SELECT verification_status FROM users WHERE id = $1`, [userId]);
      if (statusRes.rows[0].verification_status !== 'verified') {
        return res.status(403).json({ error: 'Tu cuenta de entrenador aún no ha sido verificada. Sube tu certificado para usar el Asistente Virtual.' });
      }

      if (!req.body.client_id) {
        return res.status(400).json({ error: 'Como entrenador, debes enviar el ID del cliente (client_id).' });
      }
      targetClientIdForTrainer = req.body.client_id;
      // Si el entrenador envía clientProfile, usarlo; sino, leerlo de la DB automáticamente
      if (req.body.clientProfile) {
        clientProfile = req.body.clientProfile;
      } else {
        const cProfileRes = await pgDb.query('SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1', [req.body.client_id]);
        const cp = cProfileRes.rows[0] || {};
        const cMetricsRes = await pgDb.query('SELECT weight_kg, height_cm, notes FROM body_metrics WHERE user_id = $1 ORDER BY date DESC LIMIT 1', [req.body.client_id]);
        const cm = cMetricsRes.rows[0] || {};
        clientProfile = {
          age: cp.age || 'No especificada',
          sex: cp.sex || 'No especificado',
          weight_kg: cp.weight_kg || cm.weight_kg || 'No especificado',
          height_cm: cp.height_cm || cm.height_cm || 'No especificada',
          waist_cm: cp.waist_cm || 'No especificada',
          neck_cm: cp.neck_cm || 'No especificado',
          activity_level: cp.activity_level || 'Moderado',
          goal: cp.goal || 'Mejora de la condición física',
          days_per_week: 3,
          experience_level: cp.experience_level || 'Principiante',
          injuries: cp.injuries || cm.notes || 'Ninguna reportada',
        };
      }
    }

    // Consultar historial de progreso del usuario para enriquecer el prompt
    const targetIdForProgress = req.user.role === 'trainer' ? (req.body.client_id || userId) : userId;
    const bodyMetricsRes = await pgDb.query(
      `SELECT date::text, weight_kg, sleep_hours, stress_level, notes FROM body_metrics WHERE user_id = $1 ORDER BY date ASC LIMIT 6`,
      [targetIdForProgress]
    );
    const exerciseProgressRes = await pgDb.query(
      `SELECT exercise, MAX(weight) as max_weight, COUNT(*) as sessions,
              MAX(date)::text as last_date
       FROM workouts WHERE client_id = $1
       GROUP BY exercise ORDER BY sessions DESC LIMIT 10`,
      [targetIdForProgress]
    );

    // ACWR para el prompt de rutina
    const acwrVolumeRes = await pgDb.query(
      `SELECT date::text, SUM(weight * reps * COALESCE(sets, 1)) as daily_volume
       FROM workouts WHERE client_id = $1 AND date >= CURRENT_DATE - INTERVAL '27 days'
       GROUP BY date ORDER BY date ASC`,
      [targetIdForProgress]
    );
    const acwrRows = acwrVolumeRes.rows;
    const acuteVol = acwrRows.filter(r => new Date(r.date) >= new Date(Date.now() - 7*86400000)).reduce((s,r) => s+Number(r.daily_volume),0);
    const chronicVol = acwrRows.reduce((s,r) => s+Number(r.daily_volume),0) / 4;
    const computedAcwr = chronicVol > 0 ? Math.round(acuteVol/chronicVol*100)/100 : null;
    const acwrZoneStr = computedAcwr === null ? 'sin datos' : computedAcwr < 0.8 ? 'subcarga' : computedAcwr <= 1.3 ? 'óptima' : computedAcwr <= 1.5 ? 'precaución' : 'sobreentrenamiento';

    // Sueño y estrés recientes
    const recoveryRow = await pgDb.query(
      `SELECT AVG(sleep_hours)::numeric(4,1) as avg_sleep, AVG(stress_level)::numeric(3,1) as avg_stress
       FROM body_metrics WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '6 days'
       AND (sleep_hours IS NOT NULL OR stress_level IS NOT NULL)`,
      [targetIdForProgress]
    );
    const recoveryStats = recoveryRow.rows[0];

    const progressData = {
      bodyMetrics: bodyMetricsRes.rows,
      exerciseProgress: exerciseProgressRes.rows.map(r => ({
        exercise: r.exercise, max_weight: r.max_weight, sessions: r.sessions, last_date: r.last_date
      })),
      recovery: {
        acwr: computedAcwr,
        acwr_zone: acwrZoneStr,
        avg_sleep: recoveryStats.avg_sleep ? Number(recoveryStats.avg_sleep) : null,
        avg_stress: recoveryStats.avg_stress ? Number(recoveryStats.avg_stress) : null,
      }
    };

    // Resolver trainerContext: especialista IA + instrucciones del entrenador
    const body = req.body || {};
    let trainerContext = {};
    if (req.user.role === 'trainer') {
      const tProfileRes = await pgDb.query('SELECT specialty, ai_specialist FROM user_profiles WHERE user_id = $1', [userId]);
      const tProfile = tProfileRes.rows[0] || {};
      const tUserRes = await pgDb.query('SELECT name, email FROM users WHERE id = $1', [userId]);
      trainerContext = {
        ai_specialist: tProfile.ai_specialist || null,
        trainer_instructions: body.trainer_instructions || null,
        trainer_name: tUserRes.rows[0]?.name || tUserRes.rows[0]?.email || null,
      };
    } else if (req.user.role === 'client') {
      // Cliente puede pasar instrucciones opcionales
      trainerContext = { trainer_instructions: body.trainer_instructions || null };
    }

    // Llamamos a PowerBud A.I. (Gemini) usando los datos recolectados
    console.log('Generando rutina PowerBud A.I. Objetivo:', clientProfile.goal, '| Especialista:', trainerContext.ai_specialist || 'auto');
    const workoutPlan = await aiService.generateWorkoutPlan(clientProfile, progressData, trainerContext);

    // El plan de IA se guarda SOLO en workout_plans como JSON.
    // La tabla workouts es exclusivamente para registros manuales del usuario.
    const saveToId = req.user.role === 'trainer' ? targetClientIdForTrainer : userId;
    await pgDb.query(
      'INSERT INTO workout_plans (user_id, plan_json) VALUES ($1, $2)',
      [saveToId, JSON.stringify(workoutPlan)]
    );

    // Notificación automática si el entrenador generó la rutina para un cliente
    if (req.user.role === 'trainer' && targetClientIdForTrainer) {
      try {
        const trainerRes = await pgDb.query('SELECT name, email FROM users WHERE id = $1', [userId]);
        const trainerName = trainerRes.rows[0]?.name || trainerRes.rows[0]?.email || 'Tu entrenador';
        await createNotification({
          userId: targetClientIdForTrainer,
          senderId: userId,
          type: 'trainer',
          title: '🏋️ Nueva rutina asignada',
          body: `${trainerName} ha generado y asignado una nueva rutina de entrenamiento personalizada para ti. ¡Revísala en la pestaña Rutinas!`,
        });
      } catch (notifErr) { console.error('Error notif workout:', notifErr); }
    }

    res.json({
      success: true,
      message: 'PowerBud A.I. ha generado tu rutina y la ha guardado en tu historial.',
      disclaimer: '⚠️ Esta rutina ha sido generada por inteligencia artificial con fines orientativos. No reemplaza el acompañamiento de un entrenador certificado. Para un plan profesional y supervisado, te recomendamos contactar a uno de los entrenadores disponibles en la app.',
      data: workoutPlan,
      profileUsed: clientProfile
    });

  } catch (error) {
    console.error('Error en PowerBud A.I.:', error);
    res.status(500).json({ error: 'Hubo un problema al contactar a la Inteligencia Artificial. Inténtalo más tarde.' });
  }
});

// Catálogo de especialistas IA disponibles (para dropdown en UI)
app.get('/api/v2/ai/specialists', authenticateToken, async (req, res) => {
  const { AI_SPECIALISTS } = require('./ai');
  const list = Object.entries(AI_SPECIALISTS).map(([key, val]) => ({
    key,
    label: val.label,
    methodology_summary: val.methodology.split('.')[0] + '.', // primera oración
  }));
  res.json(list);
});

// Guardar especialista IA seleccionado por el entrenador
app.post('/api/v2/trainer/ai-specialist', authenticateToken, async (req, res) => {
  if (req.user.role !== 'trainer' && req.user.role !== 'nutritionist') {
    return res.status(403).json({ error: 'Solo entrenadores pueden configurar esto' });
  }
  const { ai_specialist } = req.body;
  try {
    await pgDb.query(
      `UPDATE user_profiles SET ai_specialist = $1 WHERE user_id = $2`,
      [ai_specialist || null, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar la preferencia' });
  }
});

// Obtener el último plan de rutina guardado
app.get('/api/v2/ai/workout-plan', authenticateToken, async (req, res) => {
  try {
    const result = await pgDb.query(
      'SELECT plan_json, created_at FROM workout_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [req.user.id]
    );
    if (result.rows.length === 0) return res.json(null);
    res.json({ ...result.rows[0].plan_json, saved_at: result.rows[0].created_at });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo plan de rutina.' });
  }
});

// Progreso por ejercicio: lista de ejercicios únicos registrados
app.get('/api/v2/progress/exercises', authenticateToken, async (req, res) => {
  try {
    const result = await pgDb.query(
      `SELECT DISTINCT exercise, COUNT(*) as sessions,
        MAX(weight) as max_weight, MAX(date) as last_date
       FROM workouts WHERE client_id = $1
       GROUP BY exercise ORDER BY last_date DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo ejercicios.' });
  }
});

// Progreso por ejercicio: historial de un ejercicio específico (para tabla/gráfica)
app.get('/api/v2/progress/exercise-history', authenticateToken, async (req, res) => {
  try {
    const { exercise } = req.query;
    if (!exercise) return res.status(400).json({ error: 'Falta el parámetro exercise.' });
    const result = await pgDb.query(
      `SELECT date, weight, COALESCE(sets, 1) as sets, reps, (weight * reps * COALESCE(sets, 1)) as volumen
       FROM workouts WHERE client_id = $1 AND exercise ILIKE $2
       ORDER BY date ASC`,
      [req.user.id, `%${exercise}%`]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo historial de ejercicio.' });
  }
});

// -- TASA DE RECUPERACIÓN: ACWR + métricas de sueño/estrés --
app.get('/api/v2/progress/recovery', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Volumen diario últimos 28 días (weight × reps por día)
    const volumeRes = await pgDb.query(
      `SELECT date::text, SUM(weight * reps * COALESCE(sets, 1)) as daily_volume
       FROM workouts WHERE client_id = $1
       AND date >= CURRENT_DATE - INTERVAL '27 days'
       GROUP BY date ORDER BY date ASC`,
      [userId]
    );
    const volumeByDay = volumeRes.rows;

    // ACWR: carga aguda (7 días) / carga crónica (promedio semanas últimos 28 días)
    const acuteLoad = volumeByDay
      .filter(r => new Date(r.date) >= new Date(Date.now() - 7 * 86400000))
      .reduce((s, r) => s + Number(r.daily_volume), 0);

    const chronicLoad = volumeByDay.reduce((s, r) => s + Number(r.daily_volume), 0) / 4; // 4 semanas
    const acwr = chronicLoad > 0 ? Math.round((acuteLoad / chronicLoad) * 100) / 100 : null;

    // Índice de monotonía (CV del volumen diario, últimos 7 días)
    const recentVolumes = volumeByDay
      .filter(r => new Date(r.date) >= new Date(Date.now() - 7 * 86400000))
      .map(r => Number(r.daily_volume));
    let monotonyIndex = null;
    if (recentVolumes.length >= 3) {
      const avg = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
      const std = Math.sqrt(recentVolumes.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / recentVolumes.length);
      monotonyIndex = avg > 0 ? Math.round((std / avg) * 100) / 100 : null;
    }

    // Sueño y estrés: promedios últimos 7 días
    const recoveryMetricsRes = await pgDb.query(
      `SELECT AVG(sleep_hours)::numeric(4,1) as avg_sleep,
              AVG(stress_level)::numeric(3,1) as avg_stress,
              COUNT(*) as days_tracked
       FROM body_metrics
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '6 days'
       AND (sleep_hours IS NOT NULL OR stress_level IS NOT NULL)`,
      [userId]
    );
    const recoveryMetrics = recoveryMetricsRes.rows[0];

    // Nivel de recuperación estimado (0-100)
    let recoveryScore = null;
    const factors = [];
    if (acwr !== null) {
      const acwrScore = acwr <= 0.8 ? 60 : acwr <= 1.3 ? 100 : acwr <= 1.5 ? 60 : 30;
      factors.push(acwrScore * 0.5);
    }
    if (recoveryMetrics.avg_sleep !== null) {
      const sleepScore = Math.min(Number(recoveryMetrics.avg_sleep) / 8, 1) * 100;
      factors.push(sleepScore * 0.3);
    }
    if (recoveryMetrics.avg_stress !== null) {
      const stressScore = (5 - Number(recoveryMetrics.avg_stress)) / 4 * 100;
      factors.push(stressScore * 0.2);
    }
    if (factors.length > 0) {
      recoveryScore = Math.round(factors.reduce((a, b) => a + b, 0));
    }

    // Zona ACWR
    const acwrZone = acwr === null ? 'sin datos'
      : acwr < 0.8 ? 'subcarga'
      : acwr <= 1.3 ? 'óptima'
      : acwr <= 1.5 ? 'precaución'
      : 'sobreentrenamiento';

    res.json({
      acwr,
      acwr_zone: acwrZone,
      acute_load: Math.round(acuteLoad),
      chronic_load: Math.round(chronicLoad),
      monotony_index: monotonyIndex,
      avg_sleep_hours: recoveryMetrics.avg_sleep ? Number(recoveryMetrics.avg_sleep) : null,
      avg_stress_level: recoveryMetrics.avg_stress ? Number(recoveryMetrics.avg_stress) : null,
      days_tracked: Number(recoveryMetrics.days_tracked),
      recovery_score: recoveryScore,
    });
  } catch (error) {
    console.error('Error calculando recuperación:', error);
    res.status(500).json({ error: 'Error calculando tasa de recuperación.' });
  }
});

// -- RUTAS v2 (PostgreSQL) --
// Registramos las rutas migradas bajo el prefijo /api/v2/
app.use('/api/v2/foods', foodsRoutes);
app.use('/api/v2/logs', logsRoutes);
app.use('/api/v2/progress', metricsRoutes);
app.use('/api/v2/workouts', workoutsRoutes);
app.use('/api/v2/relations', relationsRoutes);
app.use('/api/v2/reviews', reviewsRoutes);
app.use('/api/v2/upload', uploadRoutes);
app.use('/api/v2/notifications', notificationsRoutes);
app.use('/api/v2/admin', adminRoutes);

// -- DIETA: Generar plan con IA --
app.post('/api/v2/diet/generate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const senderRole = req.user.role;
    const body = req.body || {};

    // Si es nutricionista con client_id, usar el perfil del cliente
    const targetId = (senderRole === 'nutritionist' || senderRole === 'trainer') && body.client_id
      ? body.client_id
      : userId;

    const profileRes = await pgDb.query('SELECT * FROM user_profiles WHERE user_id = $1 LIMIT 1', [targetId]);
    const profileRow = profileRes.rows[0] || {};

    // Fallback: leer métricas recientes si no hay perfil
    const metricsRes = await pgDb.query(
      `SELECT weight_kg, height_cm, notes FROM body_metrics WHERE user_id = $1 ORDER BY date DESC LIMIT 1`,
      [targetId]
    );
    const metricsRow = metricsRes.rows[0] || {};

    const profile = {
      age: profileRow.age || 'No especificada',
      sex: profileRow.sex || 'No especificado',
      weight_kg: profileRow.weight_kg || metricsRow.weight_kg || 'No especificado',
      height_cm: profileRow.height_cm || metricsRow.height_cm || 'No especificada',
      activity_level: profileRow.activity_level || 'Moderado',
      goal: profileRow.goal || 'Mejorar condición física',
      experience_level: profileRow.experience_level || 'Principiante',
      injuries: profileRow.injuries || metricsRow.notes || 'Ninguna',
    };

    // Obtener el plan de mesociclo guardado (objetivo, estructura semanal)
    const workoutPlanRes = await pgDb.query(
      'SELECT plan_json FROM workout_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [targetId]
    );
    const savedPlan = workoutPlanRes.rows.length > 0 ? workoutPlanRes.rows[0].plan_json : null;

    // Obtener registros reales de entrenamiento (últimas 3 semanas)
    const workoutLogsRes = await pgDb.query(
      `SELECT date::text, exercise, weight, COALESCE(sets, 1) as sets, reps, (weight * reps * COALESCE(sets, 1)) as volumen
       FROM workouts WHERE client_id = $1
       AND date >= CURRENT_DATE - INTERVAL '21 days'
       ORDER BY date DESC, exercise ASC LIMIT 40`,
      [targetId]
    );

    // ACWR para el prompt de dieta
    const acwrDietRes = await pgDb.query(
      `SELECT date::text, SUM(weight * reps * COALESCE(sets, 1)) as daily_volume
       FROM workouts WHERE client_id = $1 AND date >= CURRENT_DATE - INTERVAL '27 days'
       GROUP BY date ORDER BY date ASC`,
      [targetId]
    );
    const acwrDietRows = acwrDietRes.rows;
    const acuteD = acwrDietRows.filter(r => new Date(r.date) >= new Date(Date.now()-7*86400000)).reduce((s,r)=>s+Number(r.daily_volume),0);
    const chronicD = acwrDietRows.reduce((s,r)=>s+Number(r.daily_volume),0)/4;
    const acwrDiet = chronicD > 0 ? Math.round(acuteD/chronicD*100)/100 : null;

    const recovRowDiet = await pgDb.query(
      `SELECT AVG(sleep_hours)::numeric(4,1) as avg_sleep, AVG(stress_level)::numeric(3,1) as avg_stress
       FROM body_metrics WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '6 days'
       AND (sleep_hours IS NOT NULL OR stress_level IS NOT NULL)`,
      [targetId]
    );
    const recDiet = recovRowDiet.rows[0];

    // Construir objeto de entrenamiento para el prompt
    const workoutContext = {
      mesocycleGoal: savedPlan?.workout_plan?.goal || null,
      progressionNotes: savedPlan?.workout_plan?.progression_notes || null,
      trainingDays: savedPlan?.workout_plan?.days?.map(d => `${d.focus} (${d.exercises?.map(e => e.name).join(', ')})`).join(' | ') || null,
      recentLogs: workoutLogsRes.rows,
      recovery: {
        acwr: acwrDiet,
        acwr_zone: acwrDiet === null ? 'sin datos' : acwrDiet < 0.8 ? 'subcarga' : acwrDiet <= 1.3 ? 'óptima' : acwrDiet <= 1.5 ? 'precaución' : 'sobreentrenamiento',
        avg_sleep: recDiet.avg_sleep ? Number(recDiet.avg_sleep) : null,
        avg_stress: recDiet.avg_stress ? Number(recDiet.avg_stress) : null,
      }
    };

    // Consultar historial nutricional real de los últimos 7 días
    const mealHistoryRes = await pgDb.query(
      `SELECT log_date::text as date,
        ROUND(SUM(calories)::numeric, 0) as calories,
        ROUND(SUM(protein_g)::numeric, 1) as protein_g,
        ROUND(SUM(carbs_g)::numeric, 1) as carbs_g,
        ROUND(SUM(fat_g)::numeric, 1) as fat_g
       FROM meal_logs WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '6 days'
       GROUP BY log_date ORDER BY log_date ASC`,
      [targetId]
    );
    const mealRows = mealHistoryRes.rows;
    const nutritionHistory = {
      dailySummary: mealRows,
      avgCalories: mealRows.length > 0 ? Math.round(mealRows.reduce((s, r) => s + Number(r.calories), 0) / mealRows.length) : null,
      avgProtein: mealRows.length > 0 ? (mealRows.reduce((s, r) => s + Number(r.protein_g), 0) / mealRows.length).toFixed(1) : null,
    };

    // Construir nutritionistContext si el generador es nutricionista o entrenador
    let nutritionistContext = {};
    if (senderRole === 'nutritionist') {
      const nProfileRes = await pgDb.query('SELECT ai_specialist FROM user_profiles WHERE user_id = $1', [userId]);
      const nUserRes = await pgDb.query('SELECT name, email FROM users WHERE id = $1', [userId]);
      nutritionistContext = {
        ai_specialist: nProfileRes.rows[0]?.ai_specialist || null,
        nutritionist_instructions: body.nutritionist_instructions || null,
        nutritionist_name: nUserRes.rows[0]?.name || nUserRes.rows[0]?.email || null,
      };
    }

    console.log('Generando dieta PowerBud A.I. Objetivo:', profile.goal, '| Especialista nutri:', nutritionistContext.ai_specialist || 'auto');
    const dietPlan = await aiService.generateDietPlan(profile, workoutContext, nutritionHistory, nutritionistContext);

    // Guardar en DB (para el cliente si client_id fue dado; para el usuario actual si no)
    const saveTargetId = (senderRole === 'nutritionist' || senderRole === 'trainer') && body.client_id
      ? body.client_id
      : userId;
    await pgDb.query(
      'INSERT INTO diet_plans (user_id, plan_json) VALUES ($1, $2)',
      [saveTargetId, JSON.stringify(dietPlan)]
    );

    // Notificación automática al generar dieta (si viene de nutricionista / entrenador para un cliente)
    if ((senderRole === 'nutritionist' || senderRole === 'trainer') && req.body.client_id) {
      try {
        const senderRes = await pgDb.query('SELECT name, email FROM users WHERE id = $1', [userId]);
        const senderName = senderRes.rows[0]?.name || senderRes.rows[0]?.email || (senderRole === 'nutritionist' ? 'Tu nutricionista' : 'Tu entrenador');
        const notifType = senderRole === 'nutritionist' ? 'nutritionist' : 'trainer';
        await createNotification({
          userId: req.body.client_id,
          senderId: userId,
          type: notifType,
          title: '🥗 Nuevo plan de dieta asignado',
          body: `${senderName} ha generado un plan de alimentación personalizado para ti. ¡Revísalo en la pestaña Dieta!`,
        });
      } catch (notifErr) { console.error('Error notif diet:', notifErr); }
    }

    res.json(dietPlan);
  } catch (error) {
    console.error('Error generando dieta:', error);
    res.status(500).json({ error: error.message || 'No se pudo generar el plan de dieta.' });
  }
});

// -- DIETA: Obtener último plan --
app.get('/api/v2/diet/plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pgDb.query(
      'SELECT plan_json, created_at FROM diet_plans WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [userId]
    );
    if (result.rows.length === 0) return res.json(null);
    res.json({ ...result.rows[0].plan_json, saved_at: result.rows[0].created_at });
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo plan de dieta.' });
  }
});

// -- MEAL LOGS: Historial de macros por día (últimos 14 días) --
app.get('/api/v2/diet/daily-summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pgDb.query(
      `SELECT log_date::text as date,
        ROUND(SUM(calories)::numeric, 0) as calories,
        ROUND(SUM(protein_g)::numeric, 1) as protein_g,
        ROUND(SUM(carbs_g)::numeric, 1) as carbs_g,
        ROUND(SUM(fat_g)::numeric, 1) as fat_g,
        COUNT(*) as meals_count
       FROM meal_logs
       WHERE user_id = $1 AND log_date >= CURRENT_DATE - INTERVAL '13 days'
       GROUP BY log_date
       ORDER BY log_date ASC`,
      [userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo resumen diario.' });
  }
});

// -- MEAL LOGS: Obtener registros del día --
app.get('/api/v2/diet/meals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const result = await pgDb.query(
      'SELECT * FROM meal_logs WHERE user_id = $1 AND log_date = $2 ORDER BY created_at ASC',
      [userId, date]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error obteniendo comidas.' });
  }
});

// -- MEAL LOGS: Registrar comida --
app.post('/api/v2/diet/meals', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { meal_name, calories, protein_g, carbs_g, fat_g } = req.body;
    if (!meal_name) return res.status(400).json({ error: 'Nombre de comida requerido.' });

    const calVal = Number(calories) || 0;
    const protVal = Number(protein_g) || 0;
    const carbVal = Number(carbs_g) || 0;
    const fatVal = Number(fat_g) || 0;

    const result = await pgDb.query(
      `INSERT INTO meal_logs (user_id, meal_name, calories, protein_g, carbs_g, fat_g)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, meal_name, calVal, protVal, carbVal, fatVal]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error registrando comida.' });
  }
});

// -- MEAL LOGS: Eliminar comida --
app.delete('/api/v2/diet/meals/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const mealId = Number(req.params.id);
    if (!Number.isInteger(mealId) || mealId <= 0) return res.status(400).json({ error: 'ID inválido.' });
    await pgDb.query('DELETE FROM meal_logs WHERE id = $1 AND user_id = $2', [mealId, userId]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error eliminando comida.' });
  }
});

// -- EJEMPLO RUTA DE ENTRENADOR --
// Solo entrenadores pueden listar todos sus clientes
app.get('/api/trainer/clients', authenticateToken, requireRole('trainer'), async (req, res) => {
  try {
    const clients = await pgDb.query(`
      SELECT u.id, u.email, tc.status, tc.assigned_at
      FROM users u
      JOIN trainer_clients tc ON u.id = tc.client_id
      WHERE tc.trainer_id = $1
    `, [req.user.id]);
    res.json(clients.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener clientes' });
  }
});

// 1. Search Foods
app.get('/api/foods', (req, res) => {
    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const sql = rawQuery
        ? `SELECT * FROM foods WHERE name LIKE ? ORDER BY name ASC LIMIT 50`
        : `SELECT * FROM foods ORDER BY name ASC LIMIT 50`;
    const params = rawQuery ? [`%${rawQuery}%`] : [];

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

app.post('/api/foods', (req, res) => {
    const { name, calories, protein, carbs, fat } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedName) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const values = [parseLocaleNumber(calories), parseLocaleNumber(protein), parseLocaleNumber(carbs), parseLocaleNumber(fat)];
    const hasInvalid = values.some(v => !Number.isFinite(v) || v < 0);
    if (hasInvalid) {
        return res.status(400).json({ error: 'Invalid macro values' });
    }

    const sql = `INSERT INTO foods (name, calories, protein, carbs, fat) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [normalizedName, ...values], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        return res.status(201).json({
            id: this.lastID,
            name: normalizedName,
            calories: values[0],
            protein: values[1],
            carbs: values[2],
            fat: values[3]
        });
    });
});

app.put('/api/foods/:id', (req, res) => {
    const foodId = Number(req.params.id);
    const { name, calories, protein, carbs, fat } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!Number.isInteger(foodId) || foodId <= 0) {
        return res.status(400).json({ error: 'Invalid food id' });
    }

    if (!normalizedName) {
        return res.status(400).json({ error: 'Name is required' });
    }

    const values = [parseLocaleNumber(calories), parseLocaleNumber(protein), parseLocaleNumber(carbs), parseLocaleNumber(fat)];
    const hasInvalid = values.some(v => !Number.isFinite(v) || v < 0);
    if (hasInvalid) {
        return res.status(400).json({ error: 'Invalid macro values' });
    }

    const sql = `UPDATE foods SET name = ?, calories = ?, protein = ?, carbs = ?, fat = ? WHERE id = ?`;
    db.run(sql, [normalizedName, ...values, foodId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Food not found' });
        }

        return res.json({
            success: true,
            id: foodId,
            name: normalizedName,
            calories: values[0],
            protein: values[1],
            carbs: values[2],
            fat: values[3]
        });
    });
});

// 2. Get Today's Meal Logs
app.get('/api/logs', (req, res) => {
    // Expects date in query YYYY-MM-DD
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const sql = `
        SELECT l.id, l.date, l.quantity, l.unit, l.food_id, f.name, f.calories, f.protein, f.carbs, f.fat
        FROM logs l
        JOIN foods f ON l.food_id = f.id
        WHERE l.date = ?`;

    db.all(sql, [date], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 3. Log a Meal
app.post('/api/logs', (req, res) => {
    const { date, food_id, quantity, unit } = req.body;
    const normalizedUnit = ['g', 'unit', 'serving'].includes(unit) ? unit : 'g';

    if (!date || !food_id || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: 'Invalid payload' });
    }

    const sql = `INSERT INTO logs (date, food_id, quantity, unit) VALUES (?, ?, ?, ?)`;

    db.run(sql, [date, food_id, quantity, normalizedUnit], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, date, food_id, quantity, unit: normalizedUnit });
    });
});

app.put('/api/logs/:id', (req, res) => {
    const logId = Number(req.params.id);
    const { quantity, unit, food_id } = req.body;
    const normalizedUnit = ['g', 'unit', 'serving'].includes(unit) ? unit : 'g';

    if (!Number.isInteger(logId) || logId <= 0) {
        return res.status(400).json({ error: 'Invalid log id' });
    }

    if (!Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
        return res.status(400).json({ error: 'Invalid quantity' });
    }

    const hasFoodUpdate = Number.isInteger(Number(food_id)) && Number(food_id) > 0;
    const sql = hasFoodUpdate
        ? `UPDATE logs SET quantity = ?, unit = ?, food_id = ? WHERE id = ?`
        : `UPDATE logs SET quantity = ?, unit = ? WHERE id = ?`;
    const params = hasFoodUpdate
        ? [quantity, normalizedUnit, Number(food_id), logId]
        : [quantity, normalizedUnit, logId];

    db.run(sql, params, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Log not found' });
        }

        return res.json({ success: true, id: logId, quantity, unit: normalizedUnit, food_id: hasFoodUpdate ? Number(food_id) : undefined });
    });
});

app.delete('/api/logs/:id', (req, res) => {
    const logId = Number(req.params.id);
    if (!Number.isInteger(logId) || logId <= 0) {
        return res.status(400).json({ error: 'Invalid log id' });
    }

    db.run(`DELETE FROM logs WHERE id = ?`, [logId], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Log not found' });
        }

        return res.json({ success: true, id: logId });
    });
});

// 4. Get Workout History (for charts)
app.get('/api/workouts', (req, res) => {
    const exercise = req.query.exercise; // Optional filter
    let sql = `SELECT * FROM workouts ORDER BY date ASC`;
    let params = [];

    if (exercise) {
        sql = `SELECT * FROM workouts WHERE exercise = ? ORDER BY date ASC`;
        params = [exercise];
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 5. Log a Workout Set
app.post('/api/workouts', (req, res) => {
    const { date, exercise, weight, reps } = req.body;
    const sql = `INSERT INTO workouts (date, exercise, weight, reps) VALUES (?, ?, ?, ?)`;

    db.run(sql, [date, exercise, weight, reps], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ id: this.lastID, date, exercise, weight, reps });
    });
});

// 6. Get/Set Goals
app.get('/api/goals', (req, res) => {
    db.get("SELECT * FROM goals LIMIT 1", (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

app.post('/api/goals', (req, res) => {
    const { calories, protein, carbs, fat } = req.body;
    // Assuming single user single goal for now
    db.run(`UPDATE goals SET calories = ?, protein = ?, carbs = ?, fat = ?`,
        [calories, protein, carbs, fat],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true });
        }
    );
});

// 7. Body Metrics
app.get('/api/body-metrics', (req, res) => {
    db.all(`SELECT * FROM body_metrics ORDER BY date DESC LIMIT 30`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/body-metrics', (req, res) => {
    const { date, weight_kg, height_cm, waist_cm, chest_cm, hips_cm, notes } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const toNum = v => (v !== undefined && v !== null && v !== '') ? parseLocaleNumber(v) : null;
    const w = toNum(weight_kg);
    const h = toNum(height_cm);
    const waist = toNum(waist_cm);
    const chest = toNum(chest_cm);
    const hips = toNum(hips_cm);

    if (w !== null && (!Number.isFinite(w) || w <= 0)) return res.status(400).json({ error: 'Invalid weight' });
    if (h !== null && (!Number.isFinite(h) || h <= 0)) return res.status(400).json({ error: 'Invalid height' });

    db.run(
        `INSERT INTO body_metrics (date, weight_kg, height_cm, waist_cm, chest_cm, hips_cm, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [date, w, h, waist, chest, hips, notes || null],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, date, weight_kg: w, height_cm: h, waist_cm: waist, chest_cm: chest, hips_cm: hips, notes: notes || null });
        }
    );
});

app.delete('/api/body-metrics/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
    db.run(`DELETE FROM body_metrics WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Entry not found' });
        res.json({ success: true });
    });
});

// Start Server
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    const networkUrl = getNetworkUrl(PORT);
    if (networkUrl) {
        console.log(`Disponible en red para el celular: ${networkUrl}`);
        console.log(`Prueba rápida: ${networkUrl}/api/health`);
    }
});
