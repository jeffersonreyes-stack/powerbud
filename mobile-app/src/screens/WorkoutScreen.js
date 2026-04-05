import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, TextInput, Alert, ScrollView, Modal,
  Image, Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

// ─── Ejercicios por categoría (con video IDs de YouTube en español) ─────────
// Canales: Sergio Peinado, Alberto Núñez OfficialBar, Entrena con Sergio
const EXERCISES_BY_CATEGORY = {
  'Pecho': [
    { name: 'Press de banca plano',          vid: 'rT7DgCr-3pg' },
    { name: 'Press de banca inclinado',       vid: 'DbFgADa2PL8' },
    { name: 'Press de banca declinado',       vid: '0q_pPlgNKHs' },
    { name: 'Aperturas con mancuernas',       vid: 'eozdVDA78K0' },
    { name: 'Aperturas en polea',             vid: 'Iwe6AmxVf7o' },
    { name: 'Fondos en paralelas',            vid: 'y5sNx6qB8hc' },
    { name: 'Press con mancuernas plano',     vid: 'VmB1G1K7v94' },
    { name: 'Press con mancuernas inclinado', vid: '8iPEnn-ltC8' },
    { name: 'Pullover',                       vid: 'FK4rHfEPBpk' },
  ],
  'Espalda': [
    { name: 'Dominadas',            vid: 'eGo4IYlbE5g' },
    { name: 'Jalón al pecho',       vid: 'CAwf9n-58N0' },
    { name: 'Jalón tras nuca',      vid: 'hsUoFMFXVRE' },
    { name: 'Remo con barra',       vid: 'FWJR5Ve8bnQ' },
    { name: 'Remo con mancuerna',   vid: 'fB5T2MTJVsA' },
    { name: 'Remo en polea baja',   vid: 'GZbfZ033f74' },
    { name: 'Peso muerto',          vid: 'op9kVnSso6Q' },
    { name: 'Hiperextensiones',     vid: 'ph3pBvkNVhE' },
    { name: 'Pullover en polea',    vid: 'FK4rHfEPBpk' },
    { name: 'Face pull',            vid: 'rep-qVOkqgk' },
  ],
  'Hombros': [
    { name: 'Press militar con barra',          vid: 'F3QY5vMz_6I' },
    { name: 'Press militar con mancuernas',     vid: 'qEwKCR5JCog' },
    { name: 'Elevaciones laterales',            vid: '3VcKaXpzqRo' },
    { name: 'Elevaciones frontales',            vid: 'soxrZlIl35U' },
    { name: 'Pájaro (elevaciones posteriores)', vid: 'r3y8lsHzlNY' },
    { name: 'Press Arnold',                     vid: 'vranO8KNEmo' },
    { name: 'Encogimientos de hombros',         vid: 'cJRVVxmytaM' },
    { name: 'Rotaciones externas en polea',     vid: 'k1bGLuEefFk' },
  ],
  'Bíceps': [
    { name: 'Curl con barra',                 vid: 'kwG2ipFRgfo' },
    { name: 'Curl con mancuernas',            vid: 'av7-8igSXTs' },
    { name: 'Curl martillo',                  vid: 'TwD-YGVP4Bk' },
    { name: 'Curl concentrado',               vid: '0AUGkch3tzc' },
    { name: 'Curl en polea baja',             vid: 'NFzTWp2qpiE' },
    { name: 'Curl predicador',                vid: 'fIWP-FRFNU0' },
    { name: 'Curl inclinado con mancuernas',  vid: 'av7-8igSXTs' },
  ],
  'Tríceps': [
    { name: 'Press francés',                     vid: 'd_KpNHPKjnE' },
    { name: 'Fondos en banco',                   vid: 'y5sNx6qB8hc' },
    { name: 'Extensión en polea alta',            vid: 'kiuVA0gs3EI' },
    { name: 'Extensión con mancuerna',           vid: 'nRiJVZDpdL0' },
    { name: 'Patada de tríceps',                 vid: 'l3WDbQd-ibc' },
    { name: 'Close grip bench press',            vid: 'nEF0bv2FW9s' },
    { name: 'Extensión sobre cabeza con barra',  vid: 'd_KpNHPKjnE' },
  ],
  'Piernas': [
    { name: 'Sentadilla',                        vid: 'aclHkVaku9U' },
    { name: 'Prensa de piernas',                 vid: 'GvRgijoJ2xY' },
    { name: 'Extensión de cuádriceps',           vid: 'YyvSfVjQeL0' },
    { name: 'Curl femoral',                      vid: 'n96IHsJSML8' },
    { name: 'Peso muerto rumano',                vid: 'JCXUYuzwNrM' },
    { name: 'Zancadas',                          vid: 'wrwwXE_x-pQ' },
    { name: 'Hip thrust',                        vid: 'SEdqd9mNGBc' },
    { name: 'Abductor en máquina',               vid: 'WXZXMOLFpJQ' },
    { name: 'Aductor en máquina',                vid: 'WXZXMOLFpJQ' },
    { name: 'Elevación de pantorrillas de pie',  vid: 'JbyjNymZOt0' },
    { name: 'Elevación de pantorrillas sentado', vid: 'JbyjNymZOt0' },
    { name: 'Sentadilla búlgara',                vid: '2C-uNgKwPLE' },
    { name: 'Step up',                           vid: 'wrwwXE_x-pQ' },
  ],
  'Abdomen': [
    { name: 'Crunch',               vid: 'MKmrqckrN74' },
    { name: 'Crunch en polea',      vid: 'Xyd_fa5zoEU' },
    { name: 'Elevación de piernas', vid: 'l4kQd9eWclI' },
    { name: 'Plancha',              vid: 'pSHjTRCQxIw' },
    { name: 'Oblicuos en polea',    vid: 'Xyd_fa5zoEU' },
    { name: 'Rueda abdominal',      vid: 'sTq61P1CJRY' },
    { name: 'Tijeras',              vid: 'l4kQd9eWclI' },
    { name: 'Mountain climbers',    vid: 'nmwgirgXLYM' },
    { name: 'Dragon flag',          vid: 'sTq61P1CJRY' },
  ],
  'Cardio': [
    { name: 'Caminata en cinta',    vid: 'nmwgirgXLYM' },
    { name: 'Carrera en cinta',     vid: 'nmwgirgXLYM' },
    { name: 'Bicicleta estática',   vid: 'nmwgirgXLYM' },
    { name: 'Elíptica',             vid: 'nmwgirgXLYM' },
    { name: 'Cuerda para saltar',   vid: 'nmwgirgXLYM' },
    { name: 'Remo ergómetro',       vid: 'nmwgirgXLYM' },
    { name: 'Escaladora',           vid: 'nmwgirgXLYM' },
  ],
};

const ALL_EXERCISES = Object.values(EXERCISES_BY_CATEGORY).flat();
const SETS_OPTIONS = [1, 2, 3, 4, 5, 6];
const REPS_OPTIONS = [5, 6, 8, 10, 12, 15, 20, 25, 30];

// ─── Thumbnail de video (hardcoded, sin red) ────────────────────────────────
function ExerciseThumb({ vid }) {
  const openVideo = () => Linking.openURL(`https://youtube.com/watch?v=${vid}`);
  return (
    <TouchableOpacity onPress={openVideo} activeOpacity={0.8}>
      <Image
        source={{ uri: `https://img.youtube.com/vi/${vid}/mqdefault.jpg` }}
        style={ep.thumb}
        resizeMode="cover"
      />
      <View style={ep.playOverlay}>
        <Text style={{ fontSize: 16 }}>▶️</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Selector de chips ─────────────────────────────────────────────────────
function ChipPicker({ label, options, value, onChange }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={chipSt.label}>{label}</Text>
      <View style={chipSt.row}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            style={[chipSt.chip, value === opt && chipSt.chipActive]}
            onPress={() => onChange(opt)}
          >
            <Text style={[chipSt.text, value === opt && chipSt.textActive]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const chipSt = StyleSheet.create({
  label: { color: '#00eaff', fontSize: 12, marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#00eaff', backgroundColor: '#18181b',
  },
  chipActive: { backgroundColor: '#39ff14', borderColor: '#39ff14' },
  text: { color: '#00eaff', fontWeight: '600', fontSize: 13 },
  textActive: { color: '#18181b' },
});

// ─── Modal buscador de ejercicios ──────────────────────────────────────────
function ExercisePicker({ visible, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [activeCat, setActiveCat] = useState(null);
  const categories = Object.keys(EXERCISES_BY_CATEGORY);

  const filtered = (() => {
    const pool = activeCat ? EXERCISES_BY_CATEGORY[activeCat] : ALL_EXERCISES;
    if (!search.trim()) return pool;
    return pool.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  })();

  const handleClose = () => { setSearch(''); setActiveCat(null); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={ep.container}>
        <View style={ep.header}>
          <Text style={ep.title}>Seleccionar ejercicio</Text>
          <TouchableOpacity onPress={handleClose}>
            <Text style={ep.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={ep.search}
          placeholder="Buscar ejercicio..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
          autoFocus
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ep.catScroll} contentContainerStyle={{ paddingHorizontal: 15, gap: 8, paddingVertical: 6 }}>
          <TouchableOpacity style={[ep.catChip, !activeCat && ep.catChipActive]} onPress={() => setActiveCat(null)}>
            <Text style={[ep.catText, !activeCat && ep.catTextActive]}>Todos</Text>
          </TouchableOpacity>
          {categories.map(cat => (
            <TouchableOpacity key={cat} style={[ep.catChip, activeCat === cat && ep.catChipActive]} onPress={() => setActiveCat(activeCat === cat ? null : cat)}>
              <Text style={[ep.catText, activeCat === cat && ep.catTextActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <FlatList
          data={filtered}
          keyExtractor={item => item.name}
          renderItem={({ item }) => (
            <TouchableOpacity style={ep.item} onPress={() => { onSelect(item.name); handleClose(); }}>
              <ExerciseThumb vid={item.vid} />
              <Text style={ep.itemText}>{item.name}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={ep.empty}>Sin resultados para "{search}"</Text>}
          contentContainerStyle={{ paddingBottom: 30 }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          windowSize={5}
        />
      </View>
    </Modal>
  );
}

const ep = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, paddingTop: 55, backgroundColor: '#232946',
    borderBottomColor: '#ff00c8', borderBottomWidth: 1,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: '#39ff14' },
  close: { fontSize: 24, color: '#ff00c8', fontWeight: 'bold', paddingHorizontal: 6 },
  search: {
    margin: 15, backgroundColor: '#232946', borderWidth: 1,
    borderColor: '#00eaff', borderRadius: 10, padding: 13,
    color: '#39ff14', fontSize: 15,
  },
  catScroll: { maxHeight: 50, marginBottom: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#00eaff', backgroundColor: '#18181b',
  },
  catChipActive: { backgroundColor: '#ff00c8', borderColor: '#ff00c8' },
  catText: { color: '#00eaff', fontSize: 13, fontWeight: '600' },
  catTextActive: { color: '#fff' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#232946', gap: 12 },
  itemText: { color: '#e0e0e0', fontSize: 15, flex: 1 },
  empty: { textAlign: 'center', color: '#555', marginTop: 40, fontSize: 15 },
  thumbPlaceholder: {
    width: 80, height: 50, borderRadius: 8, backgroundColor: '#232946',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#333',
  },
  thumb: { width: 80, height: 50, borderRadius: 8 },
  playOverlay: {
    position: 'absolute', top: 0, left: 0, width: 80, height: 50,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8,
  },
});

// ─── Screen principal ──────────────────────────────────────────────────────
export default function WorkoutScreen({ route }) {
  const targetClientId = route?.params?.clientId || null;

  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Formulario
  const [newExercise, setNewExercise] = useState('');
  const [newWeight, setNewWeight] = useState('');
  const [newSets, setNewSets] = useState(3);
  const [newReps, setNewReps] = useState(10);
  const [showPicker, setShowPicker] = useState(false);

  // Edición inline
  const [editingId, setEditingId] = useState(null);
  const [editWeight, setEditWeight] = useState('');
  const [editSets, setEditSets] = useState(3);
  const [editReps, setEditReps] = useState(10);

  useEffect(() => {
    const fetchUser = async () => {
      const info = await AsyncStorage.getItem('userInfo');
      if (info) setUserRole(JSON.parse(info).role);
    };
    fetchUser();
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const url = targetClientId ? `/v2/workouts?client_id=${targetClientId}` : '/v2/workouts';
      const res = await api.get(url);
      setWorkouts(res.data);
    } catch (e) {
      console.error('Error cargando rutinas', e);
    } finally {
      setLoading(false);
    }
  };

  const createWorkout = async () => {
    if (!newExercise || !newWeight) {
      Alert.alert('Aviso', 'Selecciona el ejercicio e ingresa el peso.');
      return;
    }
    try {
      await api.post('/v2/workouts', {
        date: new Date().toISOString().split('T')[0],
        exercise: newExercise,
        weight: Number(newWeight),
        reps: newReps,
        sets: newSets,
        client_id: targetClientId,
      });
      setNewExercise('');
      setNewWeight('');
      setNewSets(3);
      setNewReps(10);
      fetchWorkouts();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Error al registrar');
    }
  };

  const startEditing = (item) => {
    setEditingId(item.id);
    setEditWeight(item.weight.toString());
    setEditSets(item.sets || 3);
    setEditReps(item.reps || 10);
  };

  const saveEdit = async (item) => {
    try {
      const res = await api.put(`/v2/workouts/${item.id}`, {
        date: item.date,
        exercise: item.exercise,
        weight: Number(editWeight),
        reps: editReps,
        sets: editSets,
      });
      Alert.alert('✅', res.data.message || 'Guardado');
      setEditingId(null);
      fetchWorkouts();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo guardar');
    }
  };

  const deleteWorkout = (id) => {
    Alert.alert('Eliminar', '¿Seguro que quieres eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try { await api.delete(`/v2/workouts/${id}`); fetchWorkouts(); }
          catch { Alert.alert('Error', 'No se pudo eliminar'); }
        },
      },
    ]);
  };

  const generateAITrainerWorkout = async () => {
    setGeneratingAI(true);
    try {
      await api.post('/v2/ai/generate-workout', {
        client_id: targetClientId,
        clientProfile: { goal: 'Mejora General', days_per_week: 3, experience_level: 'Intermedio' },
      });
      Alert.alert('Éxito', '¡La IA generó una rutina para tu cliente!');
      fetchWorkouts();
    } catch {
      Alert.alert('Error', 'No pudimos conectar con la IA.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const renderWorkout = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.date}>
          {new Date(item.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })}
        </Text>
        {item.modified_by_client && (
          <View style={styles.badge}><Text style={styles.badgeText}>✏️ Editada</Text></View>
        )}
      </View>

      <Text style={styles.exercise}>{item.exercise}</Text>

      {editingId === item.id ? (
        <View>
          <ChipPicker label="Series" options={SETS_OPTIONS} value={editSets} onChange={setEditSets} />
          <ChipPicker label="Repeticiones" options={REPS_OPTIONS} value={editReps} onChange={setEditReps} />
          <View style={styles.editWeightRow}>
            <Text style={{ color: '#00eaff', fontSize: 12, marginRight: 8 }}>Peso (kg)</Text>
            <TextInput
              style={styles.editInput}
              value={editWeight}
              onChangeText={setEditWeight}
              keyboardType="decimal-pad"
              placeholder="kg"
              placeholderTextColor="#444"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={styles.saveBtn} onPress={() => saveEdit(item)}>
              <Text style={styles.saveBtnText}>💾 Guardar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingId(null)}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.detailsRow}>
          <View style={styles.pills}>
            <View style={styles.pill}><Text style={styles.pillText}>🔢 {item.sets || 1} series</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>🔄 {item.reps} reps</Text></View>
            <View style={styles.pill}><Text style={styles.pillText}>⚖️ {item.weight} kg</Text></View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => startEditing(item)} style={{ marginRight: 12 }}>
              <Text style={{ fontSize: 20 }}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteWorkout(item.id)}>
              <Text style={{ fontSize: 20 }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={styles.headerTitle}>{targetClientId ? 'Rutinas del Cliente' : 'Mis Rutinas'}</Text>
            <Text style={styles.headerSubtitle}>Historial de entrenamiento</Text>
          </View>
          {userRole === 'trainer' && targetClientId && (
            <TouchableOpacity style={styles.aiBtn} onPress={generateAITrainerWorkout} disabled={generatingAI}>
              {generatingAI ? <ActivityIndicator color="#fff" /> : <Text style={styles.aiBtnText}>🤖 IA</Text>}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Formulario */}
      <View style={styles.createForm}>
        <TouchableOpacity style={styles.exerciseBtn} onPress={() => setShowPicker(true)}>
          <Text style={[styles.exerciseBtnText, !newExercise && { color: '#555' }]}>
            {newExercise || 'Toca para seleccionar ejercicio ▼'}
          </Text>
        </TouchableOpacity>

        <ChipPicker label="Series" options={SETS_OPTIONS} value={newSets} onChange={setNewSets} />
        <ChipPicker label="Repeticiones" options={REPS_OPTIONS} value={newReps} onChange={setNewReps} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Peso (kg)"
            placeholderTextColor="#444"
            value={newWeight}
            onChangeText={setNewWeight}
            keyboardType="decimal-pad"
          />
          <TouchableOpacity style={styles.createBtn} onPress={createWorkout}>
            <Text style={styles.createBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Lista */}
      {loading ? (
        <ActivityIndicator size="large" color="#ff00c8" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={workouts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderWorkout}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              No tienes rutinas registradas. ¡Usa PowerBud A.I. en la pestaña Inicio!
            </Text>
          }
        />
      )}

      <ExercisePicker
        visible={showPicker}
        onSelect={setNewExercise}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },
  header: {
    padding: 20, paddingTop: 60, backgroundColor: '#232946',
    borderBottomWidth: 1, borderBottomColor: '#ff00c8',
    shadowColor: '#ff00c8', shadowOpacity: 0.2, shadowRadius: 8, elevation: 2,
  },
  headerTitle: {
    fontSize: 26, fontWeight: 'bold', color: '#39ff14',
    textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  headerSubtitle: {
    fontSize: 16, color: '#00eaff', marginTop: 5,
    textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4,
  },
  aiBtn: {
    backgroundColor: '#ff00c8', padding: 10, borderRadius: 8,
    shadowColor: '#ff00c8', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2,
  },
  aiBtnText: { color: '#39ff14', fontWeight: 'bold', fontSize: 12 },

  createForm: {
    padding: 15, backgroundColor: '#232946',
    borderBottomWidth: 1, borderColor: '#ff00c8',
  },
  exerciseBtn: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#ff00c8',
    borderRadius: 10, padding: 14, marginBottom: 12,
  },
  exerciseBtnText: { color: '#ff00c8', fontSize: 15, fontWeight: '600' },
  input: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#00eaff',
    borderRadius: 8, padding: 11, color: '#39ff14',
  },
  createBtn: {
    backgroundColor: '#39ff14', width: 48, height: 48, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#39ff14', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2,
  },
  createBtnText: { color: '#18181b', fontSize: 28, fontWeight: 'bold', lineHeight: 32 },

  list: { padding: 15, paddingBottom: 30 },
  card: {
    backgroundColor: '#232946', padding: 14, borderRadius: 12, marginBottom: 12,
    borderLeftWidth: 4, borderLeftColor: '#ff00c8',
    shadowColor: '#00eaff', shadowOpacity: 0.1, shadowRadius: 5, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  date: { fontSize: 12, color: '#00eaff', textTransform: 'capitalize' },
  exercise: {
    fontSize: 17, fontWeight: 'bold', color: '#ff00c8', marginBottom: 10,
    textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4,
  },
  badge: { backgroundColor: '#fffb00', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, color: '#18181b', fontWeight: 'bold' },

  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#39ff14',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  pillText: { color: '#39ff14', fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center' },

  editWeightRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  editInput: {
    borderWidth: 1, borderColor: '#00eaff', borderRadius: 8, padding: 9,
    width: 90, textAlign: 'center', backgroundColor: '#18181b', color: '#39ff14', fontSize: 15,
  },
  saveBtn: {
    flex: 1, backgroundColor: '#39ff14', padding: 11, borderRadius: 8, alignItems: 'center',
  },
  saveBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 14 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#555', padding: 11, borderRadius: 8, alignItems: 'center',
  },
  cancelBtnText: { color: '#888', fontSize: 14 },

  emptyText: {
    textAlign: 'center', marginTop: 40, color: '#fffb00',
    fontSize: 15, paddingHorizontal: 30, fontStyle: 'italic', lineHeight: 24,
  },
});
