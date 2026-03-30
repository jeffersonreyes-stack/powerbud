import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import api from '../api';

export default function WorkoutScreen() {
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await api.get('/v2/workouts');
      setWorkouts(response.data);
    } catch (error) {
      console.error('Error cargando rutinas', error);
    } finally {
      setLoading(false);
    }
  };

  const renderWorkout = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.date}>{new Date(item.date).toLocaleDateString()}</Text>
      <Text style={styles.exercise}>{item.exercise}</Text>
      <View style={styles.details}>
        <Text style={styles.detailText}>⚖️ {item.weight} kg</Text>
        <Text style={styles.detailText}>🔄 {item.reps} reps</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Rutinas</Text>
        <Text style={styles.headerSubtitle}>Historial de entrenamiento</Text>
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
            <Text style={styles.emptyText}>No tienes rutinas registradas. ¡Usa el Entrenador Virtual!</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#e74c3c' },
  headerSubtitle: { fontSize: 16, color: '#7f8c8d', marginTop: 5 },
  list: { padding: 15 },
  card: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderLeftColor: '#e74c3c',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  date: { fontSize: 12, color: '#bdc3c7', marginBottom: 5 },
  exercise: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 10 },
  details: { flexDirection: 'row', justifyContent: 'flex-start' },
  detailText: { fontSize: 14, fontWeight: '600', color: '#7f8c8d', marginRight: 20 },
  emptyText: { textAlign: 'center', marginTop: 30, color: '#bdc3c7', fontSize: 16, paddingHorizontal: 20 }
});
