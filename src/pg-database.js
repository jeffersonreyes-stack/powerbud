const { Pool } = require('pg');

// Utilizamos variables de entorno para que sea seguro y fácil de desplegar.
// En desarrollo, usará PostgreSQL local o una cadena simulada si no se provee.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/powerbud',
  // SSL debe habilitarse si te conectas a AWS RDS o Google Cloud SQL
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

async function initDb() {
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL database.');

    // Comenzamos transacción para las tablas base
    await client.query('BEGIN');

    // Tabla de Usuarios (Roles: admin, trainer, client)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('trainer', 'client', 'admin')),
        verification_status VARCHAR(50) DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified')), -- Para el certificado de educacion
        certificate_url VARCHAR(500), -- Donde se guardará la foto de su diploma en Supabase
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de Relación (Entrenador -> Cliente)
    await client.query(`
      CREATE TABLE IF NOT EXISTS trainer_clients (
        trainer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'inactive')),
        assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (trainer_id, client_id)
      )
    `);

    // Tablas Migradas del SQLite original:
    // Foods (con posible relación a entrenador para alimentos personalizados)
    await client.query(`
      CREATE TABLE IF NOT EXISTS foods (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        calories INTEGER NOT NULL,
        protein REAL NOT NULL,
        carbs REAL NOT NULL,
        fat REAL NOT NULL,
        trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL -- Alimentos globales si es null
      )
    `);

    // Logs (Diario de comidas) -> ahora asociado a un cliente específico
    await client.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        date DATE NOT NULL,
        food_id INTEGER REFERENCES foods(id) ON DELETE CASCADE,
        quantity REAL NOT NULL,
        unit VARCHAR(50) DEFAULT 'g' CHECK (unit IN ('g', 'unit', 'serving'))
      )
    `);

    // Rutinas y Ejercicios (Workouts) -> creadas por un entrenador para un cliente
    await client.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id SERIAL PRIMARY KEY,
        trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        exercise VARCHAR(255) NOT NULL,
        weight REAL NOT NULL,
        reps INTEGER NOT NULL,
        modified_by_client BOOLEAN DEFAULT FALSE -- Flag para saber si el cliente alteró la recomendación del entrenador
      )
    `);

    // Metas Diarias (Goals) -> Asociadas a un cliente
    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
        calories INTEGER NOT NULL,
        protein INTEGER NOT NULL,
        carbs INTEGER NOT NULL,
        fat INTEGER NOT NULL
      )
    `);

    // Métricas Corporales (Progreso del cliente con foto en Supabase Storage)
    await client.query(`
      CREATE TABLE IF NOT EXISTS body_metrics (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        date DATE NOT NULL,
        weight_kg REAL,
        height_cm REAL,
        waist_cm REAL,
        chest_cm REAL,
        hips_cm REAL,
        notes TEXT,
        photo_url VARCHAR(500) -- URL pública del bucket de Supabase
      )
    `);

    // Columnas de recuperación (agregadas progresivamente, seguras con IF NOT EXISTS)
    await client.query(`ALTER TABLE body_metrics ADD COLUMN IF NOT EXISTS sleep_hours REAL`);
    await client.query(`ALTER TABLE body_metrics ADD COLUMN IF NOT EXISTS stress_level INTEGER`);
    await client.query(`ALTER TABLE workouts ADD COLUMN IF NOT EXISTS rpe INTEGER`);

    // Tabla de Perfil Inicial del Usuario (Onboarding)
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
        age INTEGER,
        sex VARCHAR(20),
        activity_level VARCHAR(50),
        weight_kg REAL,
        height_cm REAL,
        waist_cm REAL,
        neck_cm REAL,
        experience_level VARCHAR(50),
        goal TEXT,
        injuries TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de Planes de Rutina generados por IA (JSON completo)
    await client.query(`
      CREATE TABLE IF NOT EXISTS workout_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        plan_json JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de Planes de Dieta generados por IA
    await client.query(`
      CREATE TABLE IF NOT EXISTS diet_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        plan_json JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de Registro de Comidas del día
    await client.query(`
      CREATE TABLE IF NOT EXISTS meal_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        log_date DATE NOT NULL DEFAULT CURRENT_DATE,
        meal_name VARCHAR(255) NOT NULL,
        calories REAL DEFAULT 0,
        protein_g REAL DEFAULT 0,
        carbs_g REAL DEFAULT 0,
        fat_g REAL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de Calificaciones y Reseñas de Entrenadores (Reviews)
    await client.query(`
      CREATE TABLE IF NOT EXISTS trainer_reviews (
        id SERIAL PRIMARY KEY,
        trainer_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        client_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5), -- Calificación de 1 a 5 estrellas
        comment TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(trainer_id, client_id) -- Un cliente solo puede dejar una reseña por entrenador (puede actualizarla)
      )
    `);

    await client.query('COMMIT');
    console.log('PostgreSQL database tables initialized successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error initializing database tables:', err);
  } finally {
    client.release();
  }
}

// Exportamos el pool para poder hacer queries desde otros archivos
module.exports = {
  query: (text, params) => pool.query(text, params),
  initDb,
};
