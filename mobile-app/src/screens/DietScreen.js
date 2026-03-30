import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import api from '../api';

export default function DietScreen() {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFoods();
  }, []);

  const fetchFoods = async () => {
    try {
      const response = await api.get('/v2/foods'); // Llama a la v2 en PostgreSQL
      setFoods(response.data);
    } catch (error) {
      console.error('Error cargando alimentos', error);
    } finally {
      setLoading(false);
    }
  };

  const renderFood = ({ item }) => (
    <View style={styles.foodCard}>
      <Text style={styles.foodName}>{item.name}</Text>
      <View style={styles.macros}>
        <Text style={styles.macroText}>🔥 {item.calories} kcal</Text>
        <Text style={[styles.macroText, {color: '#e74c3c'}]}>🥩 {item.protein}g P</Text>
        <Text style={[styles.macroText, {color: '#f1c40f'}]}>🍞 {item.carbs}g C</Text>
        <Text style={[styles.macroText, {color: '#e67e22'}]}>🥑 {item.fat}g G</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dieta y Alimentos</Text>
        <Text style={styles.headerSubtitle}>Explora la base de datos de nutrición</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2ecc71" style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={foods}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderFood}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No hay alimentos registrados.</Text>}
        />
      )}

      {/* Botón flotante para agregar alimentos (Solo UI por ahora) */}
      <TouchableOpacity style={styles.fab}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#2ecc71' },
  headerSubtitle: { fontSize: 16, color: '#7f8c8d', marginTop: 5 },
  list: { padding: 15 },
  foodCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2,
  },
  foodName: { fontSize: 18, fontWeight: '600', color: '#2c3e50', marginBottom: 10 },
  macros: { flexDirection: 'row', justifyContent: 'space-between' },
  macroText: { fontSize: 14, fontWeight: 'bold', color: '#7f8c8d' },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#bdc3c7' },
  fab: {
    position: 'absolute', right: 20, bottom: 20, backgroundColor: '#2ecc71',
    width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5, elevation: 5,
  },
  fabText: { color: '#fff', fontSize: 30, fontWeight: 'bold', marginTop: -2 }
});
