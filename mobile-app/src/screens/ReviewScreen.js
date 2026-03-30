import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import api from '../api';

// Esta pantalla muestra todos los entrenadores y permite a un cliente dejarles una calificación (estrellas) y un comentario
export default function ReviewScreen() {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado para el formulario de reseña
  const [selectedTrainerId, setSelectedTrainerId] = useState(null);
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTrainers();
  }, []);

  const fetchTrainers = async () => {
    try {
      // Pedir al backend todos los entrenadores (activos o inactivos) para calificarlos
      const response = await api.get('/v2/relations/my-trainers');
      setTrainers(response.data);
    } catch (error) {
      console.error('Error cargando entrenadores', error);
    } finally {
      setLoading(false);
    }
  };

  const submitReview = async () => {
    if (!selectedTrainerId || !rating) {
      Alert.alert('Aviso', 'Selecciona un entrenador y pon una calificación (1-5)');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/v2/reviews', {
        trainer_id: selectedTrainerId,
        rating: Number(rating),
        comment: comment
      });

      Alert.alert('¡Gracias!', 'Tu reseña pública ha sido guardada. Si ya habías calificado, se actualizó la anterior.');
      setComment('');
      setSelectedTrainerId(null);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo guardar la reseña. Recuerda que debes tener una relación con este entrenador para calificarlo.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderTrainerRow = ({ item }) => {
    // Para simplificar, asumimos que 'item' viene de la tabla relations y tiene trainer_id
    const isSelected = selectedTrainerId === item.trainer_id;
    return (
      <TouchableOpacity
        style={[styles.trainerCard, isSelected && styles.trainerCardSelected]}
        onPress={() => setSelectedTrainerId(item.trainer_id)}
      >
        <Text style={styles.trainerName}>{item.trainer_email}</Text>
        <Text style={styles.trainerSub}>Seleccionar para calificar</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Califica a tu Entrenador</Text>
        <Text style={styles.headerSubtitle}>Ayuda a otros compartiendo tu experiencia</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#9b59b6" style={{marginTop: 50}} />
      ) : (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Tus entrenadores para calificar</Text>
          <FlatList
            data={trainers}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderTrainerRow}
            style={styles.list}
            ListEmptyComponent={<Text style={styles.emptyText}>No tienes entrenadores asignados aún.</Text>}
          />

          {selectedTrainerId && (
            <View style={styles.reviewForm}>
              <Text style={styles.formTitle}>Dejar una reseña pública:</Text>

              <View style={styles.ratingRow}>
                <Text style={styles.label}>Estrellas (1-5): </Text>
                <TextInput
                  style={styles.ratingInput}
                  keyboardType="numeric"
                  maxLength={1}
                  value={rating}
                  onChangeText={setRating}
                />
                <Text style={styles.starIcon}>⭐</Text>
              </View>

              <TextInput
                style={[styles.input, {height: 80, textAlignVertical: 'top'}]}
                placeholder="Escribe tu opinión pública aquí (opcional)"
                multiline
                value={comment}
                onChangeText={setComment}
              />

              <TouchableOpacity style={styles.submitBtn} onPress={submitReview} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Publicar Reseña</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#9b59b6' },
  headerSubtitle: { fontSize: 16, color: '#7f8c8d', marginTop: 5 },
  content: { padding: 20, flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15 },
  list: { maxHeight: 200, marginBottom: 20 },
  trainerCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  trainerCardSelected: { borderColor: '#9b59b6', backgroundColor: '#f4ecf8', borderWidth: 2 },
  trainerName: { fontSize: 16, fontWeight: 'bold', color: '#34495e' },
  trainerSub: { fontSize: 12, color: '#95a5a6', marginTop: 5 },
  emptyText: { color: '#bdc3c7', fontStyle: 'italic' },
  reviewForm: { backgroundColor: '#fff', padding: 20, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  formTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 15 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  label: { fontSize: 16, color: '#555' },
  ratingInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 5, padding: 5, width: 50, textAlign: 'center', fontSize: 18, marginRight: 10, backgroundColor: '#fafafa' },
  starIcon: { fontSize: 24 },
  input: { backgroundColor: '#f5f6fa', borderWidth: 1, borderColor: '#dcdde1', borderRadius: 8, padding: 15, fontSize: 16, marginBottom: 20 },
  submitBtn: { backgroundColor: '#9b59b6', padding: 15, borderRadius: 8, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
