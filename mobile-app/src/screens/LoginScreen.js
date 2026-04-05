import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

export default function LoginScreen({ navigation, setIsAuthenticated }) {
  const [email, setEmail] = useState('test@powerbud.com');
  const [password, setPassword] = useState('mypassword');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Por favor llena todos los campos.');
      return;
    }

    setLoading(true);
    try {
      // Hablar con el cerebro Node.js (Ruta de Auth)
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;

      // Guardar en la "bóveda" del celular
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userInfo', JSON.stringify(user));

      // Avisar a la app que entramos
      setIsAuthenticated(true);

    } catch (error) {
      console.error('Error Login:', error);
      Alert.alert('Error al Iniciar Sesión', 'Credenciales inválidas o no hay conexión con el servidor. ¿Revisaste la IP en api.js?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Powerbud 💪</Text>
      <Text style={styles.subtitle}>Tu entrenador de bolsillo</Text>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Correo Electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.registerLink}>
          <Text style={styles.registerText}>¿No tienes cuenta? Regístrate aquí</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b', // Cyberpunk dark
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#39ff14', // Neon green
    marginBottom: 5,
    textShadowColor: '#ff00c8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#00eaff', // Neon blue
    marginBottom: 40,
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  card: {
    width: '100%',
    backgroundColor: '#232946',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#ff00c8',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  input: {
    height: 50,
    borderColor: '#00eaff',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
    fontSize: 16,
    backgroundColor: '#232946',
    color: '#39ff14',
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  button: {
    backgroundColor: '#ff00c8',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#ff00c8',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonText: {
    color: '#18181b',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerText: {
    color: '#00eaff',
    textDecorationLine: 'underline',
    textShadowColor: '#ff00c8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  }
});
