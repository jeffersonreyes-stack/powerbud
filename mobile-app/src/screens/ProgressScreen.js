import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import api from '../api';

export default function ProgressScreen() {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await api.get('/v2/progress/body-metrics');
      setHistory(response.data);
    } catch (error) {
      console.error('Error cargando historial', error);
    }
  };

  const saveProgress = async () => {
    if (!weight) {
      Alert.alert('Error', 'Ingresa tu peso actual.');
      return;
    }

    setLoading(true);
    try {
      const date = new Date().toISOString().split('T')[0];
      await api.post('/v2/progress/body-metrics', {
        date,
        weight_kg: weight,
        notes: notes || ''
      });

      Alert.alert('¡Excelente!', 'Tu progreso ha sido guardado.');
      setWeight('');
      setNotes('');
      fetchHistory(); // Recargar la lista
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el progreso.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi Progreso</Text>
        <Text style={styles.headerSubtitle}>Registra tus cambios corporales</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Peso Actual (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: 75.5"
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
        />

        <Text style={styles.label}>Notas o lesiones</Text>
        <TextInput
          style={[styles.input, {height: 80, textAlignVertical: 'top'}]}
          placeholder="¿Cómo te sientes hoy? Ej: Dolor en rodilla derecha"
          multiline
          value={notes}
          onChangeText={setNotes}
        />

        <TouchableOpacity style={styles.saveBtn} onPress={saveProgress} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Guardar Medidas</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.historySection}>
        <Text style={styles.historyTitle}>Últimos Registros</Text>
        {history.length === 0 ? (
          <Text style={styles.emptyText}>Aún no has registrado tu peso.</Text>
        ) : (
          history.map((record) => (
            <View key={record.id} style={styles.historyRow}>
              <Text style={styles.historyDate}>{new Date(record.date).toLocaleDateString()}</Text>
              <Text style={styles.historyWeight}>{record.weight_kg} kg</Text>
              {record.notes ? <Text style={styles.historyNotes}>"{record.notes}"</Text> : null}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#f39c12' },
  headerSubtitle: { fontSize: 16, color: '#7f8c8d', marginTop: 5 },
  formCard: {
    backgroundColor: '#fff', margin: 20, padding: 20, borderRadius: 15,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5,
  },
  label: { fontSize: 16, fontWeight: '600', color: '#34495e', marginBottom: 10 },
  input: {
    backgroundColor: '#f5f6fa', borderWidth: 1, borderColor: '#dcdde1', borderRadius: 8,
    padding: 15, fontSize: 16, marginBottom: 20,
  },
  saveBtn: { backgroundColor: '#f39c12', padding: 15, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  historySection: { paddingHorizontal: 20, paddingBottom: 40 },
  historyTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15 },
  historyRow: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#f39c12' },
  historyDate: { fontSize: 14, color: '#7f8c8d', marginBottom: 5 },
  historyWeight: { fontSize: 22, fontWeight: 'bold', color: '#34495e' },
  historyNotes: { fontSize: 14, fontStyle: 'italic', color: '#95a5a6', marginTop: 5 },
  emptyText: { color: '#bdc3c7', fontStyle: 'italic' }
});
