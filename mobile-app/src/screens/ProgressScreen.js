import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../api';

export default function ProgressScreen() {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null); // URL local de la foto
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

  const pickImage = async () => {
    // Pedir permiso
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Atención', 'Necesitamos permisos de la cámara/galería para subir la foto.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5, // Comprimir foto
    });

    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
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
      let photoPublicUrl = null;

      // Si tomó foto, subirla a Supabase Bucket usando multipart/form-data
      if (photo) {
        let formData = new FormData();
        let filename = photo.split('/').pop();
        let match = /\.(\w+)$/.exec(filename);
        let type = match ? `image/${match[1]}` : `image`;

        formData.append('photo', { uri: photo, name: filename, type });

        const uploadRes = await api.post('/v2/upload/progress', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        photoPublicUrl = uploadRes.data.photo_url;
      }

      // Guardar el registro numérico en la base de datos con la URL de la foto
      await api.post('/v2/progress/body-metrics', {
        date,
        weight_kg: weight,
        notes: notes || '',
        photo_url: photoPublicUrl
      });

      Alert.alert('¡Excelente!', 'Tu progreso (y tu foto) han sido guardados.');
      setWeight('');
      setNotes('');
      setPhoto(null);
      fetchHistory(); // Recargar la lista

    } catch (error) {
      console.error('Error guardando', error);
      Alert.alert('Aviso', 'Se guardó la medida, pero no pudimos conectar con Supabase Storage si intentaste subir una foto (¿configuraste la ANON_KEY de Supabase?).');
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

        <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
          <Text style={styles.photoBtnText}>📸 Adjuntar foto de tu espejo</Text>
        </TouchableOpacity>

        {photo && <Image source={{ uri: photo }} style={styles.previewImage} />}

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
              {record.photo_url && <Image source={{ uri: record.photo_url }} style={styles.thumbnailImage} />}
              <View style={styles.historyContent}>
                <Text style={styles.historyDate}>{new Date(record.date).toLocaleDateString()}</Text>
                <Text style={styles.historyWeight}>{record.weight_kg} kg</Text>
                {record.notes ? <Text style={styles.historyNotes}>"{record.notes}"</Text> : null}
              </View>
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
  photoBtn: { backgroundColor: '#e0e0e0', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  photoBtnText: { color: '#333', fontSize: 15, fontWeight: 'bold' },
  previewImage: { width: '100%', height: 200, borderRadius: 10, marginBottom: 15, resizeMode: 'cover' },
  saveBtn: { backgroundColor: '#f39c12', padding: 15, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  historySection: { paddingHorizontal: 20, paddingBottom: 40 },
  historyTitle: { fontSize: 20, fontWeight: 'bold', color: '#2c3e50', marginBottom: 15 },
  historyRow: { flexDirection: 'row', backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#f39c12' },
  historyContent: { flex: 1, marginLeft: 10 },
  historyDate: { fontSize: 14, color: '#7f8c8d', marginBottom: 5 },
  historyWeight: { fontSize: 22, fontWeight: 'bold', color: '#34495e' },
  historyNotes: { fontSize: 14, fontStyle: 'italic', color: '#95a5a6', marginTop: 5 },
  thumbnailImage: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#eee' },
  emptyText: { color: '#bdc3c7', fontStyle: 'italic' }
});
