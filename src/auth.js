const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./pg-database'); // Conexión a PostgreSQL
const { sendEmailVerification } = require('./mailer');

const JWT_SECRET = process.env.JWT_SECRET || 'powerbud-secret-key-dev-only'; // En producción esto será seguro

async function sendFreshVerificationEmail(user) {
  const verifyToken = jwt.sign({ userId: user.id, purpose: 'email_verify' }, JWT_SECRET, { expiresIn: '24h' });
  return sendEmailVerification({
    userEmail: user.email,
    userName: user.name || user.email,
    verifyToken
  });
}

// Middleware para proteger rutas
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.status(401).json({ error: 'Token no proporcionado' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user; // Guarda { id, email, role } en la petición
    next();
  });
}

// Middleware para verificar rol (Ej. Solo Entrenadores)
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: `Acceso denegado. Se requiere rol: ${role}` });
    }
    next();
  };
}

// Controladores
const authController = {
  // Registro de usuario (Entrenador o Cliente)
  async register(req, res) {
    const { email, password, role, name } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password y role son obligatorios' });
    }

    if (!['trainer', 'client', 'nutritionist'].includes(role)) {
      return res.status(400).json({ error: 'El rol debe ser trainer, client o nutritionist' });
    }

    try {
      // Verificar si el correo ya existe
      const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userExists.rows.length > 0) {
        const existing = userExists.rows[0];

        // Cuenta verificada → no puede registrarse de nuevo
        if (existing.email_verified) {
          return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
        }

        // Cuenta pendiente de verificación → actualizar vencimiento y reenviar email
        const verifiedExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.query('UPDATE users SET email_verified_expires = $1 WHERE id = $2', [verifiedExpires, existing.id]);
        try {
          await sendFreshVerificationEmail(existing);
        } catch (mailErr) {
          console.error('[auth] Error reenviando email:', mailErr.message);
        }
        return res.status(409).json({ error: 'Ya existe una cuenta pendiente con ese correo. Te reenviamos un nuevo email de verificación.' });
      }

      // Encriptar contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Guardar usuario
      const trimmedName = typeof name === 'string' ? name.trim() : null;
      const verifiedExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
      const result = await db.query(
        'INSERT INTO users (email, password_hash, role, name, email_verified, email_verified_expires) VALUES ($1, $2, $3, $4, FALSE, $5) RETURNING id, email, role, name',
        [email, hashedPassword, role, trimmedName, verifiedExpires]
      );

      const newUser = result.rows[0];

      // Enviar email de verificación
      try {
        await sendFreshVerificationEmail(newUser);
      } catch (mailErr) {
        console.error('[auth] Error enviando email de verificación:', mailErr.message);
      }

      res.status(201).json({ message: 'Usuario creado. Revisa tu correo para verificar tu cuenta.', user: newUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error del servidor al registrar' });
    }
  },

  // Iniciar Sesión
  async login(req, res) {
    const { email, password } = req.body;

    try {
      // Buscar al usuario
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      const user = result.rows[0];

      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Verificar la contraseña
      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Bloquear si no verificó el email
      // Cuentas sin email_verified_expires son anteriores al feature → se dejan pasar
      if (!user.email_verified && user.email_verified_expires) {
        const expired = new Date(user.email_verified_expires) < new Date();
        const verifiedExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await db.query('UPDATE users SET email_verified_expires = $1 WHERE id = $2', [verifiedExpires, user.id]);

        try {
          await sendFreshVerificationEmail(user);
        } catch (mailErr) {
          console.error('[auth] Error reenviando verificación en login:', mailErr.message);
        }

        if (expired) {
          return res.status(403).json({
            error: 'Tu enlace de verificación había expirado. Ya te enviamos uno nuevo al correo.',
            needs_verification: true,
            expired: true,
          });
        }
        return res.status(403).json({
          error: 'Debes verificar tu correo electrónico antes de iniciar sesión. Te reenviamos un nuevo email.',
          needs_verification: true,
        });
      }

      // Generar Token JWT (Válido por 7 días)
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ message: 'Inicio de sesión exitoso', token, user: { id: user.id, email: user.email, role: user.role, name: user.name || null } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error del servidor al iniciar sesión' });
    }
  },

  async resendVerification(req, res) {
    const { email } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Debes indicar tu correo electrónico.' });
    }

    try {
      const result = await db.query('SELECT id, email, name, email_verified FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) {
        return res.json({ message: 'Si el correo existe, te enviaremos un nuevo enlace de verificación.' });
      }

      const user = result.rows[0];
      if (user.email_verified) {
        return res.json({ message: 'Tu correo ya está verificado. Ya puedes iniciar sesión.' });
      }

      const verifiedExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db.query('UPDATE users SET email_verified_expires = $1 WHERE id = $2', [verifiedExpires, user.id]);
      const emailResult = await sendFreshVerificationEmail(user);
      if (emailResult?.skipped) {
        return res.status(503).json({ error: 'El servicio de correo no está disponible. Configura RESEND_API_KEY en el servidor.' });
      }

      return res.json({ message: 'Te reenviamos el correo de verificación. Revisa también spam o promociones.' });
    } catch (err) {
      console.error('[auth] Error en resendVerification:', err);
      return res.status(500).json({ error: 'No se pudo reenviar el correo en este momento.' });
    }
  },

  // Ejemplo: Obtener el perfil del usuario autenticado
  async getProfile(req, res) {
    try {
      const result = await db.query('SELECT id, email, role, verification_status, created_at FROM users WHERE id = $1', [req.user.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Error del servidor' });
    }
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  authController
};
