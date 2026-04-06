import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import api from '../api';

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Ingresa tu correo electrónico.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al enviar el correo.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.icon}>📬</Text>
          <Text style={styles.title}>Correo enviado</Text>
          <Text style={styles.subtitle}>
            Si ese correo está registrado, recibirás un enlace para restablecer tu contraseña.{'\n\n'}Revisa tu bandeja de entrada y spam.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.btnText}>Volver al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.icon}>🔐</Text>
        <Text style={styles.title}>¿Olvidaste tu contraseña?</Text>
        <Text style={styles.subtitle}>Ingresa tu correo y te enviaremos un enlace para restablecerla.</Text>

        <TextInput
          style={styles.input}
          placeholder="correo@ejemplo.com"
          placeholderTextColor="#64748b"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#0f0f1a" />
            : <Text style={styles.btnText}>Enviar enlace</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>← Volver</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#1a1a2e', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, alignItems: 'center' },
  icon: { fontSize: 52, marginBottom: 12 },
  title: { color: '#f59e0b', fontSize: 22, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' },
  subtitle: { color: '#94a3b8', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  input: {
    width: '100%', backgroundColor: '#0f172a', color: '#fff', borderRadius: 10,
    padding: 14, fontSize: 16, borderWidth: 1, borderColor: '#334155', marginBottom: 16,
  },
  btn: {
    width: '100%', backgroundColor: '#f59e0b', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginBottom: 12,
  },
  btnText: { color: '#0f0f1a', fontWeight: 'bold', fontSize: 16 },
  back: { marginTop: 4 },
  backText: { color: '#6366f1', fontSize: 14 },
});
