import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, TextInput, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

export default function WorkoutScreen({ route }) {
  // `route.params.clientId` vendrá si un ENTRENADOR abre esta pantalla tocando un cliente.
  const targetClientId = route?.params?.clientId || null;

  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Estado para la edición y creación
  const [newExercise, setNewExercise] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newReps, setNewReps] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const userInfo = await AsyncStorage.getItem('userInfo');
      if (userInfo) setUserRole(JSON.parse(userInfo).role);
    };
    fetchUser();
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      // Si el entrenador pasó un ID de cliente, pídele sus rutinas al backend
      const url = targetClientId ? `/v2/workouts?client_id=${targetClientId}` : '/v2/workouts';
      const response = await api.get(url);
      setWorkouts(response.data);
    } catch (error) {
      console.error('Error cargando rutinas', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditWeight(item.weight.toString());
    setEditReps(item.reps.toString());
  };

  const saveEdit = async (item) => {
    try {
      const response = await api.put(`/v2/workouts/${item.id}`, {
        date: item.date,
        exercise: item.exercise,
        weight: Number(editWeight),
        reps: Number(editReps)
      });

      Alert.alert('Aviso', response.data.message); // Muestra si fue "marcada como personalizada"
      setEditingId(null);
      fetchWorkouts(); // Recargar
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo editar la rutina');
    }
  };

  const createWorkout = async () => {
    if (!newExercise || !newWeight || !newReps) {
      Alert.alert('Aviso', 'Completa ejercicio, peso y reps.');
      return;
    }

    try {
      await api.post('/v2/workouts', {
        date: new Date().toISOString().split('T')[0],
        exercise: newExercise,
        weight: Number(newWeight),
        reps: Number(newReps),
        client_id: targetClientId // Puede ser null si el usuario normal se crea su rutina
      });

      setNewExercise('');
      setNewWeight('');
      setNewReps('');
      fetchWorkouts();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Error al crear rutina');
    }
  };

  const generateAITrainerWorkout = async () => {
    setGeneratingAI(true);
    try {
      // Como entrenador, enviamos un perfil básico del cliente y su ID
      await api.post('/v2/ai/generate-workout', {
        client_id: targetClientId,
        clientProfile: {
          goal: 'Mejora General',
          days_per_week: 3,
          experience_level: 'Intermedio'
        }
      });
      Alert.alert('Éxito', '¡La IA generó una rutina y la agendó a tu cliente!');
      fetchWorkouts(); // Recargamos para verla
    } catch (error) {
      Alert.alert('Error', 'No pudimos conectar con la IA de Gemini.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const deleteWorkout = async (id) => {
    try {
      await api.delete(`/v2/workouts/${id}`);
      fetchWorkouts();
    } catch (error) {
      Alert.alert('Error', 'No se pudo eliminar');
    }
  };

  const renderWorkout = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
      <Text style={styles.exercise}>{item.exercise}</Text>

      {item.modified_by_client && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✏️ Editada por ti</Text>
        </View>
      )}

      {editingId === item.id ? (
        <View style={styles.editRow}>
          <TextInput style={styles.editInput} value={editWeight} onChangeText={setEditWeight} keyboardType="numeric" placeholder="kg" />
          <TextInput style={styles.editInput} value={editReps} onChangeText={setEditReps} keyboardType="numeric" placeholder="reps" />
          <TouchableOpacity style={styles.actionBtn} onPress={() => saveEdit(item)}><Text style={{color:'#fff'}}>💾</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#ccc'}]} onPress={() => setEditingId(null)}><Text>❌</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={styles.detailsRow}>
          <View style={styles.details}>
            <Text style={styles.detailText}>⚖️ {item.weight} kg</Text>
            <Text style={styles.detailText}>🔄 {item.reps} reps</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => startEditing(item)} style={{marginRight: 15}}><Text style={{fontSize: 20}}>✏️</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => deleteWorkout(item.id)}><Text style={{fontSize: 20}}>🗑️</Text></TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <View>
            <Text style={styles.headerTitle}>{targetClientId ? 'Rutinas del Cliente' : 'Mis Rutinas'}</Text>
            <Text style={styles.headerSubtitle}>Historial de entrenamiento</Text>
          </View>

          {userRole === 'trainer' && targetClientId && (
            <TouchableOpacity style={styles.aiBtn} onPress={generateAITrainerWorkout} disabled={generatingAI}>
              {generatingAI ? <ActivityIndicator color="#fff" /> : <Text style={styles.aiBtnText}>🤖 Autogenerar IA</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Formulario de Creación Manual */}
      <View style={styles.createForm}>
        <TextInput style={styles.input} placeholder="Ejercicio (ej: Sentadilla)" value={newExercise} onChangeText={setNewExercise} />
        <View style={styles.row}>
          <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="Peso (kg)" value={newWeight} onChangeText={setNewWeight} keyboardType="numeric" />
          <TextInput style={[styles.input, {flex: 1, marginRight: 10}]} placeholder="Reps" value={newReps} onChangeText={setNewReps} keyboardType="numeric" />
          <TouchableOpacity style={styles.createBtn} onPress={createWorkout}>
            <Text style={styles.createBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#e74c3c" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderWorkout}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No tienes rutinas registradas. ¡Usa PowerBud A.I. en la pestaña Inicio!</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#232946', borderBottomWidth: 1, borderBottomColor: '#ff00c8', shadowColor: '#ff00c8', shadowOpacity: 0.2, shadowRadius: 8, elevation: 2 },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#39ff14', textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  headerSubtitle: { fontSize: 16, color: '#00eaff', marginTop: 5, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  aiBtn: { backgroundColor: '#ff00c8', padding: 10, borderRadius: 8, alignItems: 'center', marginLeft: 10, shadowColor: '#ff00c8', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2 },
  aiBtnText: { color: '#39ff14', fontWeight: 'bold', fontSize: 12, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  createForm: { padding: 15, backgroundColor: '#232946', borderBottomWidth: 1, borderColor: '#ff00c8' },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { backgroundColor: '#232946', borderWidth: 1, borderColor: '#00eaff', borderRadius: 8, padding: 10, marginBottom: 10, color: '#39ff14', textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 },
  createBtn: { backgroundColor: '#39ff14', width: 45, height: 45, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginBottom: 10, shadowColor: '#39ff14', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2 },
  createBtnText: { color: '#18181b', fontSize: 24, fontWeight: 'bold', textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  list: { padding: 15 },
  card: {
    backgroundColor: '#232946',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#ff00c8',
    shadowColor: '#00eaff', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2,
  },
  date: { fontSize: 12, color: '#00eaff', marginBottom: 5, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 },
  exercise: { fontSize: 18, fontWeight: 'bold', color: '#ff00c8', marginBottom: 10, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  badge: { backgroundColor: '#fffb00', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, marginBottom: 10 },
  badgeText: { fontSize: 12, color: '#18181b', fontWeight: 'bold', textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  details: { flexDirection: 'row', justifyContent: 'flex-start' },
  detailText: { fontSize: 14, fontWeight: '600', color: '#39ff14', marginRight: 20, textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 },
  actions: { flexDirection: 'row' },
  editRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  editInput: { borderWidth: 1, borderColor: '#00eaff', borderRadius: 5, padding: 8, marginRight: 10, width: 60, textAlign: 'center', backgroundColor: '#232946', color: '#39ff14', textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 },
  actionBtn: { backgroundColor: '#ff00c8', padding: 10, borderRadius: 5, marginRight: 5, shadowColor: '#ff00c8', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2 },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#fffb00', fontSize: 16, paddingHorizontal: 20, fontStyle: 'italic' }
});
