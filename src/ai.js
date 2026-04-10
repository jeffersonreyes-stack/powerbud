const { GoogleGenAI } = require('@google/genai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('Advertencia: GEMINI_API_KEY no está configurada en las variables de entorno.');
}

const genAI = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-for-dev' });

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

async function generateWithRetry(contents, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await genAI.models.generateContent({ model: GEMINI_MODEL, contents });
      return result.text;
    } catch (err) {
      const status = err?.status ?? err?.errorDetails?.[0]?.reason;
      if ((err?.message?.includes('503') || err?.message?.includes('UNAVAILABLE')) && i < retries - 1) {
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE ASISTENTES IA — disponibles para selección del entrenador
// Cada entrada: { label (UI), role (contexto del prompt), methodology (énfasis técnico) }
// ══════════════════════════════════════════════════════════════════════════════
const AI_SPECIALISTS = {
  hipertrofia: {
    label: '💪 Especialista en Hipertrofia',
    role: 'especialista en hipertrofia muscular certificado (CSCS, NSCA), con 15 años de experiencia aplicando periodización científica (DUP, HST, Renaissance Periodization) para ganancia de masa magra',
    methodology: 'Prioriza rango de repeticiones 6-15, tiempo bajo tensión, volumen por grupo muscular (12-20 series/semana), técnicas de intensidad (drop sets, myo-reps). Progresión de carga doble o por tiempo bajo tensión.',
  },
  powerlifting: {
    label: '🏋️ Coach de Powerlifting',
    role: 'coach de powerlifting certificado por la IPF, especialista en periodización para sentadilla, press banca y peso muerto, con experiencia en programas 5/3/1, Texas Method y Sheiko',
    methodology: 'Enfoque en los 3 levantamientos principales. Periodicidad 3-5 días. Rangos de intensidad 70-95% 1RM. Progresión linear o por bloques. Variantes de competencia y accesorios de asistencia.',
  },
  halterofilia: {
    label: '🥇 Coach de Halterofilia',
    role: 'entrenador de halterofilia certificado (IWF), especialista en arrancada y cargada y envión, con experiencia en programas búlgaros, soviéticos y de la CCCP adaptados al atleta moderno',
    methodology: 'Levantamientos olímpicos como núcleo. Técnica antes que carga. Variantes: tirones, sentadillas frontales, posición de recepción. Alta frecuencia (4-6 días). Progresión técnica y de fuerza en paralelo.',
  },
  fuerza_funcional: {
    label: '⚡ Entrenador Funcional / CrossFit',
    role: 'entrenador de fitness funcional de alto rendimiento, certificado CrossFit L2, especialista en acondicionamiento metabólico, movimientos gymnásticos y levantamientos olímpicos en formato WOD',
    methodology: 'WODs mixtos de cardio + fuerza + gimnásticos. Escalado individualizado. Énfasis en movilidad articular. MetCons, AMRAPs, EMOMs. Variedad alta para evitar adaptación.',
  },
  perdida_grasa: {
    label: '🔥 Especialista en Pérdida de Grasa',
    role: 'especialista en recomposición corporal y pérdida de grasa, certificado en nutrición deportiva (ISSN), con metodología de circuitos de resistencia + HIIT que preservan masa muscular en déficit calórico',
    methodology: 'Circuitos de fuerza con cardio intervalado. Densidad alta (descansos cortos 45-90s). Superset de grupos antagonistas. Cardio LISS como complemento. Preservación muscular en déficit.',
  },
  resistencia: {
    label: '🏃 Entrenador de Resistencia y Atletismo',
    role: 'entrenador de resistencia certificado (IAAF Level 2), especialista en desarrollo aeróbico, VO2max, umbral de lactato y periodización para deportes de fondo (5K, 10K, media maratón, maratón, triatlón)',
    methodology: 'Entrenamiento polarizado 80/20. Zonas de frecuencia cardíaca. Long slow distance + intervalos de alta intensidad. Fuerza de soporte como complemento. Mesociclos de base, velocidad y específico.',
  },
  rehabilitacion: {
    label: '🩺 Especialista en Rehabilitación Deportiva',
    role: 'fisioterapeuta deportivo y entrenador certificado en ejercicio terapéutico (ACSM-CEP), con especialización en readaptación deportiva, prevención de recaídas y retorno progresivo al rendimiento',
    methodology: 'Progresión cautelosa y controlada. Énfasis en control motor, estabilización articular y movilidad. Sin movimientos de impacto hasta alcanzar umbrales de seguridad. Trabajo bilateral compensatorio.',
  },
  calistenia: {
    label: '🤸 Coach de Calistenia',
    role: 'coach de calistenia y street workout, especialista en progresión de habilidades de peso corporal (muscle up, front lever, planche, pistol squat) y fuerza relativa sin equipamiento',
    methodology: 'Progresiones de peso corporal por niveles (regresiones y progresiones). Skills: estática, dinámica y de fuerza. Volume work + skill training separados. Movilidad y elasticidad como base.',
  },
  deporte_combate: {
    label: '🥊 Preparador Físico de Deportes de Combate',
    role: 'preparador físico especializado en deportes de combate (MMA, boxeo, jiu-jitsu, muay thai), con expertise en acondicionamiento específico, potencia explosiva y gestión de peso para competencia',
    methodology: 'Potencia y fuerza explosiva como prioridad. Cardio de alta intensidad anaeróbica. Periodización hacia pelea o competencia. Trabajo de core anti-rotacional. Sin fatigar antes de sesiones técnicas.',
  },
  atletismo_velocidad: {
    label: '💨 Entrenador de Velocidad y Potencia',
    role: 'preparador físico de atletismo y velocidad, certificado USATF, especialista en desarrollo de fuerza explosiva, aceleración, velocidad máxima y mecánica de sprints para atletas de campo y pista',
    methodology: 'Pliometría, sprints y saltos como núcleo. Fuerza máxima como base de potencia. Técnica de carrera integrada. Potencia explosiva medida en watts. Períodos de peaking para competencia.',
  },
  adulto_mayor: {
    label: '👴 Entrenador para Adulto Mayor',
    role: 'especialista en ejercicio para adulto mayor y envejecimiento activo, certificado (ACSM Exercise Physiologist), con experiencia en prevención de sarcopenia, osteoporosis y caídas en personas mayores de 55 años',
    methodology: 'Ejercicios de bajo impacto con alta seguridad articular. Fuerza funcional: levantarse, empujar, jalar, equilibrio. Sin movimientos de alta velocidad ni impacto. Progresión conservadora. Mucho trabajo de core y equilibrio.',
  },
  general: {
    label: '🎯 Entrenador Personal General',
    role: 'entrenador personal certificado (ACSM, NSCA-CPT) con amplia experiencia en programas de acondicionamiento físico general, mejora de la salud y hábitos deportivos sostenibles a largo plazo',
    methodology: 'Balance entre fuerza, cardio y movilidad. Rango de reps variado (8-15). Progresión gradual. Ejercicios seguros y accesibles. Motivación y adherencia como pilares.',
  },
};

// ══════════════════════════════════════════════════════════════════════════════
// CATÁLOGO DE ESPECIALISTAS IA — para nutricionistas
// ══════════════════════════════════════════════════════════════════════════════
const NUTRI_SPECIALISTS = {
  deportiva: {
    label: '🏅 Nutricionista Deportivo',
    role: 'nutricionista especialista en rendimiento deportivo (ISSN Certified Sport Nutritionist), con experiencia en periodización nutricional para atletas de fuerza, resistencia y deportes de equipo',
    methodology: 'Periodización de carbohidratos alrededor del entrenamiento (carb timing, carb cycling). Proteína 1.6-2.2 g/kg. Estrategias de recuperación: glucógeno post-esfuerzo. Suplementación basada en evidencia (creatina, cafeína, beta-alanina).',
  },
  perdida_grasa: {
    label: '🔥 Especialista en Pérdida de Grasa',
    role: 'dietista-nutricionista especialista en recomposición corporal, con metodología de déficit calórico sostenible que preserva masa muscular y optimiza la adherencia a largo plazo',
    methodology: 'Déficit calórico moderado 300-500 kcal/día. Alta proteína (2.0-2.4 g/kg) para preservar músculo. Prioridad alimentos saciantes (fibra, proteína). Sin eliminación de grupos alimenticios. Manejo de antojos y hambre.',
  },
  ganancia_muscular: {
    label: '💪 Especialista en Volumen y Músculo',
    role: 'nutricionista especialista en hipertrofia muscular y ganancia de masa, con enfoque en superávit calórico limpio y timing de nutrientes para maximizar síntesis proteica muscular',
    methodology: 'Superávit 250-400 kcal/día controlado. Proteína 1.8-2.2 g/kg distribuida en 4-5 tomas. Carbohidratos peri-entrenamiento enfatizados. Grasas saludables sin restricción excesiva. Minimizar ganancia de grasa.',
  },
  clinica: {
    label: '🩺 Nutricionista Clínica',
    role: 'dietista-nutricionista clínica con especialización en manejo nutricional de patologías metabólicas (diabetes tipo 2, resistencia a la insulina, síndrome metabólico, hipertensión arterial)',
    methodology: 'Control glucémico mediante índice glucémico y carga glucémica. Distribución de macros adaptada a patología. Alimentos funcionales con evidencia clínica. Restricción de sodio y grasas saturadas cuando aplica. Coordinación con tratamiento médico.',
  },
  vegana: {
    label: '🌱 Especialista en Nutrición Vegana/Vegetariana',
    role: 'nutricionista especialista en plantas (Plant-Based Diet Dietitian), con expertise en cubrir todos los requerimientos nutricionales y de rendimiento sin productos de origen animal',
    methodology: 'Combinación proteica completa (legumbres + cereales). Suplementación esencial: B12, D3, omega-3 (DHA/EPA de algas), hierro, zinc, yodo. Alimentos fermentados para biodisponibilidad. Energía adecuada para el rendimiento.',
  },
  rendimiento: {
    label: '⚡ Nutrición para Alto Rendimiento',
    role: 'nutricionista de alto rendimiento con experiencia en selecciones nacionales y clubes profesionales, especialista en estrategias de hidratación, suplementación legal y nutrición en competencia',
    methodology: 'Carga de carbohidratos pre-competencia. Estrategias de hidratación y electrolitos. Gel y toma de energía durante eventos. Recuperación nutricional acelerada post-competencia. Control peso en deportes por categoría sin pérdida de rendimiento.',
  },
  pediatrica: {
    label: '👶 Nutricionista Pediátrica',
    role: 'nutricionista especialista en nutrición infantil y adolescente, con experiencia en crecimiento y desarrollo, alimentación selectiva, y nutrición en niños y jóvenes deportistas',
    methodology: 'Requerimientos según etapa de crecimiento (Dietary Reference Intakes). Introducción alimentaria progresiva. Neofobia y estrategias de aceptación. Deportistas jóvenes: soporte energético para crecer y rendir. Sin dietas restrictivas en menores.',
  },
  adulto_mayor: {
    label: '👴 Nutricionista para Adulto Mayor',
    role: 'nutricionista gerontológica especialista en necesidades nutricionales del envejecimiento, con experiencia en prevención de sarcopenia, osteoporosis y desnutrición en personas mayores de 60 años',
    methodology: 'Alta proteína (1.2-1.6 g/kg) para combatir sarcopenia. Calcio y vitamina D para huesos. Hidratación activa (sensación de sed reducida). Alimentos de fácil masticación y digestión. Vitamina B12 biodisponible. Calorías densas para apetito reducido.',
  },
  patologias: {
    label: '⚕️ Nutrición Terapéutica y Patologías',
    role: 'dietista-nutricionista especialista en terapia nutricional médica (MNT), con formación en manejo de múltiples patologías simultáneas: diabetes, enfermedad renal crónica, dislipidemia, obesidad y trastornos gastrointestinales',
    methodology: 'Adaptación de macros a función renal (restricción proteica si ERC). Control lipídico: fibra soluble, omega-3, esteroles vegetales. Manejo SIBO/intestino irritable: dieta low-FODMAP. Registro y análisis de analíticas para ajuste dinámico del plan.',
  },
  general_nutri: {
    label: '🥗 Nutricionista General',
    role: 'nutricionista-dietista generalista con enfoque en promoción de hábitos alimenticios saludables, educación nutricional y planes equilibrados adaptados a la realidad y preferencias del paciente',
    methodology: 'Plato saludable: 50% vegetales/fruta, 25% proteína magra, 25% carbohidratos complejos. Alimentos mínimamente procesados. Hidratación adecuada. Flexibilidad y adherencia a largo plazo como prioridad. Educación sobre etiquetado y compra inteligente.',
  },
};

function resolveNutriSpecialist(nutriSpecialist, clientGoal) {
  if (nutriSpecialist && NUTRI_SPECIALISTS[nutriSpecialist]) {
    return NUTRI_SPECIALISTS[nutriSpecialist];
  }
  // fallback: inferir del objetivo
  const g = (clientGoal || '').toLowerCase();
  if (g.includes('grasa') || g.includes('bajar') || g.includes('peso')) return NUTRI_SPECIALISTS.perdida_grasa;
  if (g.includes('músculo') || g.includes('masa') || g.includes('hipertrofia')) return NUTRI_SPECIALISTS.ganancia_muscular;
  if (g.includes('deport') || g.includes('rendimiento') || g.includes('atleta')) return NUTRI_SPECIALISTS.deportiva;
  if (g.includes('vegano') || g.includes('vegetariano') || g.includes('plant')) return NUTRI_SPECIALISTS.vegana;
  return NUTRI_SPECIALISTS.general_nutri;
}

// Devuelve el especialista correcto: si el entrenador definió uno, se usa ese.
// Si no, se infiere del objetivo del cliente (backward compatibility).
function resolveSpecialist(trainerSpecialist, clientGoal) {
  if (trainerSpecialist && AI_SPECIALISTS[trainerSpecialist]) {
    return AI_SPECIALISTS[trainerSpecialist];
  }
  // fallback: inferir del objetivo del cliente
  const g = (clientGoal || '').toLowerCase();
  if (g.includes('hipertrofia') || g.includes('músculo') || g.includes('masa')) return AI_SPECIALISTS.hipertrofia;
  if (g.includes('powerlifting')) return AI_SPECIALISTS.powerlifting;
  if (g.includes('halterofilia')) return AI_SPECIALISTS.halterofilia;
  if (g.includes('crossfit') || g.includes('funcional')) return AI_SPECIALISTS.fuerza_funcional;
  if (g.includes('pérdida') || g.includes('grasa') || g.includes('bajar') || g.includes('definición')) return AI_SPECIALISTS.perdida_grasa;
  if (g.includes('resistencia') || g.includes('cardio') || g.includes('maratón') || g.includes('triatlón')) return AI_SPECIALISTS.resistencia;
  if (g.includes('rehabilitación') || g.includes('lesión')) return AI_SPECIALISTS.rehabilitacion;
  if (g.includes('fuerza') || g.includes('potencia')) return AI_SPECIALISTS.powerlifting;
  return AI_SPECIALISTS.general;
}

function buildFallbackWorkoutPlan(clientProfile = {}, progressData = {}, trainerContext = {}) {
  const goal = clientProfile.goal || 'Mejorar condición física general';
  const specialist = resolveSpecialist(trainerContext.ai_specialist, goal);
  const requestedDays = Number.parseInt(clientProfile.days_per_week, 10);
  const totalDays = Math.min(Math.max(Number.isInteger(requestedDays) ? requestedDays : 3, 3), 5);
  const injuries = clientProfile.injuries || 'Ninguna reportada';
  const acwr = progressData?.recovery?.acwr;
  const lowRecovery = progressData?.recovery?.avg_sleep && Number(progressData.recovery.avg_sleep) < 7;
  const conservativeNote = acwr !== null && acwr !== undefined && Number(acwr) > 1.3;

  const templateDays = [
    {
      day_number: 1,
      focus: 'Fuerza de tren inferior',
      exercises: [
        { name: 'Sentadilla goblet o trasera', sets: conservativeNote ? 3 : 4, reps: '6-10', notes: 'Aumenta 1-2 repeticiones o 2.5 kg cuando completes el rango con buena técnica.' },
        { name: 'Peso muerto rumano', sets: 3, reps: '8-10', notes: 'Controla la bajada y mantén la espalda neutra.' },
        { name: 'Zancadas caminando', sets: 3, reps: '10-12 por pierna', notes: 'Descansa 60-75 segundos entre series.' },
        { name: 'Plancha frontal', sets: 3, reps: '30-45 s', notes: 'Prioriza estabilidad y respiración.' },
      ]
    },
    {
      day_number: 2,
      focus: 'Empuje y torso',
      exercises: [
        { name: 'Press de pecho con mancuernas', sets: conservativeNote ? 3 : 4, reps: '8-12', notes: 'Mantén un RPE 7-8.' },
        { name: 'Press militar sentado', sets: 3, reps: '8-10', notes: 'Evita dolor articular y controla la fase excéntrica.' },
        { name: 'Fondos asistidos o flexiones', sets: 3, reps: '10-15', notes: 'Progresión semanal por repeticiones.' },
        { name: 'Face pulls', sets: 3, reps: '12-15', notes: 'Úsalos para estabilidad escapular.' },
      ]
    },
    {
      day_number: 3,
      focus: 'Tirón y acondicionamiento',
      exercises: [
        { name: 'Jalón al pecho o dominadas asistidas', sets: conservativeNote ? 3 : 4, reps: '8-12', notes: 'Busca rango completo.' },
        { name: 'Remo con mancuerna', sets: 3, reps: '10-12', notes: 'Pausa un segundo arriba en cada repetición.' },
        { name: 'Curl femoral o puente de glúteo', sets: 3, reps: '12-15', notes: 'Mantén tensión constante.' },
        { name: 'Cardio moderado', sets: 1, reps: '12-20 min', notes: 'Zona 2 si tu objetivo es bajar grasa o mejorar capacidad aeróbica.' },
      ]
    },
    {
      day_number: 4,
      focus: 'Full body técnico',
      exercises: [
        { name: 'Peso muerto con kettlebell', sets: 3, reps: '8-10', notes: 'Carga submáxima, técnica limpia.' },
        { name: 'Press inclinado', sets: 3, reps: '8-12', notes: 'Deja 1-2 repeticiones en reserva.' },
        { name: 'Remo sentado', sets: 3, reps: '10-12', notes: 'Evita balanceos.' },
        { name: 'Farmer walk', sets: 3, reps: '30-40 m', notes: 'Fortalece agarre y core.' },
      ]
    },
    {
      day_number: 5,
      focus: 'Movilidad y recuperación activa',
      exercises: [
        { name: 'Bicicleta o caminata', sets: 1, reps: '20-30 min', notes: 'Intensidad suave.' },
        { name: 'Movilidad de cadera y hombro', sets: 2, reps: '8-10 min', notes: 'Prioriza articulaciones rígidas.' },
        { name: 'Trabajo de core anti-rotacional', sets: 3, reps: '10-12 por lado', notes: 'Respira y controla la postura.' },
      ]
    }
  ];

  const days = templateDays.slice(0, totalDays).map((day, index) => ({ ...day, day_number: index + 1 }));

  return {
    workout_plan: {
      goal,
      specialist_type: trainerContext.ai_specialist || 'general',
      specialist_focus: `Plan de respaldo basado en ${specialist.label} con progresión segura y sostenible.`,
      trainer_notes: trainerContext.trainer_instructions || 'Plan de respaldo generado automáticamente por PowerBud.',
      duration_weeks: 6,
      progression_notes: conservativeNote
        ? 'Semanas 1-2: volumen moderado para favorecer recuperación. Semanas 3-4: aumenta una serie en los ejercicios principales. Semanas 5-6: sube la carga 2.5-5% si mantienes buena técnica.'
        : 'Semanas 1-2: domina técnica y rango de repeticiones. Semanas 3-4: aumenta 1 serie o 2 repeticiones por ejercicio base. Semanas 5-6: sube la carga 2.5-5% manteniendo 1-2 repeticiones en reserva.',
      days,
    },
    general_advice: `Recuperación: ${lowRecovery ? 'prioriza dormir más de 7 horas antes de subir intensidad.' : 'mantén 7-9 horas de sueño y buena hidratación.'} Lesiones reportadas: ${injuries}. Ajusta cualquier ejercicio que cause dolor.`
  };
}

const aiService = {
  // trainerContext = { ai_specialist, trainer_instructions, trainer_name }
  async generateWorkoutPlan(clientProfile, progressData = {}, trainerContext = {}) {
    if (!apiKey) {
      console.warn('[AI] Usando plan de respaldo: GEMINI_API_KEY no configurada.');
      return buildFallbackWorkoutPlan(clientProfile, progressData, trainerContext);
    }

    try {
      const {
        age, weight_kg, height_cm, goal,
        days_per_week, experience_level, injuries
      } = clientProfile;

      const specialist = resolveSpecialist(trainerContext.ai_specialist, goal);
      const trainerInstructions = trainerContext.trainer_instructions || null;
      const trainerName = trainerContext.trainer_name || null;

      // ── PROMPT 1: Generación del plan ──────────────────────────────────────
      const generationPrompt = `
IDENTIDAD Y ROL:
Eres un ${specialist.role}, operando como asistente de IA en la plataforma "PowerBud".
${trainerName ? `El entrenador humano responsable de este cliente es "${trainerName}", quien ha configurado tu rol y metodología. Tu plan será revisado y aprobado por él antes de entregarse al cliente.` : 'Tu plan pasará por una revisión técnica antes de entregarse al cliente.'}
Tu enfoque metodológico para este plan: ${specialist.methodology}

Aplica tu especialización de forma precisa, coherente y científicamente fundamentada en cada decisión de diseño.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERFIL COMPLETO DEL ATLETA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Edad: ${age || 'No especificada'} años
- Sexo: ${clientProfile.sex || 'No especificado'}
- Peso: ${weight_kg || 'No especificado'} kg
- Altura: ${height_cm || 'No especificada'} cm
- Cintura: ${clientProfile.waist_cm || 'No especificada'} cm
- Cuello: ${clientProfile.neck_cm || 'No especificado'} cm
- Nivel de actividad: ${clientProfile.activity_level || 'Moderado'}
- Experiencia: ${experience_level || 'Principiante'}
- OBJETIVO PRINCIPAL: ${goal || 'Mejorar condición física general'}
- Días disponibles: ${days_per_week || 3} días/semana
- Lesiones o limitaciones: ${injuries || 'Ninguna reportada'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${trainerInstructions ? `INSTRUCCIONES ESPECÍFICAS DEL ENTRENADOR (OBLIGATORIO CUMPLIR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${trainerInstructions}

Estas instrucciones tienen PRIORIDAD MÁXIMA sobre cualquier consideración general. El entrenador humano conoce al cliente y sus requerimientos superan los valores por defecto.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ''}
HISTORIAL DE PROGRESO REAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${progressData.bodyMetrics && progressData.bodyMetrics.length > 0
  ? `Peso corporal (antiguo → reciente):
${progressData.bodyMetrics.map(m => `  ${m.date}: ${m.weight_kg}kg${m.sleep_hours ? ` | sueño: ${m.sleep_hours}h` : ''}${m.stress_level ? ` | estrés: ${m.stress_level}/5` : ''}${m.notes ? ` | nota: ${m.notes}` : ''}`).join('\n')}
Tendencia: ${progressData.bodyMetrics.length >= 2
    ? (progressData.bodyMetrics[progressData.bodyMetrics.length-1].weight_kg > progressData.bodyMetrics[0].weight_kg ? '⬆ Ganando peso' : '⬇ Bajando peso')
    : 'Datos insuficientes'}`
  : 'Sin registros de peso aún.'}

${progressData.exerciseProgress && progressData.exerciseProgress.length > 0
  ? `Historial de ejercicios (peso máx, sesiones, último registro):
${progressData.exerciseProgress.map(e => `  ${e.exercise}: ${e.max_weight}kg máx | ${e.sessions} sesiones | último: ${e.last_date}`).join('\n')}`
  : 'Sin historial de ejercicios registrado.'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ESTADO DE RECUPERACIÓN (ACWR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACWR: ${progressData.recovery?.acwr !== null && progressData.recovery?.acwr !== undefined ? `${progressData.recovery.acwr} (zona: ${progressData.recovery.acwr_zone})` : 'sin datos'}
Referencia: <0.8 = desentrenamiento | 0.8-1.3 = óptimo | 1.3-1.5 = precaución | >1.5 = sobreentrenamiento
Sueño promedio 7 días: ${progressData.recovery?.avg_sleep ? `${progressData.recovery.avg_sleep}h` : 'sin datos'} (recomendado: 7-9h)
Estrés promedio: ${progressData.recovery?.avg_stress ? `${progressData.recovery.avg_stress}/5` : 'sin datos'}

CRITERIOS DE AJUSTE POR RECUPERACIÓN:
- Si ACWR > 1.3: Reduce volumen total 20-30% las primeras 2 semanas. Incluye semana de deload en semana 3.
- Si sueño < 7h: Reduce intensidad un nivel, añade notas específicas sobre recuperación en el plan.
- Si ACWR < 0.8: El atleta está desentrenado; empieza con volumen conservador y progresión gradual.
- Si todos los datos son óptimos: Diseña el programa más efectivo posible para el objetivo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUCCIONES DE DISEÑO (OBLIGATORIAS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Aplica tu metodología específica (${specialist.methodology}) en cada decisión de diseño.
2. Progresión semanal clara: volumen, intensidad o densidad deben aumentar progresivamente.
3. Si hay ejercicios en el historial, construye la progresión desde los pesos máximos registrados.
4. Adapta estrictamente cada ejercicio para evitar agravar lesiones reportadas.
5. Si el entrenador dio instrucciones específicas, tienen prioridad máxima.
6. RESPONDE ÚNICAMENTE CON JSON VÁLIDO. Cero texto antes o después del JSON.

Estructura JSON requerida:
{
  "workout_plan": {
    "goal": "...",
    "specialist_type": "${trainerContext.ai_specialist || 'general'}",
    "specialist_focus": "Descripción del enfoque metodológico aplicado en este plan específico",
    "trainer_notes": "${trainerInstructions ? 'Instrucciones del entrenador aplicadas' : 'Plan generado por IA'}",
    "duration_weeks": 6,
    "progression_notes": "Cómo progresa el mesociclo semana a semana con métricas específicas",
    "days": [
      {
        "day_number": 1,
        "focus": "Nombre del día de entrenamiento",
        "exercises": [
          { "name": "Nombre del ejercicio", "sets": 4, "reps": "8-12", "notes": "Notas de progresión por semana" }
        ]
      }
    ]
  },
  "general_advice": "Consejo específico alineado con la metodología del especialista y el objetivo del atleta."
}`;

      const genText = await generateWithRetry(generationPrompt);
      const cleanGen = genText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const workoutPlan = JSON.parse(cleanGen);

      // ── PROMPT 2: Revisión por director técnico ────────────────────────────
      const reviewPrompt = `
Eres un director técnico de metodología del entrenamiento en PowerBud, con doctorado en Ciencias del Deporte y 20 años supervisando entrenadores.

CONTEXTO:
- Especialista IA que generó el plan: ${specialist.role}
- Metodología aplicada: ${specialist.methodology}
${trainerInstructions ? `- Instrucciones del entrenador humano que DEBEN respetarse: "${trainerInstructions}"` : ''}

PERFIL DEL ATLETA:
- Objetivo: ${goal || 'Mejorar condición física'}
- Experiencia: ${experience_level || 'Principiante'}
- Días disponibles: ${days_per_week || 3}/semana
- Lesiones: ${injuries || 'Ninguna'}
- ACWR: ${progressData.recovery?.acwr ?? 'sin datos'} (zona: ${progressData.recovery?.acwr_zone ?? 'desconocida'})

PLAN PROPUESTO:
${JSON.stringify(workoutPlan, null, 2)}

CRITERIOS DE REVISIÓN:
1. ¿Los ejercicios son coherentes con la metodología ${specialist.label}?
2. ¿El nivel de complejidad es apropiado para la experiencia del atleta?
3. ¿El volumen es seguro y realista para los días disponibles?
4. ¿Se respetan las lesiones reportadas?
5. ¿El ACWR justifica el volumen propuesto?
${trainerInstructions ? `6. ¿Las instrucciones del entrenador "${trainerInstructions}" están correctamente applied?` : ''}

Si el plan es correcto: devuélvelo tal cual.
Si necesita correcciones: aplícalas directamente.
RESPONDE ÚNICAMENTE CON EL JSON FINAL. Sin texto adicional.`;

      const reviewText = await generateWithRetry(reviewPrompt);
      const cleanReview = reviewText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanReview);

    } catch (error) {
      console.error('Error al generar la rutina con Gemini:', error);
      return buildFallbackWorkoutPlan(clientProfile, progressData, trainerContext);
    }
  },

  async generateDietPlan(clientProfile, workoutContext = {}, nutritionHistory = {}, nutritionistContext = {}) {
    try {
      const {
        age, sex, weight_kg, height_cm, activity_level,
        goal, experience_level, injuries
      } = clientProfile;

      // Resolver especialista nutricional
      const nutriSpec = resolveNutriSpecialist(nutritionistContext.ai_specialist, goal);

      const nutriContextBlock = (nutritionistContext.nutritionist_instructions || nutritionistContext.ai_specialist)
        ? `
ESPECIALISTA NUTRICIONAL ASIGNADO: ${nutriSpec.label}
ROL: Eres ${nutriSpec.role}.
METODOLOGÍA A APLICAR: ${nutriSpec.methodology}
${nutritionistContext.nutritionist_name ? `NUTRICIONISTA RESPONSABLE: ${nutritionistContext.nutritionist_name}` : ''}
${nutritionistContext.nutritionist_instructions
  ? `\nINSTRUCCIONES ESPECÍFICAS DEL NUTRICIONISTA (OBLIGATORIO APLICAR CON PRIORIDAD MÁXIMA):
${nutritionistContext.nutritionist_instructions}
Estas instrucciones del nutricionista tienen prioridad sobre cualquier sugerencia genérica. Respétalas al pie de la letra.`
  : ''}
`
        : '';

      const prompt = `
${nutriContextBlock}
Eres un nutricionista deportivo experto en alimentación colombiana. Crea un plan de dieta semanal personalizado basado en el siguiente perfil:

PERFIL DEL ATLETA:
- Edad: ${age || 'No especificada'}
- Sexo: ${sex || 'No especificado'}
- Peso: ${weight_kg || 'No especificado'} kg
- Altura: ${height_cm || 'No especificada'} cm
- Nivel de actividad: ${activity_level || 'Moderado'}
- Objetivo principal: ${goal || 'Mejorar condición física'}
- Nivel de experiencia: ${experience_level || 'Intermedio'}
- Lesiones/limitaciones: ${injuries || 'Ninguna'}

HISTORIAL NUTRICIONAL REAL (últimos 7 días):
${nutritionHistory.dailySummary && nutritionHistory.dailySummary.length > 0
  ? nutritionHistory.dailySummary.map(d => `${d.date}: ${d.calories} kcal, proteína ${d.protein_g}g, carbos ${d.carbs_g}g, grasas ${d.fat_g}g`).join('\n')
  : 'Sin registros de comidas aún.'}
${nutritionHistory.avgCalories ? `Promedio consumido: ${nutritionHistory.avgCalories} kcal/día, proteína ${nutritionHistory.avgProtein}g/día` : ''}
IMPORTANTE: Si el historial muestra déficit de proteína o exceso de calorías, ajusta el plan para corregir esos hábitos específicamente. Si no hay registros, diseña el plan desde cero.

RUTINA DE ENTRENAMIENTO:
Objetivo del mesociclo: ${workoutContext.mesocycleGoal || 'No especificado'}
Estructura semanal: ${workoutContext.trainingDays || 'No disponible'}
Notas de progresión: ${workoutContext.progressionNotes || 'No disponible'}
${workoutContext.recentLogs && workoutContext.recentLogs.length > 0
  ? `Registros reales de entrenamientos (últimas 3 semanas, más reciente primero):
${workoutContext.recentLogs.slice(0, 20).map(l => `  ${l.date} — ${l.exercise}: ${l.weight}kg x ${l.reps} reps (volumen: ${Math.round(l.volumen)})`).join('\n')}`
  : 'Sin registros de entrenamiento aún.'}

TASA DE RECUPERACIÓN:
ACWR: ${workoutContext.recovery?.acwr !== null && workoutContext.recovery?.acwr !== undefined ? `${workoutContext.recovery.acwr} (zona: ${workoutContext.recovery.acwr_zone})` : 'sin datos'}
Sueño promedio: ${workoutContext.recovery?.avg_sleep ? `${workoutContext.recovery.avg_sleep}h` : 'sin datos'} | Estrés promedio: ${workoutContext.recovery?.avg_stress ? `${workoutContext.recovery.avg_stress}/5` : 'sin datos'}
IMPORTANTE: Si el ACWR supera 1.3 o el sueño es menor a 7h, el usuario está en déficit de recuperación. En ese caso incrementa las calorías totales en un 8-12%, prioriza carbohidratos de fácil digestión post-entreno y agrega alimentos ricos en magnesio y triptofano (banano, leche, nueces) para mejorar la calidad del sueño.

INSTRUCCIONES:
1. Usa EXCLUSIVAMENTE alimentos comunes y accesibles en Colombia (arroz, frijoles, plátano, papa, aguacate, pollo, carne, huevos, leche, queso, frutas tropicales, etc.)
2. Calcula los macros diarios según el objetivo y el peso corporal
3. Distribuye las comidas en 5 tiempos: desayuno, media mañana, almuerzo, merienda, cena
4. Especifica porciones en gramos o unidades prácticas
5. Incluye opciones económicas y fáciles de preparar
6. Los macros deben ser REALISTAS y alcanzables

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques de código markdown:
{
  "daily_targets": {
    "calories": 2200,
    "protein_g": 150,
    "carbs_g": 250,
    "fat_g": 70
  },
  "weekly_plan": [
    {
      "day": "Lunes",
      "meals": [
        {
          "time": "Desayuno",
          "foods": ["2 huevos revueltos", "2 arepas de maíz", "1 taza de café con leche"],
          "calories": 450,
          "protein_g": 28,
          "carbs_g": 45,
          "fat_g": 15
        }
      ],
      "day_totals": { "calories": 2200, "protein_g": 150, "carbs_g": 250, "fat_g": 70 }
    }
  ],
  "shopping_tips": "Consejos de compra económica en Colombia...",
  "general_advice": "Consejos generales de nutrición para el objetivo..."
}
`;

      const responseText = await generateWithRetry(prompt);
      const cleanJsonStr = responseText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      const firstBrace = cleanJsonStr.indexOf('{');
      const lastBrace = cleanJsonStr.lastIndexOf('}');
      const jsonOnly = firstBrace !== -1 ? cleanJsonStr.slice(firstBrace, lastBrace + 1) : cleanJsonStr;
      return JSON.parse(jsonOnly);

    } catch (error) {
      console.error('Error al generar el plan de dieta con Gemini:', error);
      throw new Error('No se pudo generar el plan de dieta. Inténtalo de nuevo más tarde.');
    }
  }
};

module.exports = aiService;
module.exports.AI_SPECIALISTS = AI_SPECIALISTS;
module.exports.NUTRI_SPECIALISTS = NUTRI_SPECIALISTS;
