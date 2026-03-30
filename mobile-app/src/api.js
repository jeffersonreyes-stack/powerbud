import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// IMPORTANTE: Cuando ejecutes Expo Go en tu celular físico, localhost (127.0.0.1) NO FUNCIONA
// porque localhost sería tu celular, no tu computadora donde está el cerebro de Node.js
//
// Para que tu celular hable con tu computadora (el servidor), debes poner aquí
// la Dirección IP LOCAL de tu computadora en la red Wi-Fi (ej. 192.168.1.50)
// o usar un servicio de túnel como ngrok si estás en redes diferentes.
const API_URL = 'http://192.168.1.100:3000/api'; // <--- CAMBIAR POR TU IP LOCAL

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
