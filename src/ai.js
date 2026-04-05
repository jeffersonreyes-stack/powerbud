const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('Advertencia: GEMINI_API_KEY no está configurada en las variables de entorno.');
}

const genAI = new GoogleGenerativeAI(apiKey || 'dummy-key-for-dev');

// ── Rol especializado según el objetivo del usuario ───────────────────────── 
function getSpecialistRole(goal) {
  const g = (goal || '').toLowerCase();
  if (g.includes('hipertrofia') || g.includes('músculo') || g.includes('masa'))
    return 'especialista en hipertrofia muscular certificado (CSCS, NSCA), con 15 años de experiencia en periodización para ganancia de masa magra';
  if (g.includes('fuerza') || g.includes('potencia') || g.includes('powerlifting') || g.includes('halterofilia'))
    return 'preparador físico especializado en deportes de fuerza (powerlifting, halterofilia) y periodización ondulante, con expertise en programas conjugados y westside';
  if (g.includes('pérdida') || g.includes('bajar') || g.includes('grasa') || g.includes('definición') || g.includes('corte'))
    return 'especialista en recomposición corporal y pérdida de grasa, con formación en nutrición deportiva y estrategias de déficit calórico controlado que preservan la masa muscular';
  if (g.includes('resistencia') || g.includes('cardio') || g.includes('aeróbico') || g.includes('maraton') || g.includes('triatlón'))
    return 'entrenador de resistencia y atletismo certificado (IAAF), especializado en periodización para deportes de fondo, VO2max y umbral de lactato';
  if (g.includes('rehabilitación') || g.includes('lesión') || g.includes('fisio'))
    return 'fisioterapeuta deportivo y entrenador certificado en ejercicio terapéutico, con especialización en readaptación deportiva y prevención de lesiones';
  if (g.includes('funcional') || g.includes('crossfit') || g.includes('atlético'))
    return 'entrenador de fitness funcional y acondicionamiento atlético, especializado en movimientos compuestos, movilidad y desarrollo de capacidades físicas generales';
  // default
  return 'entrenador personal certificado (ACSM, NSCA) con amplia experiencia en programas de acondicionamiento físico general y mejora de la salud';
}

const aiService = {
  async generateWorkoutPlan(clientProfile, progressData = {}) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
      });

      const {
        age, weight_kg, height_cm, goal,
        days_per_week, experience_level, injuries
      } = clientProfile;

      const specialistRole = getSpecialistRole(goal);

      // ── PROMPT 1: Generación del plan ──────────────────────────────────────
      const generationPrompt = `
Eres un ${specialistRole}, trabajando en la plataforma "PowerBud".
Tu misión es diseñar el mejor mesociclo posible de 6 semanas para este atleta, aplicando tu especialización al máximo.

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
1. Aplica los principios científicos específicos de tu especialización al diseño del mesociclo.
2. Progresión semanal clara: volumen, intensidad o densidad deben aumentar progresivamente.
3. Si hay ejercicios en el historial, construye la progresión desde los pesos máximos registrados.
4. Adapta estrictamente cada ejercicio para evitar agravar lesiones reportadas.
5. El enfoque de cada día debe reflejar tu especialidad y el objetivo del atleta.
6. RESPONDE ÚNICAMENTE CON JSON VÁLIDO. Cero texto antes o después del JSON.

Estructura JSON requerida:
{
  "workout_plan": {
    "goal": "...",
    "specialist_focus": "Descripción breve del enfoque especializado aplicado",
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
  "general_advice": "Consejo específico de tu especialización para maximizar los resultados del objetivo del atleta."
}`;

      const genResult = await model.generateContent(generationPrompt);
      const genText = genResult.response.text();
      const cleanGen = genText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const workoutPlan = JSON.parse(cleanGen);

      // ── PROMPT 2: Revisión y aprobación del plan ───────────────────────────
      const reviewPrompt = `
Eres un director técnico de metodología del entrenamiento en PowerBud, con doctorado en Ciencias del Deporte y 20 años de experiencia supervisando entrenadores.

Tu tarea es REVISAR y CORREGIR si es necesario el siguiente plan de entrenamiento antes de entregárselo al usuario.

PERFIL DEL ATLETA:
- Objetivo: ${goal || 'Mejorar condición física'}
- Experiencia: ${experience_level || 'Principiante'}
- Días disponibles: ${days_per_week || 3}/semana
- Lesiones: ${injuries || 'Ninguna'}
- ACWR: ${progressData.recovery?.acwr ?? 'sin datos'} (zona: ${progressData.recovery?.acwr_zone ?? 'desconocida'})

PLAN PROPUESTO:
${JSON.stringify(workoutPlan, null, 2)}

CRITERIOS DE REVISIÓN:
1. ¿Los ejercicios son apropiados para el nivel de experiencia? (Principiante no debería tener ejercicios olímpicos complejos)
2. ¿El volumen total es seguro y realista? (No más de 20 series por grupo muscular/semana para intermedios)
3. ¿Hay progresión clara y coherente entre semanas?
4. ¿Se respetan las lesiones reportadas?
5. ¿El ACWR justifica el volumen propuesto?
6. ¿El general_advice es realmente útil y específico para el objetivo?

Si el plan es correcto y seguro: devuélvelo tal cual.
Si hay correcciones necesarias: aplícalas directamente en el JSON.

RESPONDE ÚNICAMENTE CON EL JSON FINAL APROBADO. Sin explicaciones, sin texto adicional.`;

      const reviewResult = await model.generateContent(reviewPrompt);
      const reviewText = reviewResult.response.text();
      const cleanReview = reviewText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const approvedPlan = JSON.parse(cleanReview);

      return approvedPlan;

    } catch (error) {
      console.error('Error al generar la rutina con Gemini:', error);
      throw new Error('No se pudo generar la rutina de entrenamiento. Inténtalo de nuevo más tarde.');
    }
  },

  async generateDietPlan(clientProfile, workoutContext = {}, nutritionHistory = {}) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
      });

      const {
        age, sex, weight_kg, height_cm, activity_level,
        goal, experience_level, injuries
      } = clientProfile;

      const prompt = `
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

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const cleanJsonStr = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanJsonStr);

    } catch (error) {
      console.error('Error al generar el plan de dieta con Gemini:', error);
      throw new Error('No se pudo generar el plan de dieta. Inténtalo de nuevo más tarde.');
    }
  }
};

module.exports = aiService;
