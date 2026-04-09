import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, Image, FlatList, KeyboardAvoidingView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import api from '../api';

// ── Mini gráfica de barras con peso máximo ───────────────────────────────────
function BarChart({ data }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Number(d.weight) || 0));
  return (
    <View style={chart.container}>
      {data.map((d, i) => {
        const pct = maxVal > 0 ? (Number(d.weight) / maxVal) : 0;
        return (
          <View key={i} style={chart.barWrapper}>
            <Text style={chart.barVal}>{d.weight}kg</Text>
            <View style={[chart.bar, { height: Math.max(pct * 80, 4) }]} />
            <Text style={chart.barDate}>{new Date(d.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}</Text>
          </View>
        );
      })}
    </View>
  );
}

const chart = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 12, minHeight: 110 },
  barWrapper: { alignItems: 'center', flex: 1 },
  bar: { width: '80%', backgroundColor: '#39ff14', borderRadius: 3, shadowColor: '#39ff14', shadowOpacity: 0.6, shadowRadius: 4 },
  barVal: { color: '#fffb00', fontSize: 9, fontWeight: 'bold', marginBottom: 2 },
  barDate: { color: '#555', fontSize: 8, marginTop: 2 },
});

// ── Componente principal ──────────────────────────────────────────────────────
export default function ProgressScreen() {
  const [tab, setTab] = useState('cuerpo'); // 'cuerpo' | 'ejercicios' | 'detalle'

  // --- TAB CUERPO ---
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [stressLevel, setStressLevel] = useState(''); // 1-5
  const [photo, setPhoto] = useState(null);
  const [savingBody, setSavingBody] = useState(false);
  const [bodyHistory, setBodyHistory] = useState([]);
  const [loadingBody, setLoadingBody] = useState(true);
  const [recovery, setRecovery] = useState(null);
  const [loadingRecovery, setLoadingRecovery] = useState(true);

  // --- TAB EJERCICIOS ---
  const [exercises, setExercises] = useState([]);
  const [loadingEx, setLoadingEx] = useState(true);

  // --- TAB DETALLE ---
  const [selectedEx, setSelectedEx] = useState(null);
  const [exHistory, setExHistory] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchBodyHistory();
    fetchExercises();
    fetchRecovery();
  }, []);

  const fetchBodyHistory = async () => {
    try {
      const r = await api.get('/v2/progress/body-metrics');
      setBodyHistory(r.data);
    } catch (e) { console.error(e); }
    finally { setLoadingBody(false); }
  };

  const fetchRecovery = async () => {
    try {
      const r = await api.get('/v2/progress/recovery');
      setRecovery(r.data);
    } catch (e) { console.error(e); }
    finally { setLoadingRecovery(false); }
  };

  const fetchExercises = async () => {
    try {
      const r = await api.get('/v2/progress/exercises');
      setExercises(r.data);
    } catch (e) { console.error(e); }
    finally { setLoadingEx(false); }
  };

  const fetchExDetail = async (exercise) => {
    setSelectedEx(exercise);
    setTab('detalle');
    setLoadingDetail(true);
    try {
      const r = await api.get(`/v2/progress/exercise-history?exercise=${encodeURIComponent(exercise)}`);
      setExHistory(r.data);
    } catch (e) { console.error(e); }
    finally { setLoadingDetail(false); }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permisos necesarios', 'Habilita acceso a la galería.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.5 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  const saveBodyProgress = async () => {
    if (!weight) { Alert.alert('Falta el peso'); return; }
    setSavingBody(true);
    try {
      let photoPublicUrl = null;
      if (photo) {
        let formData = new FormData();
        let filename = photo.split('/').pop();
        let match = /\.(\w+)$/.exec(filename);
        formData.append('photo', { uri: photo, name: filename, type: match ? `image/${match[1]}` : 'image' });
        const uploadRes = await api.post('/v2/upload/progress', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        photoPublicUrl = uploadRes.data.photo_url;
      }
      await api.post('/v2/progress/body-metrics', {
        date: new Date().toISOString().split('T')[0],
        weight_kg: weight,
        notes: notes || '',
        sleep_hours: sleepHours ? Number(sleepHours) : null,
        stress_level: stressLevel ? Number(stressLevel) : null,
        photo_url: photoPublicUrl,
      });
      Alert.alert('✅ Guardado', 'Tu progreso corporal fue registrado.');
      setWeight('');
      setNotes('');
      setSleepHours('');
      setStressLevel('');
      setPhoto(null);
      fetchBodyHistory();
      fetchRecovery();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el progreso.');
    } finally { setSavingBody(false); }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* Tabs */}
      <View style={styles.tabBar}>
        {[{ key: 'cuerpo', label: '🏋️ Cuerpo' }, { key: 'ejercicios', label: '📊 Ejercicios' }].map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
        {selectedEx && (
          <TouchableOpacity style={[styles.tab, tab === 'detalle' && styles.tabActive]} onPress={() => setTab('detalle')}>
            <Text style={[styles.tabText, tab === 'detalle' && styles.tabTextActive]} numberOfLines={1}>📈 Detalle</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── TAB CUERPO ── */}
      {tab === 'cuerpo' && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.sectionTitle}>� Tasa de Recuperación</Text>
          {loadingRecovery ? <ActivityIndicator color="#39ff14" /> : !recovery ? null : (
            <View style={[styles.card, { borderLeftColor:
              recovery.acwr_zone === 'óptima' ? '#39ff14' :
              recovery.acwr_zone === 'precaución' ? '#fffb00' : '#ff00c8' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <View>
                  <Text style={styles.recoveryLabel}>ACWR</Text>
                  <Text style={styles.recoveryVal}>{recovery.acwr ?? '—'}</Text>
                  <Text style={[styles.recoveryZone, { color:
                    recovery.acwr_zone === 'óptima' ? '#39ff14' :
                    recovery.acwr_zone === 'precaución' ? '#fffb00' : '#ff00c8' }]}>
                    {recovery.acwr_zone?.toUpperCase()}
                  </Text>
                </View>
                {recovery.recovery_score !== null && (
                  <View style={styles.scoreCircle}>
                    <Text style={styles.scoreNum}>{recovery.recovery_score}</Text>
                    <Text style={styles.scoreLabel}>score</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {recovery.avg_sleep_hours !== null && (
                  <View style={styles.recoveryPill}>
                    <Text style={styles.recoveryPillIcon}>💤</Text>
                    <Text style={styles.recoveryPillVal}>{recovery.avg_sleep_hours}h</Text>
                    <Text style={styles.recoveryPillLabel}>sueño avg</Text>
                  </View>
                )}
                {recovery.avg_stress_level !== null && (
                  <View style={styles.recoveryPill}>
                    <Text style={styles.recoveryPillIcon}>🧠</Text>
                    <Text style={styles.recoveryPillVal}>{recovery.avg_stress_level}/5</Text>
                    <Text style={styles.recoveryPillLabel}>estrés avg</Text>
                  </View>
                )}
                {recovery.acwr !== null && (
                  <View style={styles.recoveryPill}>
                    <Text style={styles.recoveryPillIcon}>⚡</Text>
                    <Text style={styles.recoveryPillVal}>{recovery.acute_load}</Text>
                    <Text style={styles.recoveryPillLabel}>carga 7d</Text>
                  </View>
                )}
              </View>
              {recovery.acwr_zone === 'sobreentrenamiento' && (
                <Text style={styles.recoveryWarning}>⚠️ ACWR {recovery.acwr} — Reduce volumen y prioriza el descanso.</Text>
              )}
              {recovery.acwr_zone === 'precaución' && (
                <Text style={[styles.recoveryWarning, { color: '#fffb00' }]}>⚠️ Carga elevada. Monitorea cómo te sientes.</Text>
              )}
              {recovery.avg_sleep_hours !== null && recovery.avg_sleep_hours < 7 && (
                <Text style={styles.recoveryWarning}>💤 Sueño bajo ({recovery.avg_sleep_hours}h). El descanso es clave para recuperarte.</Text>
              )}
            </View>
          )}

          <Text style={styles.sectionTitle}>📏 Registro Corporal</Text>

          <View style={styles.card}>
            <Text style={styles.label}>Peso actual (kg) *</Text>
            <TextInput style={styles.input} placeholder="Ej: 75.5" keyboardType="numeric" value={weight} onChangeText={setWeight} placeholderTextColor="#444" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>💤 Horas de sueño</Text>
                <TextInput style={styles.input} placeholder="Ej: 7.5" keyboardType="decimal-pad" value={sleepHours} onChangeText={setSleepHours} placeholderTextColor="#444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>🧠 Estrés (1-5)</Text>
                <TextInput style={styles.input} placeholder="1=bajo 5=alto" keyboardType="numeric" value={stressLevel} onChangeText={v => setStressLevel(v.replace(/[^1-5]/g, ''))} placeholderTextColor="#444" maxLength={1} />
              </View>
            </View>
            <Text style={styles.label}>Notas / lesiones</Text>
            <TextInput style={[styles.input, { height: 70, textAlignVertical: 'top' }]} placeholder="¿Cómo te sientes hoy?" multiline value={notes} onChangeText={setNotes} placeholderTextColor="#444" />
            <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
              <Text style={styles.photoBtnText}>📸 Adjuntar foto</Text>
            </TouchableOpacity>
            {photo && <Image source={{ uri: photo }} style={styles.previewImage} />}
            <TouchableOpacity style={styles.saveBtn} onPress={saveBodyProgress} disabled={savingBody}>
              {savingBody ? <ActivityIndicator color="#18181b" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>📅 Historial de peso</Text>
          {loadingBody ? <ActivityIndicator color="#39ff14" /> :
            bodyHistory.length === 0 ? <Text style={styles.empty}>Sin registros aún.</Text> :
            <>
              {/* Mini gráfica de peso */}
              <View style={styles.card}>
                <Text style={styles.chartTitle}>Evolución del peso</Text>
                <BarChart data={bodyHistory.slice(0, 10).reverse().map(r => ({ date: r.date, weight: r.weight_kg }))} />
              </View>
              {bodyHistory.map(r => (
                <View key={r.id} style={styles.historyRow}>
                  {r.photo_url && <Image source={{ uri: r.photo_url }} style={styles.thumb} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.histDate}>{new Date(r.date).toLocaleDateString('es-CO')}</Text>
                    <Text style={styles.histWeight}>{r.weight_kg} kg</Text>
                    {r.notes ? <Text style={styles.histNotes}>"{r.notes}"</Text> : null}
                  </View>
                </View>
              ))}
            </>
          }
        </ScrollView>
      )}

      {/* ── TAB EJERCICIOS ── */}
      {tab === 'ejercicios' && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <Text style={styles.sectionTitle}>🏆 Progreso por Ejercicio</Text>
          <Text style={styles.hint}>Toca un ejercicio para ver su tabla de progresión</Text>
          {loadingEx ? <ActivityIndicator color="#39ff14" style={{ marginTop: 30 }} /> :
            exercises.length === 0 ? <Text style={styles.empty}>Aún no tienes rutinas registradas.</Text> :
            exercises.map((ex, i) => (
              <TouchableOpacity key={i} style={styles.exCard} onPress={() => fetchExDetail(ex.exercise)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.exName} numberOfLines={2}>{ex.exercise}</Text>
                  <Text style={styles.exMeta}>{ex.sessions} sesiones · Último: {new Date(ex.last_date).toLocaleDateString('es-CO')}</Text>
                </View>
                <View style={styles.exMaxBox}>
                  <Text style={styles.exMaxLabel}>Máx.</Text>
                  <Text style={styles.exMaxVal}>{ex.max_weight}kg</Text>
                </View>
                <Text style={styles.exArrow}>›</Text>
              </TouchableOpacity>
            ))
          }
        </ScrollView>
      )}

      {/* ── TAB DETALLE ── */}
      {tab === 'detalle' && selectedEx && (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <TouchableOpacity onPress={() => setTab('ejercicios')} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Volver</Text>
          </TouchableOpacity>
          <Text style={styles.sectionTitle} numberOfLines={2}>{selectedEx}</Text>
          {loadingDetail ? <ActivityIndicator color="#39ff14" style={{ marginTop: 30 }} /> :
            exHistory.length === 0 ? <Text style={styles.empty}>Sin historial para este ejercicio.</Text> :
            <>
              {/* Gráfica de peso */}
              <View style={styles.card}>
                <Text style={styles.chartTitle}>📈 Progresión de peso</Text>
                <BarChart data={exHistory.slice(-12)} />
              </View>

              {/* Tabla */}
              <View style={styles.card}>
                <Text style={styles.chartTitle}>📋 Tabla de registros</Text>
                {/* Cabecera */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableHead, { flex: 2 }]}>Fecha</Text>
                  <Text style={[styles.tableCell, styles.tableHead]}>Peso</Text>
                  <Text style={[styles.tableCell, styles.tableHead]}>Reps</Text>
                  <Text style={[styles.tableCell, styles.tableHead]}>Volumen</Text>
                </View>
                {/* Filas — más reciente primero */}
                {[...exHistory].reverse().map((row, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, { flex: 2 }]}>{new Date(row.date).toLocaleDateString('es-CO')}</Text>
                    <Text style={[styles.tableCell, { color: '#39ff14' }]}>{row.weight}kg</Text>
                    <Text style={[styles.tableCell, { color: '#00eaff' }]}>{row.reps}</Text>
                    <Text style={[styles.tableCell, { color: '#fffb00' }]}>{Math.round(row.volumen)}</Text>
                  </View>
                ))}
              </View>
            </>
          }
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },
  tabBar: { flexDirection: 'row', backgroundColor: '#232946', borderBottomWidth: 2, borderBottomColor: '#ff00c8', paddingTop: 50 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#39ff14' },
  tabText: { color: '#555', fontWeight: 'bold', fontSize: 13 },
  tabTextActive: { color: '#39ff14', textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  scroll: { padding: 16, paddingBottom: 60 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#ff00c8', marginBottom: 10, marginTop: 6, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  hint: { color: '#555', fontSize: 12, marginBottom: 12, fontStyle: 'italic' },
  card: { backgroundColor: '#232946', borderRadius: 12, padding: 14, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: '#ff00c8' },
  label: { color: '#39ff14', fontWeight: '600', fontSize: 13, marginBottom: 6, marginTop: 8 },
  input: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#00eaff', borderRadius: 8, padding: 10, color: '#39ff14', fontSize: 14, marginBottom: 6 },
  photoBtn: { backgroundColor: '#ff00c8', padding: 10, borderRadius: 8, alignItems: 'center', marginBottom: 10 },
  photoBtnText: { color: '#18181b', fontWeight: 'bold' },
  previewImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 10, resizeMode: 'cover' },
  saveBtn: { backgroundColor: '#39ff14', paddingVertical: 12, borderRadius: 8, alignItems: 'center', shadowColor: '#39ff14', shadowOpacity: 0.6, shadowRadius: 8, elevation: 3 },
  saveBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 15 },
  empty: { color: '#555', fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  chartTitle: { color: '#00eaff', fontWeight: 'bold', fontSize: 13, marginBottom: 4 },
  historyRow: { flexDirection: 'row', backgroundColor: '#232946', padding: 12, borderRadius: 10, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#39ff14', alignItems: 'center' },
  thumb: { width: 55, height: 55, borderRadius: 8, marginRight: 10, backgroundColor: '#333' },
  histDate: { fontSize: 12, color: '#00eaff' },
  histWeight: { fontSize: 22, fontWeight: 'bold', color: '#39ff14', textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  histNotes: { fontSize: 12, fontStyle: 'italic', color: '#fffb00', marginTop: 2 },
  // Recovery card
  recoveryLabel: { color: '#aaa', fontSize: 11, fontWeight: '600' },
  recoveryVal: { color: '#39ff14', fontSize: 28, fontWeight: 'bold' },
  recoveryZone: { fontSize: 11, fontWeight: 'bold', marginTop: 2 },
  scoreCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#1a1a2e', borderWidth: 2, borderColor: '#ff00c8', justifyContent: 'center', alignItems: 'center' },
  scoreNum: { color: '#fff', fontWeight: 'bold', fontSize: 22 },
  scoreLabel: { color: '#aaa', fontSize: 9 },
  recoveryPill: { flex: 1, backgroundColor: '#1a1a2e', borderRadius: 8, padding: 8, alignItems: 'center' },
  recoveryPillIcon: { fontSize: 16 },
  recoveryPillVal: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  recoveryPillLabel: { color: '#555', fontSize: 10 },
  recoveryWarning: { color: '#ff00c8', fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  exCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#232946', borderRadius: 10, padding: 14, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#00eaff' },
  exName: { color: '#00eaff', fontWeight: '600', fontSize: 14, flex: 1 },
  exMeta: { color: '#555', fontSize: 11, marginTop: 3 },
  exMaxBox: { alignItems: 'center', marginHorizontal: 10 },
  exMaxLabel: { color: '#555', fontSize: 10 },
  exMaxVal: { color: '#39ff14', fontWeight: 'bold', fontSize: 18, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 3 },
  exArrow: { color: '#ff00c8', fontSize: 24, fontWeight: 'bold' },
  backBtn: { marginBottom: 12 },
  backBtnText: { color: '#00eaff', fontWeight: 'bold', fontSize: 14 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ff00c8', paddingBottom: 6, marginBottom: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 6 },
  tableRowAlt: { backgroundColor: '#1a1a2e' },
  tableCell: { flex: 1, fontSize: 12, color: '#aaa', textAlign: 'center' },
  tableHead: { color: '#ff00c8', fontWeight: 'bold', fontSize: 12 },
});

