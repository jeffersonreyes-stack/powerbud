import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

function normalizeApiUrl(url) {
  const cleanUrl = (url || '').trim().replace(/\/+$/, '');
  if (!cleanUrl) return '';
  return cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
}

function resolveDevApiUrl() {
  const scriptURL = NativeModules?.SourceCode?.scriptURL || '';
  const hostMatch = scriptURL.match(/https?:\/\/([^/:]+)/i);
  const metroHost = hostMatch?.[1];

  if (metroHost && metroHost !== 'localhost' && metroHost !== '127.0.0.1') {
    return `http://${metroHost}:3000/api`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000/api';
  }

  return 'http://127.0.0.1:3000/api';
}

// En producción usa EXPO_PUBLIC_API_URL.
// En desarrollo, si no existe, intentamos usar automáticamente la misma IP del Metro/Expo para que funcione en el celular.
const API_URL = normalizeApiUrl(process.env.EXPO_PUBLIC_API_URL) || resolveDevApiUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

console.log(`[PowerBud] API conectada a: ${API_URL}`);

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
