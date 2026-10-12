-- ============================================================
-- Powerbud: Habilitar Row-Level Security (RLS) en TODAS las tablas
-- ============================================================
-- IMPORTANTE: El backend usa service_role_key, que BYPASEA RLS.
-- Estas políticas protegen contra acceso directo con la anon key.
--
-- Ejecutar en: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- 1. HABILITAR RLS EN TODAS LAS TABLAS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. POLÍTICAS: Bloquear acceso anónimo, permitir service_role
--    (service_role bypasea RLS automáticamente, así que solo
--     necesitamos políticas restrictivas para el rol anon/authenticated)

-- === USERS ===
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

-- === TRAINER_CLIENTS ===
CREATE POLICY "trainer_clients_select" ON trainer_clients
  FOR SELECT USING (
    auth.uid()::text = trainer_id::text
    OR auth.uid()::text = client_id::text
  );

CREATE POLICY "trainer_clients_insert" ON trainer_clients
  FOR INSERT WITH CHECK (auth.uid()::text = trainer_id::text);

CREATE POLICY "trainer_clients_update" ON trainer_clients
  FOR UPDATE USING (auth.uid()::text = trainer_id::text);

CREATE POLICY "trainer_clients_delete" ON trainer_clients
  FOR DELETE USING (auth.uid()::text = trainer_id::text);

-- === FOODS ===
-- Alimentos globales (trainer_id IS NULL) son visibles para todos los autenticados
-- Alimentos personalizados solo para el trainer que los creó
CREATE POLICY "foods_select" ON foods
  FOR SELECT USING (
    trainer_id IS NULL
    OR auth.uid()::text = trainer_id::text
  );

CREATE POLICY "foods_insert" ON foods
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "foods_update" ON foods
  FOR UPDATE USING (auth.uid()::text = trainer_id::text);

CREATE POLICY "foods_delete" ON foods
  FOR DELETE USING (auth.uid()::text = trainer_id::text);

-- === LOGS ===
CREATE POLICY "logs_select_own" ON logs
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "logs_insert_own" ON logs
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "logs_update_own" ON logs
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "logs_delete_own" ON logs
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- === WORKOUTS ===
CREATE POLICY "workouts_select" ON workouts
  FOR SELECT USING (
    auth.uid()::text = client_id::text
    OR auth.uid()::text = trainer_id::text
  );

CREATE POLICY "workouts_insert" ON workouts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "workouts_update" ON workouts
  FOR UPDATE USING (
    auth.uid()::text = client_id::text
    OR auth.uid()::text = trainer_id::text
  );

CREATE POLICY "workouts_delete" ON workouts
  FOR DELETE USING (auth.uid()::text = trainer_id::text);

-- === GOALS ===
CREATE POLICY "goals_select_own" ON goals
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "goals_insert_own" ON goals
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "goals_update_own" ON goals
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- === BODY_METRICS ===
CREATE POLICY "body_metrics_select_own" ON body_metrics
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "body_metrics_insert_own" ON body_metrics
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "body_metrics_update_own" ON body_metrics
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "body_metrics_delete_own" ON body_metrics
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- === USER_PROFILES ===
CREATE POLICY "user_profiles_select_own" ON user_profiles
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "user_profiles_insert_own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE USING (auth.uid()::text = user_id::text);

-- === WORKOUT_PLANS ===
CREATE POLICY "workout_plans_select_own" ON workout_plans
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "workout_plans_insert_own" ON workout_plans
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "workout_plans_delete_own" ON workout_plans
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- === DIET_PLANS ===
CREATE POLICY "diet_plans_select_own" ON diet_plans
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "diet_plans_insert_own" ON diet_plans
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "diet_plans_delete_own" ON diet_plans
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- === MEAL_LOGS ===
CREATE POLICY "meal_logs_select_own" ON meal_logs
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "meal_logs_insert_own" ON meal_logs
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "meal_logs_update_own" ON meal_logs
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "meal_logs_delete_own" ON meal_logs
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- === TRAINER_REVIEWS ===
CREATE POLICY "trainer_reviews_select" ON trainer_reviews
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "trainer_reviews_insert" ON trainer_reviews
  FOR INSERT WITH CHECK (auth.uid()::text = client_id::text);

CREATE POLICY "trainer_reviews_update" ON trainer_reviews
  FOR UPDATE USING (auth.uid()::text = client_id::text);

-- === NOTIFICATIONS ===
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE USING (auth.uid()::text = user_id::text);

-- ============================================================
-- VERIFICACIÓN: Comprobar que RLS está habilitado en todas las tablas
-- ============================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'trainer_clients', 'foods', 'logs', 'workouts',
    'goals', 'body_metrics', 'user_profiles', 'workout_plans',
    'diet_plans', 'meal_logs', 'trainer_reviews', 'notifications'
  )
ORDER BY tablename;
