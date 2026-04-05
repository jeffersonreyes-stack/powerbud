import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Alert, ActivityIndicator, Modal, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../api';

export default function TrainerClientsScreen({ navigation }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState('unverified');
  const [uploadingCert, setUploadingCert] = useState(false);

  // Invitar
  const [newClientEmail, setNewClientEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  // Modal generación IA
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [trainerInstructions, setTrainerInstructions] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    checkVerificationAndFetch();
  }, []);

  const checkVerificationAndFetch = async () => {
    try {
      const profileRes = await api.get('/profile');
      setVerificationStatus(profileRes.data.verification_status || 'unverified');
      if (profileRes.data.verification_status === 'verified') {
        const response = await api.get('/v2/relations/trainer/clients');
        setClients(response.data);
      }
    } catch (error) {
      console.error('Error inicial:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const response = await api.get('/v2/relations/trainer/clients');
      setClients(response.data);
    } catch {}
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
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      Alert.alert('Certificado Enviado', response.data.message);
      setVerificationStatus('pending');
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
      setShowInvite(false);
      fetchClients();
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo enviar la invitación');
    } finally {
      setInviting(false);
    }
  };

  const openAiModal = (client) => {
    if (client.status !== 'active') {
      Alert.alert('Cliente pendiente', 'Este cliente aún no ha aceptado tu invitación.');
      return;
    }
    setSelectedClient(client);
    setTrainerInstructions('');
    setAiModalVisible(true);
  };

  const generateAiWorkout = async () => {
    if (!selectedClient) return;
    setGenerating(true);
    try {
      const res = await api.post('/v2/ai/generate-workout', {
        client_id: selectedClient.client_id,
        trainer_instructions: trainerInstructions.trim() || null,
      });
      setAiModalVisible(false);
      const title = res.data?.plan?.title || 'Rutina generada';
      Alert.alert(
        '✅ Rutina Generada',
        `"${title}" fue asignada a ${selectedClient.email}.\n\nEl cliente recibirá una notificación.`,
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo generar la rutina.');
    } finally {
      setGenerating(false);
    }
  };

  // --- Stats ---
  const totalClients = clients.length;
  const activeClients = clients.filter(c => c.status === 'active').length;
  const pendingClients = clients.filter(c => c.status !== 'active').length;

  const renderClientCard = ({ item }) => (
    <View style={[styles.clientCard, item.status === 'active' ? styles.clientCardActive : styles.clientCardPending]}>
      {/* Línea principal: email + badge */}
      <View style={styles.cardTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.clientEmail} numberOfLines={1}>{item.email}</Text>
          {item.name ? <Text style={styles.clientName}>{item.name}</Text> : null}
        </View>
        <View style={[styles.statusBadge, item.status === 'active' ? styles.badgeActive : styles.badgePending]}>
          <Text style={styles.statusText}>{item.status === 'active' ? 'ACTIVO' : 'PENDIENTE'}</Text>
        </View>
      </View>

      {/* Línea de info del cliente */}
      {item.goal ? (
        <Text style={styles.clientMeta}>🎯 {item.goal}</Text>
      ) : null}
      {item.last_workout ? (
        <Text style={styles.clientMeta}>🏋️ Última sesión: {item.last_workout}</Text>
      ) : null}

      {/* Acciones */}
      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.aiBtn]}
          onPress={() => openAiModal(item)}
        >
          <Text style={styles.aiBtnText}>⚡ Generar Rutina IA</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return <ActivityIndicator size="large" color="#39ff14" style={{ marginTop: 100 }} />;
  }

  // --- UI No verificados ---
  if (verificationStatus !== 'verified') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cuenta Inactiva ⚠️</Text>
          <Text style={styles.headerSubtitle}>Validación profesional requerida</Text>
        </View>
        <View style={{ padding: 20 }}>
          {verificationStatus === 'pending' ? (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>⏳ Certificado en revisión</Text>
              <Text style={styles.warningBody}>
                Hemos recibido tu diploma. Nuestro equipo lo está verificando. Te avisaremos cuando tu cuenta sea aprobada.
              </Text>
            </View>
          ) : (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>📸 Acción Requerida</Text>
              <Text style={styles.warningBody}>
                Por seguridad y calidad, no puedes invitar clientes ni usar la IA hasta que compruebes tus credenciales (Diploma en nutrición, entrenamiento personal, etc.).
              </Text>
              <TouchableOpacity style={styles.uploadCertBtn} onPress={uploadCertificate} disabled={uploadingCert}>
                {uploadingCert
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.uploadCertText}>Subir Certificado</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // --- UI Verificados: CRM ---
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Mis Asesorados</Text>
            <Text style={styles.headerSubtitle}>Panel de gestión</Text>
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowInvite(v => !v)}>
            <Text style={styles.addBtnText}>{showInvite ? '✕' : '+ Invitar'}</Text>
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{totalClients}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#39ff14' }]}>{activeClients}</Text>
            <Text style={styles.statLabel}>Activos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#fffb00' }]}>{pendingClients}</Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
        </View>
      </View>

      {/* Panel invitar (colapsable) */}
      {showInvite && (
        <View style={styles.inviteSection}>
          <Text style={styles.sectionTitle}>Invitar Nuevo Cliente</Text>
          <View style={styles.inviteRow}>
            <TextInput
              style={styles.input}
              placeholder="Correo registrado en PowerBud..."
              placeholderTextColor="#555"
              value={newClientEmail}
              onChangeText={setNewClientEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity style={styles.inviteBtn} onPress={inviteClient} disabled={inviting}>
              {inviting ? <ActivityIndicator color="#18181b" /> : <Text style={styles.inviteBtnText}>Enviar</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Lista de clientes */}
      <FlatList
        data={clients}
        keyExtractor={(item, index) => index.toString()}
        renderItem={renderClientCard}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>Aún no tienes asesorados.</Text>
            <Text style={styles.emptyHint}>Usa "Invitar" para agregar tu primer cliente.</Text>
          </View>
        }
      />

      {/* Modal generación IA */}
      <Modal visible={aiModalVisible} transparent animationType="slide" onRequestClose={() => setAiModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>⚡ Generar Rutina IA</Text>
            {selectedClient && (
              <Text style={styles.modalSubtitle}>Para: {selectedClient.email}</Text>
            )}
            <Text style={styles.modalLabel}>Instrucciones especiales (opcional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ej: Enfocarse en tren superior, evitar sentadillas por rodilla derecha, aumentar volumen de empuje..."
              placeholderTextColor="#555"
              value={trainerInstructions}
              onChangeText={setTrainerInstructions}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={styles.modalHint}>
              Si no escribes nada, la IA usará tu especialidad y el perfil del cliente automáticamente.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAiModalVisible(false)} disabled={generating}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.generateBtn} onPress={generateAiWorkout} disabled={generating}>
                {generating
                  ? <ActivityIndicator color="#18181b" />
                  : <Text style={styles.generateBtnText}>Generar Rutina</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },

  // Header
  header: { padding: 20, paddingTop: 60, backgroundColor: '#232946', borderBottomWidth: 1, borderBottomColor: '#ff00c8', shadowColor: '#ff00c8', shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 26, fontWeight: 'bold', color: '#39ff14', textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8 },
  headerSubtitle: { fontSize: 14, color: '#00eaff', marginTop: 3 },
  addBtn: { backgroundColor: '#ff00c8', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, shadowColor: '#ff00c8', shadowOpacity: 0.7, shadowRadius: 6, elevation: 2 },
  addBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 13 },

  // Stats bar
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 12 },
  statBox: { flex: 1, backgroundColor: '#1a1a2e', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  statNumber: { fontSize: 22, fontWeight: 'bold', color: '#00eaff' },
  statLabel: { fontSize: 11, color: '#888', marginTop: 2 },

  // Invite
  inviteSection: { padding: 16, backgroundColor: '#1e1e2e', borderBottomWidth: 1, borderBottomColor: '#333' },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#ff00c8', marginBottom: 10 },
  inviteRow: { flexDirection: 'row' },
  input: { flex: 1, backgroundColor: '#18181b', borderWidth: 1, borderColor: '#00eaff', borderRadius: 8, padding: 11, marginRight: 10, color: '#39ff14', fontSize: 14 },
  inviteBtn: { backgroundColor: '#39ff14', paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center', borderRadius: 8, shadowColor: '#39ff14', shadowOpacity: 0.6, shadowRadius: 6, elevation: 2 },
  inviteBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 14 },

  // List
  list: { padding: 16 },

  // Client card
  clientCard: { backgroundColor: '#1e1e2e', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 4 },
  clientCardActive: { borderLeftColor: '#39ff14' },
  clientCardPending: { borderLeftColor: '#fffb00' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  clientEmail: { fontSize: 15, fontWeight: 'bold', color: '#00eaff' },
  clientName: { fontSize: 12, color: '#888', marginTop: 2 },
  clientMeta: { fontSize: 12, color: '#666', marginTop: 3 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeActive: { backgroundColor: '#0d2218' },
  badgePending: { backgroundColor: '#1f1f00' },
  statusText: { fontSize: 11, fontWeight: 'bold' },

  // Card actions
  cardActions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  aiBtn: { backgroundColor: '#39ff14', shadowColor: '#39ff14', shadowOpacity: 0.5, shadowRadius: 6, elevation: 2 },
  aiBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 13 },

  // Empty state
  emptyBox: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#fffb00', fontWeight: 'bold', fontSize: 16 },
  emptyHint: { color: '#555', fontSize: 13, marginTop: 4, textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#1e1e2e', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, borderTopWidth: 2, borderColor: '#ff00c8' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#39ff14', marginBottom: 4, textShadowColor: '#ff00c8', textShadowRadius: 6 },
  modalSubtitle: { fontSize: 14, color: '#00eaff', marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: 'bold', color: '#ff00c8', marginBottom: 8 },
  modalInput: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#00eaff',
    borderRadius: 10, padding: 12, color: '#e0e0e0', fontSize: 14,
    minHeight: 100, marginBottom: 8,
  },
  modalHint: { fontSize: 11, color: '#555', marginBottom: 20, lineHeight: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#444' },
  cancelBtnText: { color: '#888', fontWeight: 'bold', fontSize: 15 },
  generateBtn: { flex: 2, paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#39ff14', shadowColor: '#39ff14', shadowOpacity: 0.7, shadowRadius: 8, elevation: 3 },
  generateBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 15 },

  // Verificación
  warningCard: { backgroundColor: '#232946', padding: 20, borderRadius: 12, borderWidth: 1, borderColor: '#fffb00' },
  warningTitle: { fontSize: 18, fontWeight: 'bold', color: '#fffb00', marginBottom: 10 },
  warningBody: { fontSize: 15, color: '#aaa', lineHeight: 22 },
  uploadCertBtn: { backgroundColor: '#ff00c8', padding: 15, borderRadius: 10, alignItems: 'center', marginTop: 20 },
  uploadCertText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});


