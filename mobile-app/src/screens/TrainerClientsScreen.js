import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../api';

export default function TrainerClientsScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState('unverified');
  const [uploadingCert, setUploadingCert] = useState(false);

  // Estado para invitar nuevo cliente
  const [newClientEmail, setNewClientEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    checkVerificationAndFetch();
  }, []);

  const checkVerificationAndFetch = async () => {
    try {
      // 1. Obtener mi perfil para ver mi status de verificación
      const profileRes = await api.get('/profile');
      // Asegúrate de que el backend devuelva el verification_status en /profile
      setVerificationStatus(profileRes.data.verification_status || 'unverified');

      if (profileRes.data.verification_status === 'verified') {
        // 2. Solo si estoy verificado, traigo a mis clientes
        const response = await api.get('/v2/relations/trainer/clients');
        setClients(response.data);
      }
    } catch (error) {
      console.error('Error inicial:', error);
    } finally {
      setLoading(false);
    }
  };

  const uploadCertificate = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos para subir tu diploma.');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });

    if (result.canceled) return;

    setUploadingCert(true);
    try {
      const uri = result.assets[0].uri;
      const formData = new FormData();
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image`;

      formData.append('certificate', { uri, name: filename, type });

      const response = await api.post('/v2/upload/certificate', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      Alert.alert('Certificado Enviado', response.data.message);
      setVerificationStatus('pending'); // Cambia UI a En Revisión

    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No pudimos subir tu certificado.');
    } finally {
      setUploadingCert(false);
    }
  };


  const inviteClient = async () => {
    if (!newClientEmail) {
      Alert.alert('Error', 'Ingresa el correo del cliente');
      return;
    }

    setInviting(true);
    try {
      await api.post('/v2/relations/invite', { clientEmail: newClientEmail });
      Alert.alert('Éxito', 'Invitación enviada. Espera a que el cliente la acepte.');
      setNewClientEmail('');
      fetchClients();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo enviar la invitación');
    } finally {
      setInviting(false);
    }
  };

  const goToClientWorkouts = (client) => {
    if (client.status !== 'active') {
      Alert.alert('Atención', 'Este cliente aún no ha aceptado tu invitación.');
      return;
    }
    // Navegar a la pantalla WorkoutScreen pasándole el ID del cliente
    navigation.navigate('Rutina', { clientId: client.client_id });
  };

  const renderClientRow = ({ item }) => (
    <TouchableOpacity style={styles.clientCard} onPress={() => goToClientWorkouts(item)}>
      <View>
        <Text style={styles.clientName}>{item.email}</Text>
        <Text style={{fontSize: 12, color: '#7f8c8d', marginTop: 3}}>Ver rutinas y progresos ➡️</Text>
      </View>
      <View style={styles.statusBadge}>
        <Text style={[
          styles.statusText,
          item.status === 'active' ? {color: '#2ecc71'} : {color: '#f39c12'}
        ]}>
          {item.status === 'active' ? 'ACTIVO' : 'PENDIENTE'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator size="large" color="#34495e" style={{marginTop: 100}} />;
  }

  // --- UI Para Entrenadores No Verificados o En Revisión ---
  if (verificationStatus !== 'verified') {
    return (
      <View style={styles.container}>
         <View style={styles.header}>
          <Text style={styles.headerTitle}>Cuenta Inactiva ⚠️</Text>
          <Text style={styles.headerSubtitle}>Proceso de validación profesional</Text>
        </View>
        <View style={{padding: 20}}>
          {verificationStatus === 'pending' ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>⏳ Certificado en revisión</Text>
              <Text style={{fontSize: 16, color: '#333', marginTop: 10, lineHeight: 22}}>
                Hemos recibido tu diploma. Nuestro equipo administrativo lo está verificando para asegurarse de que tienes los conocimientos para asesorar a otros. Te avisaremos cuando tu cuenta sea aprobada.
              </Text>
            </View>
          ) : (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>📸 Acción Requerida</Text>
              <Text style={{fontSize: 16, color: '#333', marginVertical: 10, lineHeight: 22}}>
                Por motivos de seguridad y calidad, no puedes invitar clientes ni usar la IA generativa hasta que demuestres tus credenciales (Diploma en nutrición, entrenamiento personal, etc.).
              </Text>
              <TouchableOpacity style={styles.uploadCertBtn} onPress={uploadCertificate} disabled={uploadingCert}>
                {uploadingCert ? <ActivityIndicator color="#fff" /> : <Text style={styles.uploadCertText}>Subir Certificado de Educación</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // --- UI Para Entrenadores VERIFICADOS ---
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mis Asesorados</Text>
        <Text style={styles.headerSubtitle}>Gestión de clientes</Text>
      </View>

      <View style={styles.inviteSection}>
        <Text style={styles.sectionTitle}>Invitar Nuevo Cliente</Text>
        <View style={styles.inviteRow}>
          <TextInput
            style={styles.input}
            placeholder="Correo del usuario..."
            value={newClientEmail}
            onChangeText={setNewClientEmail}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.inviteBtn} onPress={inviteClient} disabled={inviting}>
            {inviting ? <ActivityIndicator color="#fff" /> : <Text style={styles.inviteBtnText}>Invitar</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={clients}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderClientRow}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Aún no tienes clientes. ¡Invita a uno!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  header: { padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#34495e' },
  headerSubtitle: { fontSize: 16, color: '#7f8c8d', marginTop: 5 },
  inviteSection: { padding: 20, backgroundColor: '#fff', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50', marginBottom: 10 },
  inviteRow: { flexDirection: 'row' },
  input: { flex: 1, backgroundColor: '#f5f6fa', borderWidth: 1, borderColor: '#dcdde1', borderRadius: 8, padding: 12, marginRight: 10 },
  inviteBtn: { backgroundColor: '#34495e', paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  inviteBtnText: { color: '#fff', fontWeight: 'bold' },
  list: { padding: 20 },
  clientCard: { backgroundColor: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#34495e' },
  clientName: { fontSize: 16, fontWeight: 'bold', color: '#2c3e50' },
  statusBadge: { backgroundColor: '#f4f4f4', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#bdc3c7', fontStyle: 'italic', marginTop: 20 },
  warningCard: { backgroundColor: '#fff3cd', padding: 20, borderRadius: 10, borderWidth: 1, borderColor: '#ffeeba' },
  warningTitle: { fontSize: 18, fontWeight: 'bold', color: '#856404' },
  uploadCertBtn: { backgroundColor: '#34495e', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  uploadCertText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
