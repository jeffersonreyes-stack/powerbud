const { GoogleGenerativeAI } = require('@google/generative-ai');

// Verifica que la API Key esté presente
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('Advertencia: GEMINI_API_KEY no está configurada en las variables de entorno.');
}

// Inicializa el cliente de Gemini
const genAI = new GoogleGenerativeAI(apiKey || 'dummy-key-for-dev');

/**
 * Servicio de IA para Powerbud usando Google Gemini.
 * Genera una rutina de entrenamiento estructurada basada en los parámetros del cliente.
 */
const aiService = {
  async generateWorkoutPlan(clientProfile, progressData = {}) {
    try {
      // Usamos el modelo más capaz para generación de texto complejo
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        generationConfig: { thinkingConfig: { thinkingBudget: 0 } }
      });

      // Extraemos los datos del cliente para construir el prompt
      const {
        age,
        weight_kg,
        height_cm,
        goal, // ej: "hipertrofia", "pérdida de peso", "fuerza"
        days_per_week,
        experience_level, // ej: "principiante", "intermedio", "avanzado"
        injuries // ej: "dolor de rodilla izquierda" o "ninguna"
      } = clientProfile;

      // Construcción del Prompt Experto (Instrucciones para la IA)
      const prompt = `
        Actúa como un entrenador personal experto de élite y nutricionista deportivo de la plataforma "Powerbud".
        Necesito que diseñes un MESOCICLO COMPLETO DE 6 SEMANAS de entrenamiento para un cliente con las siguientes características:

        - Edad: ${age || 'No especificada'} años
        - Sexo: ${clientProfile.sex || 'No especificado'}
        - Peso: ${weight_kg || 'No especificado'} kg
        - Altura: ${height_cm || 'No especificada'} cm
        - Medida de cintura: ${clientProfile.waist_cm || 'No especificada'} cm
        - Medida de cuello: ${clientProfile.neck_cm || 'No especificado'} cm
        - Nivel de actividad física: ${clientProfile.activity_level || 'Moderado'}
        - Nivel de experiencia: ${experience_level || 'Principiante'}
        - Objetivo principal: ${goal || 'Mejorar condición física general'}
        - Días disponibles por semana: ${days_per_week || 3} días
        - Lesiones o limitaciones físicas: ${injuries || 'Ninguna reportada'}

        HISTORIAL DE PROGRESO REAL DEL USUARIO:
        ${progressData.bodyMetrics && progressData.bodyMetrics.length > 0
          ? `Peso corporal (registros recientes más antiguo → más reciente):
          ${progressData.bodyMetrics.map(m => `${m.date}: ${m.weight_kg} kg${m.sleep_hours ? ` | sueño: ${m.sleep_hours}h` : ''}${m.stress_level ? ` | estrés: ${m.stress_level}/5` : ''}${m.notes ? ` (${m.notes})` : ''}`).join(' | ')}
          Tendencia: ${progressData.bodyMetrics.length >= 2
            ? (progressData.bodyMetrics[progressData.bodyMetrics.length-1].weight_kg > progressData.bodyMetrics[0].weight_kg ? '⬆ Ganando peso' : '⬇ Bajando peso')
            : 'Datos insuficientes'}`
          : 'Sin registros de peso aún.'}
        ${progressData.exerciseProgress && progressData.exerciseProgress.length > 0
          ? `Ejercicios con progreso registrado (máximo peso levantado y sesiones):
          ${progressData.exerciseProgress.map(e => `${e.exercise}: ${e.max_weight}kg máx, ${e.sessions} sesiones, último: ${e.last_date}`).join(' | ')}`
          : 'Sin historial de ejercicios aún.'}

        TASA DE RECUPERACIÓN:
        ACWR (Acute:Chronic Workload Ratio): ${progressData.recovery?.acwr !== null && progressData.recovery?.acwr !== undefined ? `${progressData.recovery.acwr} (zona: ${progressData.recovery.acwr_zone})` : 'sin datos'}
        - Zona óptima: 0.8-1.3 | Precaución: 1.3-1.5 | Sobreentrenamiento: >1.5
        Sueño promedio últimos 7 días: ${progressData.recovery?.avg_sleep ? `${progressData.recovery.avg_sleep}h (recomendado: 7-9h)` : 'sin datos'}
        Nivel de estrés promedio: ${progressData.recovery?.avg_stress ? `${progressData.recovery.avg_stress}/5` : 'sin datos'}
        IMPORTANTE: Si el ACWR está en zona de precaución o sobreentrenamiento, reduce el volumen total del mesociclo las primeras 2 semanas e incluye una semana de descarga (deload) en la semana 3. Si el sueño es menor a 7h, agrega notas específicas sobre la importancia del descanso y reduce la intensidad sugerida.

        IMPORTANTE: Usa el historial de progreso para adaptar la rutina. Si hay ejercicios ya dominados, aplica progresión desde el peso máximo registrado. Si hay lesiones en las notas de peso, tenlas en cuenta estrictamente.

        Instrucciones estrictas:
        1. El mesociclo debe tener progresión de 6 semanas (aumenta intensidad/volumen progresivamente).
        2. La rutina debe estar adaptada a su nivel, sexo y objetivo, evitando agravar lesiones reportadas.
        3. Proporciona una rutina semanal base (que se repite con progresión cada semana) distribuida en los días solicitados.
        4. Para cada día, lista los ejercicios incluyendo series (sets) y repeticiones (reps).
        5. Incluye notas de progresión por semana (ej: "Semana 3-4: Aumenta un 5% el peso").
        6. DEVUELVE LA RESPUESTA ÚNICAMENTE EN FORMATO JSON VÁLIDO. No agregues texto antes ni después del JSON.
        7. La estructura del JSON debe ser exactamente esta:

        {
          "workout_plan": {
            "goal": "...",
            "duration_weeks": 6,
            "progression_notes": "Descripción de cómo progresa el mesociclo semana a semana",
            "days": [
              {
                "day_number": 1,
                "focus": "Pecho y Tríceps",
                "exercises": [
                  { "name": "Press de banca", "sets": 4, "reps": "8-12", "notes": "Semana 1-2: 60% RM. Semana 3-4: 70% RM. Semana 5-6: 75% RM" }
                ]
              }
            ]
          },
          "general_advice": "Un consejo breve de motivación o nutrición específico para el objetivo del cliente."
        }
      `;

      // Llamamos a la API de Gemini
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // Limpiamos la respuesta por si Gemini incluye bloques de código markdown (```json ... ```)
      const cleanJsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

      // Parseamos la respuesta a un objeto JavaScript
      const workoutPlan = JSON.parse(cleanJsonStr);

      return workoutPlan;

    } catch (error) {
      console.error('Error al generar la rutina con la IA de Gemini:', error);
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
