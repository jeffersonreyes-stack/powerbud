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
        reps INTEGER NOT NULL
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

    // Métricas Corporales (Progreso del cliente)
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
        notes TEXT
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
