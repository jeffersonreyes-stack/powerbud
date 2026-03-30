import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

export default function DashboardScreen({ setIsAuthenticated }) {
  const [user, setUser] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiWorkout, setAiWorkout] = useState(null);

  // Al cargar, recuperar información del usuario de la bóveda
  useEffect(() => {
    const fetchUser = async () => {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (userInfo) {
        setUser(JSON.parse(userInfo));
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
    setIsAuthenticated(false);
  };

  // ¡EL BOTÓN MÁGICO! Llama a Google Gemini en el Backend sin chats ni fricción
  const generateMagicWorkout = async () => {
    setLoadingAI(true);
    setAiWorkout(null);
    try {
      // El backend de Powerbud ya sabe quiénes somos por el JWT (nuestro ID)
      // Él irá a PostgreSQL a buscar nuestro peso, metas y se lo mandará a Gemini.
      const response = await api.post('/ai/generate-workout');

      // Obtenemos el JSON estructurado devuelto por la Inteligencia Artificial
      setAiWorkout(response.data.data);
      Alert.alert('Éxito', response.data.message);

    } catch (error) {
      console.error('Error IA:', error.response?.data || error.message);
      Alert.alert('Ouch', 'La IA no pudo generar tu rutina. Intenta de nuevo más tarde.');
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {user?.role === 'trainer' ? 'Entrenador' : 'Atleta'}</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.emailText}>{user?.email}</Text>

      {/* Tarjeta de Inteligencia Artificial (Entrenador Virtual) */}
      <View style={styles.aiCard}>
        <Text style={styles.cardTitle}>🤖 Entrenador Virtual</Text>
        <Text style={styles.cardDesc}>
          Dejaremos que la Inteligencia Artificial analice tus últimos registros de peso y metas para crearte una rutina perfecta.
        </Text>

        <TouchableOpacity
          style={styles.magicButton}
          onPress={generateMagicWorkout}
          disabled={loadingAI}
        >
          {loadingAI ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.magicButtonText}>✨ Generar Rutina Mágica</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Mostrar el resultado del JSON estructurado de la IA de forma bonita */}
      {aiWorkout && (
        <View style={styles.resultCard}>
          <Text style={styles.resultGoal}>Objetivo: {aiWorkout.workout_plan?.goal}</Text>

          {aiWorkout.workout_plan?.days?.map((day, index) => (
            <View key={index} style={styles.dayBox}>
              <Text style={styles.dayTitle}>Día {day.day_number}: {day.focus}</Text>

              {day.exercises?.map((ex, i) => (
                <Text key={i} style={styles.exerciseText}>
                  • {ex.name}  <Text style={styles.repsText}>({ex.sets} sets x {ex.reps})</Text>
                </Text>
              ))}
            </View>
          ))}

          <Text style={styles.adviceText}>💡 {aiWorkout.general_advice}</Text>
        </View>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 20,
    paddingTop: 60, // Safe area (notch) manual para la demo
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#ffebeb',
    borderRadius: 8,
  },
  logoutText: {
    color: '#d9534f',
    fontWeight: 'bold',
  },
  emailText: {
    fontSize: 16,
    color: '#888',
    marginBottom: 30,
  },
  aiCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#9b59b6', // Púrpura IA
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  cardDesc: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 20,
  },
  magicButton: {
    backgroundColor: '#9b59b6',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  magicButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultCard: {
    backgroundColor: '#fdfbfe',
    borderColor: '#e8daef',
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    marginBottom: 40,
  },
  resultGoal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8e44ad',
    marginBottom: 15,
  },
  dayBox: {
    marginBottom: 15,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  dayTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#2c3e50',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 5,
  },
  exerciseText: {
    fontSize: 15,
    color: '#34495e',
    marginBottom: 5,
  },
  repsText: {
    fontWeight: 'bold',
    color: '#7f8c8d',
  },
  adviceText: {
    marginTop: 10,
    fontStyle: 'italic',
    color: '#555',
  }
});
