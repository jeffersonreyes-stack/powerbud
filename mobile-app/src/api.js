import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// USANDO VARIABLES DE ENTORNO EN LA NUBE (OBLIGATORIO PARA PRODUCCIÓN)
// El dominio donde vive el servidor Node.js (ej. Render, AWS, Heroku)
// Revisa mobile-app/.env.example para configurarlo si estás compilando tu APK/IPA
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.tu-servidor-cloud.com/api';

const api = axios.create({
  baseURL: API_URL,
});

// Interceptor para inyectar automáticamente el Token de Seguridad (JWT) en cada petición
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error recuperando token de seguridad', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
