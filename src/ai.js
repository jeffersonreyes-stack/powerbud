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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

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
        Necesito que diseñes una rutina de entrenamiento para un cliente con las siguientes características:

        - Edad: ${age || 'No especificada'} años
        - Peso: ${weight_kg || 'No especificado'} kg
        - Altura: ${height_cm || 'No especificada'} cm
        - Nivel de experiencia: ${experience_level || 'Principiante'}
        - Objetivo principal: ${goal || 'Mejorar condición física general'}
        - Días disponibles por semana: ${days_per_week || 3} días
        - Lesiones o limitaciones físicas: ${injuries || 'Ninguna reportada'}

        Instrucciones estrictas:
        1. La rutina debe estar adaptada a su nivel y objetivo, evitando agravar lesiones reportadas.
        2. Proporciona una rutina distribuida en los días solicitados (ej. Día 1: Pecho/Tríceps, Día 2: Espalda/Bíceps).
        3. Para cada día, lista los ejercicios incluyendo series (sets) y repeticiones (reps).
        4. DEVUELVE LA RESPUESTA ÚNICAMENTE EN FORMATO JSON VÁLIDO. No agregues texto antes ni después del JSON.
        5. La estructura del JSON debe ser exactamente esta:

        {
          "workout_plan": {
            "goal": "...",
            "days": [
              {
                "day_number": 1,
                "focus": "Pecho y Tríceps",
                "exercises": [
                  { "name": "Press de banca", "sets": 4, "reps": "8-12", "notes": "Mantener retracción escapular" }
                ]
              }
            ]
          },
          "general_advice": "Un consejo breve de motivación o nutrición."
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
  }
};

module.exports = aiService;
