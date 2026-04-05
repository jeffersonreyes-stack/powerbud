import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator
} from 'react-native';
import api from '../api';

const SEXOS = ['Masculino', 'Femenino', 'Otro'];
const ACTIVIDADES = ['Sedentario', 'Ligero', 'Moderado', 'Activo', 'Muy activo'];
const EXPERIENCIAS = ['Principiante', 'Intermedio', 'Avanzado'];
const OBJETIVOS = [
  'Perder grasa corporal',
  'Ganar músculo / Hipertrofia',
  'Mejorar resistencia',
  'Mejorar fuerza',
  'Mejorar condición física general',
  'Rehabilitación / Movilidad'
];

export default function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [activityLevel, setActivityLevel] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [waistCm, setWaistCm] = useState('');
  const [neckCm, setNeckCm] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [goal, setGoal] = useState('');
  const [injuries, setInjuries] = useState('');

  const handleFinish = async () => {
    if (!age || !sex || !activityLevel || !weightKg || !heightCm || !experienceLevel || !goal) {
      Alert.alert('Faltan datos', 'Por favor completa todos los campos obligatorios.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/v2/user-profile', {
        age: Number(age),
        sex,
        activity_level: activityLevel,
        weight_kg: Number(weightKg),
        height_cm: Number(heightCm),
        waist_cm: waistCm ? Number(waistCm) : null,
        neck_cm: neckCm ? Number(neckCm) : null,
        experience_level: experienceLevel,
        goal,
        injuries: injuries || null,
      });
      onComplete();
    } catch (err) {
      Alert.alert('Error', 'No se pudo guardar tu perfil. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const SelectorButton = ({ label, value, selected, onPress }) => (
    <TouchableOpacity
      style={[styles.optionBtn, selected && styles.optionBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.optionText, selected && styles.optionTextActive]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>⚡ Powerbud</Text>
      <Text style={styles.subtitle}>Configura tu perfil para recibir tu mesociclo de 6 semanas personalizado</Text>

      {/* PASO 1: Datos físicos básicos */}
      {step === 1 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 1 / 3 — Datos Físicos</Text>

          <Text style={styles.label}>Edad *</Text>
          <TextInput style={styles.input} placeholder="Ej: 25" placeholderTextColor="#444" keyboardType="numeric" value={age} onChangeText={setAge} />

          <Text style={styles.label}>Sexo *</Text>
          <View style={styles.row}>
            {SEXOS.map(s => <SelectorButton key={s} label={s} value={s} selected={sex === s} onPress={() => setSex(s)} />)}
          </View>

          <Text style={styles.label}>Peso (kg) *</Text>
          <TextInput style={styles.input} placeholder="Ej: 75" placeholderTextColor="#444" keyboardType="numeric" value={weightKg} onChangeText={setWeightKg} />

          <Text style={styles.label}>Altura (cm) *</Text>
          <TextInput style={styles.input} placeholder="Ej: 175" placeholderTextColor="#444" keyboardType="numeric" value={heightCm} onChangeText={setHeightCm} />

          <Text style={styles.label}>Cintura (cm) — opcional</Text>
          <TextInput style={styles.input} placeholder="Ej: 85" placeholderTextColor="#444" keyboardType="numeric" value={waistCm} onChangeText={setWaistCm} />

          <Text style={styles.label}>Cuello (cm) — opcional</Text>
          <TextInput style={styles.input} placeholder="Ej: 38" placeholderTextColor="#444" keyboardType="numeric" value={neckCm} onChangeText={setNeckCm} />

          <TouchableOpacity style={styles.nextBtn} onPress={() => {
            if (!age || !sex || !weightKg || !heightCm) { Alert.alert('Faltan datos', 'Completa edad, sexo, peso y altura.'); return; }
            setStep(2);
          }}>
            <Text style={styles.nextBtnText}>Siguiente →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* PASO 2: Nivel de actividad y experiencia */}
      {step === 2 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 2 / 3 — Actividad y Experiencia</Text>

          <Text style={styles.label}>Nivel de actividad física *</Text>
          <View style={styles.column}>
            {ACTIVIDADES.map(a => <SelectorButton key={a} label={a} value={a} selected={activityLevel === a} onPress={() => setActivityLevel(a)} />)}
          </View>

          <Text style={styles.label}>Experiencia en el gym *</Text>
          <View style={styles.row}>
            {EXPERIENCIAS.map(e => <SelectorButton key={e} label={e} value={e} selected={experienceLevel === e} onPress={() => setExperienceLevel(e)} />)}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
              <Text style={styles.backBtnText}>← Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextBtn} onPress={() => {
              if (!activityLevel || !experienceLevel) { Alert.alert('Faltan datos', 'Selecciona nivel de actividad y experiencia.'); return; }
              setStep(3);
            }}>
              <Text style={styles.nextBtnText}>Siguiente →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* PASO 3: Objetivo y lesiones */}
      {step === 3 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Paso 3 / 3 — Objetivo y Salud</Text>

          <Text style={styles.label}>¿Cuál es tu objetivo principal? *</Text>
          <View style={styles.column}>
            {OBJETIVOS.map(o => <SelectorButton key={o} label={o} value={o} selected={goal === o} onPress={() => setGoal(o)} />)}
          </View>

          <Text style={styles.label}>Lesiones o limitaciones físicas (opcional)</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
            placeholder="Ej: Dolor en rodilla derecha, hernia lumbar..."
            placeholderTextColor="#444"
            multiline
            value={injuries}
            onChangeText={setInjuries}
          />

          <View style={styles.navRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
              <Text style={styles.backBtnText}>← Atrás</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.finishBtn} onPress={handleFinish} disabled={loading}>
              {loading ? <ActivityIndicator color="#18181b" /> : <Text style={styles.finishBtnText}>¡Comenzar! ⚡</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  title: { fontSize: 38, fontWeight: 'bold', color: '#39ff14', textAlign: 'center', textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 12 },
  subtitle: { fontSize: 15, color: '#00eaff', textAlign: 'center', marginTop: 10, marginBottom: 30, lineHeight: 22, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  card: { backgroundColor: '#232946', borderRadius: 15, padding: 20, shadowColor: '#ff00c8', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#ff00c8', marginBottom: 20, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
  label: { fontSize: 14, fontWeight: '600', color: '#39ff14', marginBottom: 8, marginTop: 12, textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 2 },
  input: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#00eaff', borderRadius: 8, padding: 12, fontSize: 16, color: '#39ff14', marginBottom: 5 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 5 },
  column: { flexDirection: 'column', gap: 8, marginBottom: 5 },
  optionBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#00eaff', backgroundColor: '#18181b', marginBottom: 4 },
  optionBtnActive: { backgroundColor: '#ff00c8', borderColor: '#ff00c8', shadowColor: '#ff00c8', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2 },
  optionText: { color: '#00eaff', fontWeight: '600', fontSize: 14 },
  optionTextActive: { color: '#18181b', textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  nextBtn: { backgroundColor: '#39ff14', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', shadowColor: '#39ff14', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2, marginTop: 20 },
  nextBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 16 },
  backBtn: { backgroundColor: '#232946', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, borderWidth: 1, borderColor: '#00eaff' },
  backBtnText: { color: '#00eaff', fontWeight: 'bold', fontSize: 15 },
  finishBtn: { backgroundColor: '#39ff14', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 8, alignItems: 'center', shadowColor: '#39ff14', shadowOpacity: 0.7, shadowRadius: 8, elevation: 2 },
  finishBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 16 },
});
