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

    // Tabla de Usuarios (Roles: admin, trainer, client, nutritionist)
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'client',
        verification_status VARCHAR(50) DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending', 'verified')),
        certificate_url VARCHAR(500),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Permitir rol nutritionist en producción sin violar check antiguo
    await client.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await client.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('trainer', 'client', 'admin', 'nutritionist'))`);

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
        calories REAL NOT NULL,
        protein REAL NOT NULL,
        carbs REAL NOT NULL,
        fat REAL NOT NULL,
        serving_g REAL DEFAULT 100,
        serving_label VARCHAR(20) DEFAULT 'g',
        trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL
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

    // Tabla de Notificaciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'system' CHECK (type IN ('system', 'trainer', 'nutritionist')),
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_expires TIMESTAMP WITH TIME ZONE`);
    await client.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS serving_g REAL DEFAULT 100`);
    await client.query(`ALTER TABLE foods ADD COLUMN IF NOT EXISTS serving_label VARCHAR(20) DEFAULT 'g'`);

    // Columnas de perfil profesional para entrenadores y nutricionistas
    await client.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS specialty VARCHAR(255)`);
    await client.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS availability TEXT`);
    await client.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS rate_info VARCHAR(255)`);
    await client.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS ai_specialist VARCHAR(100)`);

    // Columna para marcar registros generados automáticamente por la IA (nunca registrados manualmente)
    await client.query(`ALTER TABLE workouts ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT FALSE`);

    // Limpiar prefijos de día en ejercicios generados por IA (ej: "Día X: Fuerza...: Sentadilla" → "Sentadilla")
    await client.query(`
      UPDATE workouts
      SET exercise = REGEXP_REPLACE(exercise, '^.+:\\s*', '', 'g')
      WHERE exercise LIKE '%:%'
    `);

    // Marcar como AI todos los registros con las características del plan generado automáticamente:
    // peso=10 (placeholder), trainer_id NULL, nunca editado, fecha anterior al fix (Abr 6 2026).
    // Esto es una migración one-shot: los registros manuales reales nunca tienen is_ai_generated=TRUE.
    await client.query(`
      UPDATE workouts
      SET is_ai_generated = TRUE
      WHERE is_ai_generated = FALSE
        AND trainer_id IS NULL
        AND weight = 10
        AND modified_by_client = FALSE
        AND date < '2026-04-06'
    `);

    // Eliminar todos los registros marcados como generados por IA (limpiar historial falso)
    await client.query(`DELETE FROM workouts WHERE is_ai_generated = TRUE`);

    // ── Seed alimentos base (colombianos / latinos) ────────────────────────
    const foodSeed = [
      // Proteínas
      { name: 'Pechuga de pollo', cal: 165, prot: 31,   carbs: 0,    fat: 3.6,  sg: 100, sl: 'g' },
      { name: 'Muslo de pollo',   cal: 209, prot: 26,   carbs: 0,    fat: 11,   sg: 100, sl: 'g' },
      { name: 'Carne de res magra', cal: 218, prot: 26, carbs: 0,    fat: 12,   sg: 100, sl: 'g' },
      { name: 'Cerdo lomo',       cal: 143, prot: 26,   carbs: 0,    fat: 3.5,  sg: 100, sl: 'g' },
      { name: 'Salmón',           cal: 208, prot: 20,   carbs: 0,    fat: 13,   sg: 100, sl: 'g' },
      { name: 'Tilapia',          cal: 96,  prot: 20,   carbs: 0,    fat: 1.7,  sg: 100, sl: 'g' },
      { name: 'Atún en lata',     cal: 116, prot: 25.5, carbs: 0,    fat: 0.8,  sg: 100, sl: 'g' },
      { name: 'Huevo entero',     cal: 72,  prot: 6.3,  carbs: 0.4,  fat: 4.8,  sg: 1,   sl: 'und' },
      { name: 'Clara de huevo',   cal: 17,  prot: 3.6,  carbs: 0.2,  fat: 0.1,  sg: 1,   sl: 'und' },
      { name: 'Proteína en polvo', cal: 120, prot: 24,  carbs: 3,    fat: 1.5,  sg: 1,   sl: 'scoop' },
      { name: 'Yogur griego',     cal: 59,  prot: 10,   carbs: 3.6,  fat: 0.4,  sg: 100, sl: 'g' },
      { name: 'Requesón',         cal: 98,  prot: 11,   carbs: 3.4,  fat: 4.3,  sg: 100, sl: 'g' },
      // Carbohidratos
      { name: 'Arroz blanco cocido', cal: 130, prot: 2.7, carbs: 28, fat: 0.3,  sg: 100, sl: 'g' },
      { name: 'Arroz integral cocido', cal: 111, prot: 2.6, carbs: 23, fat: 0.9, sg: 100, sl: 'g' },
      { name: 'Avena en hojuelas', cal: 389, prot: 16.9, carbs: 66,  fat: 6.9,  sg: 100, sl: 'g' },
      { name: 'Papa cocida',      cal: 87,  prot: 1.9,  carbs: 20,   fat: 0.1,  sg: 100, sl: 'g' },
      { name: 'Batata / Camote',  cal: 86,  prot: 1.6,  carbs: 20,   fat: 0.1,  sg: 100, sl: 'g' },
      { name: 'Yuca cocida',      cal: 160, prot: 1.4,  carbs: 38,   fat: 0.3,  sg: 100, sl: 'g' },
      { name: 'Plátano maduro',   cal: 122, prot: 1.3,  carbs: 31.9, fat: 0.4,  sg: 100, sl: 'g' },
      { name: 'Plátano verde',    cal: 116, prot: 1.0,  carbs: 31,   fat: 0.2,  sg: 100, sl: 'g' },
      { name: 'Arepa de maíz',    cal: 180, prot: 4,    carbs: 36,   fat: 1.5,  sg: 1,   sl: 'und' },
      { name: 'Pan integral',     cal: 75,  prot: 3.5,  carbs: 13,   fat: 1.1,  sg: 1,   sl: 'und' },
      { name: 'Pan blanco',       cal: 80,  prot: 2.6,  carbs: 15,   fat: 1,    sg: 1,   sl: 'und' },
      { name: 'Pasta cocida',     cal: 131, prot: 5,    carbs: 25,   fat: 1.1,  sg: 100, sl: 'g' },
      { name: 'Maíz desgranado',  cal: 86,  prot: 3.2,  carbs: 19,   fat: 1.2,  sg: 100, sl: 'g' },
      { name: 'Lentejas cocidas', cal: 116, prot: 9,    carbs: 20,   fat: 0.4,  sg: 100, sl: 'g' },
      { name: 'Frijoles cocidos', cal: 127, prot: 8.7,  carbs: 22.8, fat: 0.5,  sg: 100, sl: 'g' },
      { name: 'Garbanzo cocido',  cal: 164, prot: 8.9,  carbs: 27,   fat: 2.6,  sg: 100, sl: 'g' },
      // Frutas
      { name: 'Banano',           cal: 89,  prot: 1.1,  carbs: 23,   fat: 0.3,  sg: 1,   sl: 'und' },
      { name: 'Manzana',          cal: 52,  prot: 0.3,  carbs: 14,   fat: 0.2,  sg: 100, sl: 'g' },
      { name: 'Piña',             cal: 50,  prot: 0.5,  carbs: 13,   fat: 0.1,  sg: 100, sl: 'g' },
      { name: 'Mango',            cal: 60,  prot: 0.8,  carbs: 15,   fat: 0.4,  sg: 100, sl: 'g' },
      { name: 'Papaya',           cal: 43,  prot: 0.5,  carbs: 11,   fat: 0.3,  sg: 100, sl: 'g' },
      // Grasas saludables
      { name: 'Aguacate',         cal: 160, prot: 2,    carbs: 9,    fat: 15,   sg: 100, sl: 'g' },
      { name: 'Almendras',        cal: 579, prot: 21,   carbs: 22,   fat: 50,   sg: 100, sl: 'g' },
      { name: 'Maní / Cacahuete', cal: 567, prot: 25.8, carbs: 16,   fat: 49,   sg: 100, sl: 'g' },
      { name: 'Mantequilla de maní', cal: 94, prot: 4,  carbs: 3,    fat: 8,    sg: 1,   sl: 'cda' },
      { name: 'Aceite de oliva',  cal: 119, prot: 0,    carbs: 0,    fat: 13.5, sg: 1,   sl: 'cda' },
      // Lácteos
      { name: 'Leche entera',     cal: 61,  prot: 3.2,  carbs: 4.8,  fat: 3.3,  sg: 100, sl: 'ml' },
      { name: 'Leche descremada', cal: 34,  prot: 3.4,  carbs: 5,    fat: 0.1,  sg: 100, sl: 'ml' },
      { name: 'Queso fresco',     cal: 80,  prot: 5,    carbs: 1,    fat: 6,    sg: 30,  sl: 'g' },
      // Verduras
      { name: 'Brócoli',          cal: 34,  prot: 2.8,  carbs: 7,    fat: 0.4,  sg: 100, sl: 'g' },
      { name: 'Espinaca',         cal: 23,  prot: 2.9,  carbs: 3.6,  fat: 0.4,  sg: 100, sl: 'g' },
      { name: 'Lechuga',          cal: 15,  prot: 1.4,  carbs: 2.9,  fat: 0.2,  sg: 100, sl: 'g' },
      { name: 'Zanahoria',        cal: 41,  prot: 0.9,  carbs: 10,   fat: 0.2,  sg: 100, sl: 'g' },
      { name: 'Tomate',           cal: 18,  prot: 0.9,  carbs: 3.9,  fat: 0.2,  sg: 100, sl: 'g' },
    ];
    for (const f of foodSeed) {
      const exists = await client.query(`SELECT id FROM foods WHERE LOWER(name)=LOWER($1) AND trainer_id IS NULL LIMIT 1`, [f.name]);
      if (exists.rows.length === 0) {
        await client.query(
          `INSERT INTO foods (name, calories, protein, carbs, fat, serving_g, serving_label, trainer_id) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)`,
          [f.name, f.cal, f.prot || 0, f.carbs, f.fat, f.sg, f.sl]
        );
      }
    }

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
