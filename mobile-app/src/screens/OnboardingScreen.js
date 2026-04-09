import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import api from '../api';

const SEXOS = ['Masculino', 'Femenino', 'Otro'];
const ACTIVIDADES = ['Sedentario', 'Ligero', 'Moderado', 'Activo', 'Muy activo'];
const EXPERIENCIAS = ['Principiante', 'Intermedio', 'Avanzado'];
const OBJETIVOS = [
  'Perder grasa corporal',
  'Ganar músculo / Hipertrofia',
  'Mejorar resistencia',
  'Mejorar fuerza',
  'Mejorar condición física general',
  'Rehabilitación / Movilidad'
];

const ESPECIALIDADES_TRAINER = [
  'Entrenamiento funcional',
  'Hipertrofia y musculación',
  'Fuerza y powerlifting',
  'Pérdida de peso',
  'Resistencia y cardio',
  'Rehabilitación deportiva',
  'CrossFit',
  'Deportes de combate',
  'Preparación física general',
];

const ESPECIALIDADES_NUTRI = [
  'Nutrición deportiva',
  'Pérdida de peso',
  'Ganancia muscular',
  'Nutrición clínica',
  'Nutrición vegana/vegetariana',
  'Rendimiento deportivo',
  'Nutrición pediátrica',
];

const DISPONIBILIDAD = [
  'Lunes a viernes',
  'Lunes a sábado',
  'Fines de semana',
  'Horario flexible',
  'Solo virtual',
  'Presencial y virtual',
];

// Catálogo de asistentes IA — sincronizado con ai.js en backend
const AI_SPECIALISTS = [
  { key: 'hipertrofia',        label: '💪 Especialista en Hipertrofia',            desc: 'DUP, HST, Renaissance Periodization. 6-15 reps, volumen alto.' },
  { key: 'powerlifting',       label: '🏋️ Coach de Powerlifting',                  desc: '5/3/1, Texas Method, Sheiko. Sentadilla, press y peso muerto.' },
  { key: 'halterofilia',       label: '🥇 Coach de Halterofilia',                  desc: 'Arrancada y cargada. Programas búlgaros y soviéticos.' },
  { key: 'fuerza_funcional',   label: '⚡ Entrenador Funcional / CrossFit',         desc: 'WODs, AMRAPs, EMOMs. MetCons de cardio + fuerza + gimnásticos.' },
  { key: 'perdida_grasa',      label: '🔥 Especialista en Pérdida de Grasa',        desc: 'HIIT + fuerza. Déficit controlado preservando músculo.' },
  { key: 'resistencia',        label: '🏃 Entrenador de Resistencia y Atletismo',   desc: 'Polarizado 80/20, VO2max, umbral de lactato. Fondo y triatlón.' },
  { key: 'rehabilitacion',     label: '🩺 Especialista en Rehabilitación Deportiva',desc: 'Control motor, estabilización articular. Progresión cautelosa.' },
  { key: 'calistenia',         label: '🤸 Coach de Calistenia',                    desc: 'Muscle up, front lever, planche. Fuerza relativa sin equipo.' },
  { key: 'deporte_combate',    label: '🥊 Preparador de Deportes de Combate',      desc: 'MMA, boxeo, jiu-jitsu. Potencia explosiva y acondicionamiento.' },
  { key: 'atletismo_velocidad',label: '💨 Entrenador de Velocidad y Potencia',      desc: 'Pliometría, sprints, saltos. Fuerza explosiva para campo y pista.' },
  { key: 'adulto_mayor',       label: '👴 Entrenador para Adulto Mayor',            desc: 'Prevención sarcopenia y caídas. Bajo impacto, equilibrio y funcional.' },
  { key: 'general',            label: '🎯 Entrenador Personal General',             desc: 'Balance fuerza, cardio y movilidad. Hábitos sostenibles.' },
];

// Catálogo de especialistas IA para nutricionistas — sincronizado con ai.js
const NUTRI_SPECIALISTS_UI = [
  { key: 'deportiva',        label: '🏅 Nutricionista Deportivo',              desc: 'Periodización nutricional, carb timing/cycling para atletas.' },
  { key: 'perdida_grasa',    label: '🔥 Especialista en Pérdida de Grasa',     desc: 'Déficit sostenible 300-500 kcal/día, alta proteína, saciedad.' },
  { key: 'ganancia_muscular',label: '💪 Especialista en Volumen y Músculo',    desc: 'Superávit limpio 250-400 kcal, proteína distribuida en 5 tomas.' },
  { key: 'clinica',          label: '🩺 Nutricionista Clínica',                desc: 'Diabetes, HTA, síndrome metabólico. Índice glucémico y patologías.' },
  { key: 'vegana',           label: '🌱 Especialista Vegana/Vegetariana',      desc: 'Proteína completa, B12, D3, omega-3 de algas. Sin productos animales.' },
  { key: 'rendimiento',      label: '⚡ Nutrición de Alto Rendimiento',         desc: 'Carga de carbos, hidratación, suplementación legal en competencia.' },
  { key: 'pediatrica',       label: '👶 Nutricionista Pediátrica',             desc: 'Crecimiento y desarrollo, adolescentes deportistas, neofobia.' },
  { key: 'adulto_mayor',     label: '👴 Nutricionista Adulto Mayor',           desc: 'Sarcopenia, calcio, B12 biodisponible, alimentos blandos.' },
  { key: 'patologias',       label: '⚕️ Nutrición Terapéutica y Patologías',   desc: 'ERC, dislipidemia, intestino irritable, manejo multi-patología.' },
  { key: 'general_nutri',    label: '🥗 Nutricionista General',                desc: 'Plato saludable, educación alimentaria, adherencia a largo plazo.' },
];

export default function OnboardingScreen({ onComplete, initialData = null, onCancel = null, userRole = 'client' }) {
  const isEditing = !!initialData;
  const isProfessional = userRole === 'trainer' || userRole === 'nutritionist';
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Campos cliente ────────────────────────────────────────────────────────
  const [age, setAge] = useState(initialData?.age?.toString() || '');
  const [sex, setSex] = useState(initialData?.sex || '');
  const [activityLevel, setActivityLevel] = useState(initialData?.activity_level || '');
  const [weightKg, setWeightKg] = useState(initialData?.weight_kg?.toString() || '');
  const [heightCm, setHeightCm] = useState(initialData?.height_cm?.toString() || '');
  const [waistCm, setWaistCm] = useState(initialData?.waist_cm?.toString() || '');
  const [neckCm, setNeckCm] = useState(initialData?.neck_cm?.toString() || '');
  const [experienceLevel, setExperienceLevel] = useState(initialData?.experience_level || '');
  const [goal, setGoal] = useState(initialData?.goal || '');
  const [injuries, setInjuries] = useState(initialData?.injuries || '');

  // ── Campos profesional (trainer / nutritionist) ───────────────────────────
  const [specialty, setSpecialty] = useState(initialData?.specialty || '');
  const [availability, setAvailability] = useState(initialData?.availability || '');
  const [rateInfo, setRateInfo] = useState(initialData?.rate_info || '');
  const [bio, setBio] = useState(initialData?.bio || '');
  const [aiSpecialist, setAiSpecialist] = useState(initialData?.ai_specialist || '');

  // ── Guardado cliente ──────────────────────────────────────────────────────
  const handleFinish = async () => {
    if (!age || !sex || !activityLevel || !weightKg || !heightCm || !experienceLevel || !goal) {
      Alert.alert('Faltan datos', 'Por favor completa todos los campos obligatorios.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/v2/user-profile', {
        age: Number(age), sex, activity_level: activityLevel,
        weight_kg: Number(weightKg), height_cm: Number(heightCm),
        waist_cm: waistCm ? Number(waistCm) : null,
        neck_cm: neckCm ? Number(neckCm) : null,
        experience_level: experienceLevel, goal, injuries: injuries || null,
      });
      onComplete();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar tu perfil. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // ── Guardado profesional ──────────────────────────────────────────────────
  const handleFinishProfessional = async () => {
    if (!specialty || !availability) {
      Alert.alert('Faltan datos', 'Selecciona tu especialidad y disponibilidad.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/v2/user-profile', {
        specialty, availability,
        rate_info: rateInfo || null,
        age: null, sex: null, activity_level: null, weight_kg: null,
        height_cm: null, waist_cm: null, neck_cm: null,
        experience_level: null, goal: null, injuries: null,
      });
      // Guardar especialista IA seleccionado (solo trainers)
      if (aiSpecialist) {
        await api.post('/v2/trainer/ai-specialist', { ai_specialist: aiSpecialist });
      }
      onComplete();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar tu perfil. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const SelectorButton = ({ label, selected, onPress }) => (
    <TouchableOpacity
      style={[styles.optionBtn, selected && styles.optionBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, selected && styles.optionTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // FLUJO PROFESIONAL (Entrenador / Nutricionista)
  // ══════════════════════════════════════════════════════════════════════════
  if (isProfessional) {
    const isTrainer = userRole === 'trainer';
    const especialidades = isTrainer ? ESPECIALIDADES_TRAINER : ESPECIALIDADES_NUTRI;
    const rolLabel = isTrainer ? 'Entrenador' : 'Nutricionista';
    const rolEmoji = isTrainer ? '🏋️' : '🥗';
    const totalSteps = 3; // ambos tienen 3 pasos ahora

    return (
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>⚡ PowerBud</Text>
        <Text style={styles.subtitle}>
          {isEditing
            ? `Actualiza tu perfil profesional ${rolEmoji}`
            : `Configura tu perfil de ${rolLabel} para comenzar a administrar asesorados`}
        </Text>
        {isEditing && onCancel && (
          <TouchableOpacity style={styles.cancelTopBtn} onPress={onCancel}>
            <Text style={styles.cancelTopBtnText}>✕ Cancelar</Text>
          </TouchableOpacity>
        )}

        {/* PASO 1: Especialidad profesional */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{rolEmoji} Paso 1 / {totalSteps} — Tu Especialidad</Text>
            <Text style={styles.cardDesc}>Esta información aparecerá en tu perfil público para que los usuarios te encuentren.</Text>

            <Text style={styles.label}>Especialidad principal *</Text>
            <View style={styles.column}>
              {especialidades.map(e => (
                <SelectorButton key={e} label={e} selected={specialty === e} onPress={() => setSpecialty(e)} />
              ))}
            </View>

            <TouchableOpacity style={[styles.nextBtn, { marginTop: 24 }]} onPress={() => {
              if (!specialty) { Alert.alert('Selecciona tu especialidad', 'Elige la que mejor describe tu perfil.'); return; }
              setStep(2);
            }}>
              <Text style={styles.nextBtnText}>Siguiente →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PASO 2 TRAINER: Asistente IA de entrenamiento */}
        {step === 2 && isTrainer && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🤖 Paso 2 / {totalSteps} — Asistente IA</Text>
            <Text style={styles.cardDesc}>
              Selecciona qué tipo de asistente de IA quieres que genere los planes para tus asesorados.
              Puedes cambiarlo en cualquier momento desde tu perfil.
            </Text>

            <Text style={styles.label}>Tipo de asistente IA *</Text>
            {AI_SPECIALISTS.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[styles.specialistCard, aiSpecialist === s.key && styles.specialistCardActive]}
                onPress={() => setAiSpecialist(s.key)}
              >
                <View style={styles.specialistRow}>
                  <Text style={[styles.specialistLabel, aiSpecialist === s.key && styles.specialistLabelActive]}>
                    {s.label}
                  </Text>
                  {aiSpecialist === s.key && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.specialistDesc, aiSpecialist === s.key && styles.specialistDescActive]}>
                  {s.desc}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backBtnText}>← Atrás</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => {
                if (!aiSpecialist) { Alert.alert('Selecciona un asistente', 'Elige el tipo de IA que mejor se adapte a tu metodología.'); return; }
                setStep(3);
              }}>
                <Text style={styles.nextBtnText}>Siguiente →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PASO 2 NUTRICIONISTA: Asistente IA nutricional */}
        {step === 2 && !isTrainer && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🤖 Paso 2 / {totalSteps} — Asistente IA</Text>
            <Text style={styles.cardDesc}>
              Selecciona tu especialización nutricional. La IA generará planes de dieta con tu metodología y enfoque específico.
            </Text>

            <Text style={styles.label}>Especialista de nutrición IA *</Text>
            {NUTRI_SPECIALISTS_UI.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[styles.specialistCard, aiSpecialist === s.key && styles.specialistCardActive]}
                onPress={() => setAiSpecialist(s.key)}
              >
                <View style={styles.specialistRow}>
                  <Text style={[styles.specialistLabel, aiSpecialist === s.key && styles.specialistLabelActive]}>
                    {s.label}
                  </Text>
                  {aiSpecialist === s.key && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.specialistDesc, aiSpecialist === s.key && styles.specialistDescActive]}>
                  {s.desc}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backBtnText}>← Atrás</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => {
                if (!aiSpecialist) { Alert.alert('Selecciona un especialista', 'Elige la especialización de IA que mejor represente tu enfoque nutricional.'); return; }
                setStep(3);
              }}>
                <Text style={styles.nextBtnText}>Siguiente →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* PASO 3: Disponibilidad y tarifa (ambos roles) */}
        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{rolEmoji} Paso 3 / {totalSteps} — Disponibilidad y Tarifa</Text>
            <Text style={styles.cardDesc}>Ayuda a tus futuros asesorados a saber cuándo y cómo trabajar contigo.</Text>

            <Text style={styles.label}>Disponibilidad *</Text>
            <View style={styles.column}>
              {DISPONIBILIDAD.map(d => (
                <SelectorButton key={d} label={d} selected={availability === d} onPress={() => setAvailability(d)} />
              ))}
            </View>

            <Text style={styles.label}>Tarifa (opcional — puedes dejarlo "A convenir")</Text>
            <TextInput
              style={styles.input}
              placeholder='Ej: $120.000/mes · A convenir'
              placeholderTextColor="#444"
              value={rateInfo}
              onChangeText={setRateInfo}
            />

            <View style={styles.navRow}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
                <Text style={styles.backBtnText}>← Atrás</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.finishBtn} onPress={handleFinishProfessional} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#18181b" />
                  : <Text style={styles.finishBtnText}>{isEditing ? '💾 Guardar' : '¡Listo! ⚡'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FLUJO CLIENTE (original, 3 pasos)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={80}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>⚡ Powerbud</Text>
      <Text style={styles.subtitle}>
        {isEditing ? 'Actualiza tu perfil para mejorar las recomendaciones de la IA' : 'Configura tu perfil para recibir tu mesociclo de 6 semanas personalizado'}
      </Text>
      {isEditing && onCancel && (
        <TouchableOpacity style={styles.cancelTopBtn} onPress={onCancel}>
          <Text style={styles.cancelTopBtnText}>✕ Cancelar</Text>
        </TouchableOpacity>
      )}

      {/* PASO 1: Datos físicos básicos */}
      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 1 / 3 — Datos Físicos</Text>

          <Text style={styles.label}>Edad *</Text>
          <TextInput style={styles.input} placeholder="Ej: 25" placeholderTextColor="#444" keyboardType="numeric" value={age} onChangeText={setAge} />

          <Text style={styles.label}>Sexo *</Text>
          <View style={styles.row}>
            {SEXOS.map(s => <SelectorButton key={s} label={s} selected={sex === s} onPress={() => setSex(s)} />)}
          </View>

          <Text style={styles.label}>Peso (kg) *</Text>
          <TextInput style={styles.input} placeholder="Ej: 75" placeholderTextColor="#444" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />

          <Text style={styles.label}>Altura (cm) *</Text>
          <TextInput style={styles.input} placeholder="Ej: 175" placeholderTextColor="#444" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />

          <Text style={styles.label}>Cintura (cm) — opcional</Text>
          <TextInput style={styles.input} placeholder="Ej: 85" placeholderTextColor="#444" keyboardType="numeric" value={waistCm} onChangeText={setWaistCm} />

          <Text style={styles.label}>Cuello (cm) — opcional</Text>
          <TextInput style={styles.input} placeholder="Ej: 38" placeholderTextColor="#444" keyboardType="numeric" value={neckCm} onChangeText={setNeckCm} />

          <TouchableOpacity style={styles.nextBtn} onPress={() => {
            if (!age || !sex || !weightKg || !heightCm) { Alert.alert('Faltan datos', 'Completa edad, sexo, peso y altura.'); return; }
            setStep(2);
          }}>
            <Text style={styles.nextBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PASO 2: Nivel de actividad y experiencia */}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 2 / 3 — Actividad y Experiencia</Text>

          <Text style={styles.label}>Nivel de actividad física *</Text>
          <View style={styles.column}>
            {ACTIVIDADES.map(a => <SelectorButton key={a} label={a} selected={activityLevel === a} onPress={() => setActivityLevel(a)} />)}
          </View>

          <Text style={styles.label}>Experiencia en el gym *</Text>
          <View style={styles.row}>
            {EXPERIENCIAS.map(e => <SelectorButton key={e} label={e} selected={experienceLevel === e} onPress={() => setExperienceLevel(e)} />)}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <Text style={styles.backBtnText}>← Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtn} onPress={() => {
              if (!activityLevel || !experienceLevel) { Alert.alert('Faltan datos', 'Selecciona nivel de actividad y experiencia.'); return; }
              setStep(3);
            }}>
              <Text style={styles.nextBtnText}>Siguiente →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* PASO 3: Objetivo y lesiones */}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 3 / 3 — Objetivo y Salud</Text>

          <Text style={styles.label}>¿Cuál es tu objetivo principal? *</Text>
          <View style={styles.column}>
            {OBJETIVOS.map(o => <SelectorButton key={o} label={o} selected={goal === o} onPress={() => setGoal(o)} />)}
          </View>

          <Text style={styles.label}>Lesiones o limitaciones físicas (opcional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Ej: Dolor en rodilla derecha, hernia lumbar..."
            placeholderTextColor="#444"
            multiline
            value={injuries}
            onChangeText={setInjuries}
          />

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
              <Text style={styles.backBtnText}>← Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={loading}>
              {loading ? <ActivityIndicator color="#18181b" /> : <Text style={styles.finishBtnText}>{isEditing ? '💾 Guardar cambios' : '¡Comenzar! ⚡'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 38, fontWeight: 'bold', color: '#39ff14', textAlign: 'center', textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  subtitle: { fontSize: 15, color: '#00eaff', textAlign: 'center', marginTop: 10, marginBottom: 30, lineHeight: 22, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  card: { backgroundColor: '#232946', borderRadius: 15, padding: 20, shadowColor: '#ff00c8', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#ff00c8', marginBottom: 8, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  cardDesc: { fontSize: 13, color: '#aaa', marginBottom: 16, lineHeight: 20 },
  cancelTopBtn: { alignSelf: 'flex-end', marginBottom: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#ff00c8' },
  cancelTopBtnText: { color: '#ff00c8', fontWeight: 'bold', fontSize: 13 },
  label: { fontSize: 14, fontWeight: '600', color: '#39ff14', marginBottom: 8, marginTop: 12, textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 },
  input: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#00eaff', borderRadius: 8, padding: 12, fontSize: 16, color: '#39ff14', marginBottom: 5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 5 },
  column: { flexDirection: 'column', gap: 8, marginBottom: 5 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#00eaff', backgroundColor: '#18181b', marginBottom: 4 },
  optionBtnActive: { backgroundColor: '#ff00c8', borderColor: '#ff00c8', shadowColor: '#ff00c8', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2 },
  optionText: { color: '#00eaff', fontWeight: '600', fontSize: 14 },
  optionTextActive: { color: '#18181b', textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  nextBtn: { backgroundColor: '#39ff14', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', shadowColor: '#39ff14', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2, marginTop: 20 },
  nextBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 16 },
  backBtn: { backgroundColor: '#232946', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: '#00eaff' },
  backBtnText: { color: '#00eaff', fontWeight: 'bold', fontSize: 15 },
  finishBtn: { backgroundColor: '#39ff14', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', shadowColor: '#39ff14', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2 },
  finishBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 16 },
  specialistCard: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#00eaff', borderRadius: 10, padding: 12, marginBottom: 8 },
  specialistCardActive: { borderColor: '#39ff14', backgroundColor: '#0d2218', shadowColor: '#39ff14', shadowOpacity: 0.5, shadowRadius: 8, elevation: 3 },
  specialistRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  specialistLabel: { fontSize: 14, fontWeight: 'bold', color: '#00eaff', flex: 1 },
  specialistLabelActive: { color: '#39ff14' },
  specialistDesc: { fontSize: 12, color: '#666', marginTop: 4, lineHeight: 17 },
  specialistDescActive: { color: '#aaa' },
  checkmark: { color: '#39ff14', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
});
