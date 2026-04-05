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
  async generateWorkoutPlan(clientProfile) {
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

  async generateDietPlan(clientProfile, workoutSummary) {
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

RUTINA ACTUAL:
${workoutSummary || 'Entrenamiento de fuerza e hipertrofia 4 días/semana'}

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
