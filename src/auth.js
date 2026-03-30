const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./pg-database'); // Conexión a PostgreSQL

const JWT_SECRET = process.env.JWT_SECRET || 'powerbud-secret-key-dev-only'; // En producción esto será seguro

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
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'Email, password y role son obligatorios' });
    }

    if (!['trainer', 'client'].includes(role)) {
      return res.status(400).json({ error: 'El rol debe ser trainer o client' });
    }

    try {
      // Verificar si el correo ya existe
      const userExists = await db.query('SELECT * FROM users WHERE email = $1', [email]);
      if (userExists.rows.length > 0) {
        return res.status(409).json({ error: 'El correo electrónico ya está registrado' });
      }

      // Encriptar contraseña
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Guardar usuario
      const result = await db.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
        [email, hashedPassword, role]
      );

      res.status(201).json({ message: 'Usuario creado exitosamente', user: result.rows[0] });
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

      // Generar Token JWT (Válido por 7 días)
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ message: 'Inicio de sesión exitoso', token, user: { id: user.id, email: user.email, role: user.role } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error del servidor al iniciar sesión' });
    }
  },

  // Ejemplo: Obtener el perfil del usuario autenticado
  async getProfile(req, res) {
    try {
      const result = await db.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
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
