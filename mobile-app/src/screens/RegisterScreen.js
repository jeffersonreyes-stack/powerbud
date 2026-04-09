import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import api from '../api';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client'); // Por defecto es cliente normal
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email || !password) {
      Alert.alert('Error', 'Por favor llena todos los campos.');
      return;
    }

    setLoading(true);
    try {
      // Registrar en PostgreSQL
      await api.post('/auth/register', {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
      });

      Alert.alert(
        'Revisa tu correo 📧',
        'Cuenta creada exitosamente. Te enviamos un email de verificación. Revisa también spam o promociones antes de iniciar sesión.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );

    } catch (error) {
      console.error('Error Registro:', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.error || 'No se pudo crear la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Únete a Powerbud 💪</Text>
      <Text style={styles.subtitle}>Elige tu camino</Text>

      <View style={styles.roleSelector}>
        <TouchableOpacity
          style={[styles.roleButton, role === 'client' && styles.roleActive]}
          onPress={() => setRole('client')}
        >
          <Text style={[styles.roleText, role === 'client' && styles.roleTextActive]}>Soy Atleta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, role === 'trainer' && styles.roleActive]}
          onPress={() => setRole('trainer')}
        >
          <Text style={[styles.roleText, role === 'trainer' && styles.roleTextActive]}>Entrenador</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.roleButton, role === 'nutritionist' && styles.roleActive]}
          onPress={() => setRole('nutritionist')}
        >
          <Text style={[styles.roleText, role === 'nutritionist' && styles.roleTextActive]}>Nutricionista</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Tu nombre"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <TextInput
          style={styles.input}
          placeholder="Tu mejor correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña secreta"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Crear mi cuenta</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.loginLink}>
          <Text style={styles.loginText}>¿Ya tienes cuenta? Inicia sesión aquí</Text>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: '#39ff14', // Neon green
    marginBottom: 5,
    textShadowColor: '#ff00c8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#00eaff', // Neon blue
    marginBottom: 30,
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: '#232946',
    borderRadius: 10,
    padding: 4,
    shadowColor: '#00eaff',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  roleButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  roleActive: {
    backgroundColor: '#ff00c8',
    shadowColor: '#ff00c8',
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 2,
  },
  roleText: {
    fontSize: 16,
    color: '#00eaff',
    fontWeight: '600',
    textShadowColor: '#ff00c8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  roleTextActive: {
    color: '#18181b',
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
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
    backgroundColor: '#39ff14',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#39ff14',
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
  loginLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  loginText: {
    color: '#00eaff',
    textDecorationLine: 'underline',
    textShadowColor: '#ff00c8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  }
});
