import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

export default function DashboardScreen({ setIsAuthenticated }) {
  const [user, setUser] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiWorkout, setAiWorkout] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [invitations, setInvitations] = useState([]);

  // Al cargar, recuperar información del usuario y el plan guardado
  useEffect(() => {
    const fetchUser = async () => {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (userInfo) {
        const parsedUser = JSON.parse(userInfo);
        setUser(parsedUser);
        if (parsedUser.role === 'client') {
          fetchInvitations();
          fetchSavedPlan();
        } else {
          setLoadingPlan(false);
        }
      }
    };
    fetchUser();
  }, []);

  const fetchSavedPlan = async () => {
    try {
      const res = await api.get('/v2/ai/workout-plan');
      if (res.data) setAiWorkout(res.data);
    } catch (e) {
      console.error('Error cargando plan guardado', e);
    } finally {
      setLoadingPlan(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await api.get('/v2/relations/invitations');
      setInvitations(response.data);
    } catch (error) {
      console.error('Error cargando invitaciones', error);
    }
  };

  const handleInvitation = async (trainerId, action) => {
    try {
      await api.post(`/v2/relations/invitations/${trainerId}/${action}`);
      Alert.alert('Éxito', action === 'accept' ? 'Has aceptado a este entrenador' : 'Invitación rechazada');
      fetchInvitations(); // Recargar lista
    } catch (error) {
      Alert.alert('Error', 'No se pudo procesar la invitación');
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userToken');
    await AsyncStorage.removeItem('userInfo');
    setIsAuthenticated(false);
  };

  // ¡EL BOTÓN MÁGICO! Llama a Google Gemini en el Backend sin chats ni fricción
  const generateMagicWorkout = async () => {
    setLoadingAI(true);
    try {
      const response = await api.post('/v2/ai/generate-workout');
      // El plan viene dentro de data.data
      const plan = response.data.data;
      setAiWorkout(plan);
      Alert.alert('✅ ¡Rutina generada!', 'Tu mesociclo de 6 semanas está listo y guardado.');
    } catch (error) {
      console.error('Error IA:', error.response?.data || error.message);
      Alert.alert('Error', 'La IA no pudo generar tu rutina. Verifica tu perfil e inténtalo de nuevo.');
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

      {/* Notificaciones de Invitaciones (Solo visible para clientes si tienen pendientes) */}
      {invitations.length > 0 && user?.role === 'client' && (
        <View style={styles.invitationCard}>
          <Text style={styles.invitationTitle}>🔔 ¡Tienes un Entrenador tocando la puerta!</Text>
          {invitations.map((inv) => (
            <View key={inv.trainer_id} style={styles.invitationRow}>
              <Text style={styles.invitationEmail}>{inv.trainer_email}</Text>
              <View style={styles.invitationActions}>
                <TouchableOpacity style={[styles.invBtn, {backgroundColor: '#2ecc71'}]} onPress={() => handleInvitation(inv.trainer_id, 'accept')}>
                  <Text style={styles.invBtnText}>Aceptar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.invBtn, {backgroundColor: '#e74c3c'}]} onPress={() => handleInvitation(inv.trainer_id, 'reject')}>
                  <Text style={styles.invBtnText}>Rechazar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Tarjeta de Inteligencia Artificial (Entrenador Virtual - Solo para clientes en el dashboard) */}
      {user?.role === 'client' && (
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
      )}

      {user?.role === 'trainer' && (
        <View style={styles.trainerWelcomeCard}>
           <Text style={styles.cardTitle}>Panel de Control</Text>
           <Text style={styles.cardDesc}>Bienvenido a tu panel de entrenador. Ve a la pestaña "Mis Clientes" para gestionar y asignar rutinas manuales o usar la IA para tus atletas.</Text>
        </View>
      )}

      {/* Plan de rutina - cargado desde DB o recién generado */}
      {loadingPlan ? (
        <ActivityIndicator color="#39ff14" style={{ marginTop: 20 }} />
      ) : aiWorkout ? (
        <View style={styles.resultCard}>
          <View style={styles.planHeader}>
            <Text style={styles.resultGoal}>🎯 {aiWorkout.workout_plan?.goal}</Text>
            <Text style={styles.planWeeks}>📅 {aiWorkout.workout_plan?.duration_weeks || 6} semanas</Text>
          </View>
          {aiWorkout.saved_at && (
            <Text style={styles.savedAt}>Generado: {new Date(aiWorkout.saved_at).toLocaleDateString('es-CO')}</Text>
          )}
          {aiWorkout.workout_plan?.progression_notes && (
            <Text style={styles.progressionText}>📈 {aiWorkout.workout_plan.progression_notes}</Text>
          )}

          {aiWorkout.workout_plan?.days?.map((day, index) => (
            <View key={index} style={styles.dayBox}>
              <Text style={styles.dayTitle}>Día {day.day_number}: {day.focus}</Text>
              {day.exercises?.map((ex, i) => (
                <View key={i} style={styles.exRow}>
                  <Text style={styles.exerciseText}>• {ex.name}</Text>
                  <Text style={styles.repsText}>{ex.sets} × {ex.reps}</Text>
                </View>
              ))}
            </View>
          ))}

          <Text style={styles.adviceText}>💡 {aiWorkout.general_advice}</Text>

          <TouchableOpacity style={styles.regenBtn} onPress={generateMagicWorkout} disabled={loadingAI}>
            {loadingAI
              ? <ActivityIndicator color="#18181b" />
              : <Text style={styles.regenBtnText}>🔄 Regenerar Rutina</Text>}
          </TouchableOpacity>
        </View>
      ) : null}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#18181b', // Cyberpunk dark
  },
  content: {
    padding: 20,
    paddingTop: 60,
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
    color: '#39ff14', // Neon green
    textShadowColor: '#00eaff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#ff00c8', // Neon pink
    borderRadius: 8,
    shadowColor: '#ff00c8',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 4,
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  emailText: {
    fontSize: 16,
    color: '#00eaff', // Neon blue
    marginBottom: 30,
    textShadowColor: '#39ff14',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  invitationCard: { backgroundColor: '#1a1a2e', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#fffb00', shadowColor: '#fffb00', shadowOpacity: 0.2, shadowRadius: 10, elevation: 2 },
  invitationTitle: { fontSize: 16, fontWeight: 'bold', color: '#fffb00', marginBottom: 10, textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  invitationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  invitationEmail: { fontSize: 14, color: '#00eaff', flex: 1, textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  invitationActions: { flexDirection: 'row' },
  invBtn: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5, marginLeft: 10, shadowColor: '#39ff14', shadowOpacity: 0.5, shadowRadius: 8, elevation: 2 },
  invBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12, textShadowColor: '#00eaff', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  trainerWelcomeCard: { backgroundColor: '#232946', borderRadius: 15, padding: 20, borderLeftWidth: 4, borderLeftColor: '#00eaff', shadowColor: '#00eaff', shadowOpacity: 0.2, shadowRadius: 10, elevation: 3 },
  aiCard: {
    backgroundColor: '#232946',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#ff00c8',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#ff00c8', // Neon pink
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#39ff14',
    marginBottom: 10,
    textShadowColor: '#ff00c8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  cardDesc: {
    fontSize: 15,
    color: '#00eaff',
    lineHeight: 22,
    marginBottom: 20,
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  magicButton: {
    backgroundColor: '#39ff14',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#39ff14',
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 4,
  },
  magicButtonText: {
    color: '#18181b',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  resultCard: {
    backgroundColor: '#1a1a2e',
    borderColor: '#ff00c8',
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    marginBottom: 40,
    shadowColor: '#ff00c8',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 2,
  },
  planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  planWeeks: { color: '#fffb00', fontWeight: 'bold', fontSize: 13 },
  savedAt: { color: '#555', fontSize: 11, marginBottom: 8, fontStyle: 'italic' },
  progressionText: { color: '#00eaff', fontSize: 13, marginBottom: 10, lineHeight: 18, fontStyle: 'italic' },
  exRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  regenBtn: { backgroundColor: '#232946', borderWidth: 1, borderColor: '#39ff14', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 14 },
  regenBtnText: { color: '#39ff14', fontWeight: 'bold', fontSize: 14 },
  resultGoal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fffb00',
    marginBottom: 15,
    textShadowColor: '#00eaff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  dayBox: {
    marginBottom: 15,
    backgroundColor: '#232946',
    padding: 10,
    borderRadius: 8,
    shadowColor: '#00eaff',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 1,
  },
  dayTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#ff00c8',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#39ff14',
    paddingBottom: 5,
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  exerciseText: {
    fontSize: 15,
    color: '#00eaff',
    marginBottom: 5,
    textShadowColor: '#ff00c8',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  repsText: {
    fontWeight: 'bold',
    color: '#39ff14',
    textShadowColor: '#fffb00',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  adviceText: {
    marginTop: 10,
    fontStyle: 'italic',
    color: '#fffb00',
    textShadowColor: '#00eaff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  }
});
