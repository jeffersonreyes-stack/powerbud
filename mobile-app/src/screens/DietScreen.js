import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert
} from 'react-native';
import api from '../api';

// ── Barra de progreso de macro ──────────────────────────────────────────────
function MacroBar({ label, current, target, color }) {
  const pct = target > 0 ? Math.min(current / target, 1) : 0;
  return (
    <View style={barStyles.wrapper}>
      <View style={barStyles.labelRow}>
        <Text style={[barStyles.label, { color }]}>{label}</Text>
        <Text style={barStyles.values}>{Math.round(current)} / {Math.round(target)}{label === 'Calorías' ? ' kcal' : ' g'}</Text>
      </View>
      <View style={barStyles.track}>
        <View style={[barStyles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrapper: { marginBottom: 10 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontWeight: 'bold', fontSize: 13 },
  values: { fontSize: 12, color: '#aaa' },
  track: { height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
});

// ── Gráfico de barras horizontal para historial ─────────────────────────────
function DayBarChart({ data, field, color, label, target }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Number(d[field]) || 0), target || 1);
  return (
    <View style={chartSt.wrap}>
      <Text style={[chartSt.label, { color }]}>{label}</Text>
      <View style={chartSt.bars}>
        {data.map((d, i) => {
          const pct = maxVal > 0 ? (Number(d[field]) / maxVal) : 0;
          const overTarget = target && Number(d[field]) > target;
          return (
            <View key={i} style={chartSt.col}>
              <Text style={chartSt.val}>{Math.round(Number(d[field]))}</Text>
              <View style={[chartSt.bar, {
                height: Math.max(pct * 70, 3),
                backgroundColor: overTarget ? '#ff00c8' : color,
              }]} />
              <Text style={chartSt.dateLabel}>
                {new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}
              </Text>
            </View>
          );
        })}
      </View>
      {target && <Text style={chartSt.targetLine}>Meta: {target}</Text>}
    </View>
  );
}

const chartSt = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontWeight: 'bold', fontSize: 13, marginBottom: 6 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 90 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '85%', borderRadius: 3 },
  val: { color: '#aaa', fontSize: 8, marginBottom: 2 },
  dateLabel: { color: '#444', fontSize: 7, marginTop: 2, textAlign: 'center' },
  targetLine: { color: '#555', fontSize: 10, fontStyle: 'italic', marginTop: 4 },
});

// ── Componente principal ────────────────────────────────────────────────────
export default function DietScreen() {
  const [tab, setTab] = useState('hoy'); // 'hoy' | 'historial' | 'plan'

  const [dietPlan, setDietPlan] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [meals, setMeals] = useState([]);
  const [loadingMeals, setLoadingMeals] = useState(true);
  const [dailySummary, setDailySummary] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Modal de registro
  const [modalVisible, setModalVisible] = useState(false);
  const [mealName, setMealName] = useState('');
  const [mealCal, setMealCal] = useState('');
  const [mealProt, setMealProt] = useState('');
  const [mealCarbs, setMealCarbs] = useState('');
  const [mealFat, setMealFat] = useState('');
  const [savingMeal, setSavingMeal] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    try {
      const [planRes, mealsRes, summaryRes] = await Promise.all([
        api.get('/v2/diet/plan'),
        api.get(`/v2/diet/meals?date=${today}`),
        api.get('/v2/diet/daily-summary'),
      ]);
      setDietPlan(planRes.data);
      setMeals(mealsRes.data);
      setDailySummary(summaryRes.data);
    } catch (e) {
      console.error('Error cargando dieta', e);
    } finally {
      setLoadingMeals(false);
      setLoadingSummary(false);
    }
  }, [today]);

  useEffect(() => { loadData(); }, [loadData]);

  // Totales del día
  const todayTotals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein_g: acc.protein_g + (m.protein_g || 0),
    carbs_g: acc.carbs_g + (m.carbs_g || 0),
    fat_g: acc.fat_g + (m.fat_g || 0),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

  const targets = dietPlan?.daily_targets || { calories: 2000, protein_g: 130, carbs_g: 220, fat_g: 65 };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/v2/diet/generate');
      setDietPlan(res.data);
      Alert.alert('¡Dieta generada!', 'Tu plan de alimentación personalizado con alimentos colombianos está listo.');
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar el plan. Asegúrate de tener perfil completado.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveMeal = async () => {
    if (!mealName.trim()) { Alert.alert('Falta el nombre de la comida'); return; }
    setSavingMeal(true);
    try {
      const res = await api.post('/v2/diet/meals', {
        meal_name: mealName.trim(),
        calories: Number(mealCal) || 0,
        protein_g: Number(mealProt) || 0,
        carbs_g: Number(mealCarbs) || 0,
        fat_g: Number(mealFat) || 0,
      });
      setMeals(prev => [...prev, res.data]);
      setModalVisible(false);
      setMealName(''); setMealCal(''); setMealProt(''); setMealCarbs(''); setMealFat('');
    } catch (e) {
      Alert.alert('Error guardando comida');
    } finally {
      setSavingMeal(false);
    }
  };

  const handleDeleteMeal = (id) => {
    Alert.alert('Eliminar', '¿Eliminar esta comida?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await api.delete(`/v2/diet/meals/${id}`);
          setMeals(prev => prev.filter(m => m.id !== id));
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {[
          { key: 'hoy', label: '🍽️ Hoy' },
          { key: 'historial', label: '📊 Historial' },
          { key: 'plan', label: '📋 Plan IA' },
        ].map(t => (
          <TouchableOpacity key={t.key} style={[styles.tab, tab === t.key && styles.tabActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── TAB HOY ── */}
      {tab === 'hoy' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating}>
            {generating ? <ActivityIndicator color="#18181b" /> : <Text style={styles.generateBtnText}>⚡ Generar Dieta con IA</Text>}
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>📊 Progreso de hoy — {today}</Text>
            <MacroBar label="Calorías" current={todayTotals.calories} target={targets.calories} color="#fffb00" />
            <MacroBar label="Proteína" current={todayTotals.protein_g} target={targets.protein_g} color="#39ff14" />
            <MacroBar label="Carbos" current={todayTotals.carbs_g} target={targets.carbs_g} color="#00eaff" />
            <MacroBar label="Grasas" current={todayTotals.fat_g} target={targets.fat_g} color="#ff00c8" />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🍽️ Comidas de hoy</Text>
            {loadingMeals ? <ActivityIndicator color="#39ff14" /> :
              meals.length === 0 ? <Text style={styles.emptyText}>Sin registros hoy. Toca + para agregar.</Text> :
              meals.map(m => (
                <View key={m.id} style={styles.mealRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mealName}>{m.meal_name}</Text>
                    <Text style={styles.mealMacros}>🔥{Math.round(m.calories)} kcal · 🥩{Math.round(m.protein_g)}g · 🍞{Math.round(m.carbs_g)}g · 🥑{Math.round(m.fat_g)}g</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteMeal(m.id)}>
                    <Text style={styles.deleteBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            }
          </View>
        </ScrollView>
      )}

      {/* ── TAB HISTORIAL ── */}
      {tab === 'historial' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.sectionTitle}>📈 Historial de Macros — últimos 14 días</Text>
          {loadingSummary ? <ActivityIndicator color="#39ff14" style={{ marginTop: 30 }} /> :
            dailySummary.length === 0 ? <Text style={styles.emptyText}>Registra comidas para ver tu historial.</Text> :
            <>
              <View style={styles.card}>
                <DayBarChart data={dailySummary} field="calories" color="#fffb00" label="🔥 Calorías (kcal)" target={targets.calories} />
                <DayBarChart data={dailySummary} field="protein_g" color="#39ff14" label="🥩 Proteína (g)" target={targets.protein_g} />
                <DayBarChart data={dailySummary} field="carbs_g" color="#00eaff" label="🍞 Carbos (g)" target={targets.carbs_g} />
                <DayBarChart data={dailySummary} field="fat_g" color="#ff00c8" label="🥑 Grasas (g)" target={targets.fat_g} />
              </View>

              {/* Tabla resumen */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>📋 Resumen diario</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableCell, styles.tableHead, { flex: 2 }]}>Fecha</Text>
                  <Text style={[styles.tableCell, styles.tableHead]}>kcal</Text>
                  <Text style={[styles.tableCell, styles.tableHead]}>🥩g</Text>
                  <Text style={[styles.tableCell, styles.tableHead]}>🍞g</Text>
                  <Text style={[styles.tableCell, styles.tableHead]}>🥑g</Text>
                </View>
                {[...dailySummary].reverse().map((d, i) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
                    <Text style={[styles.tableCell, { flex: 2, color: '#aaa' }]}>{new Date(d.date + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })}</Text>
                    <Text style={[styles.tableCell, { color: '#fffb00' }]}>{d.calories}</Text>
                    <Text style={[styles.tableCell, { color: '#39ff14' }]}>{d.protein_g}</Text>
                    <Text style={[styles.tableCell, { color: '#00eaff' }]}>{d.carbs_g}</Text>
                    <Text style={[styles.tableCell, { color: '#ff00c8' }]}>{d.fat_g}</Text>
                  </View>
                ))}
              </View>
            </>
          }
        </ScrollView>
      )}

      {/* ── TAB PLAN IA ── */}
      {tab === 'plan' && (
        <ScrollView contentContainerStyle={styles.scroll}>
          <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate} disabled={generating}>
            {generating ? <ActivityIndicator color="#18181b" /> : <Text style={styles.generateBtnText}>⚡ {dietPlan ? 'Regenerar Dieta' : 'Generar Dieta con IA'}</Text>}
          </TouchableOpacity>

          {dietPlan ? (
            <View style={styles.card}>
              {dietPlan.saved_at && <Text style={styles.savedAt}>Generado: {new Date(dietPlan.saved_at).toLocaleDateString('es-CO')}</Text>}
              <Text style={styles.cardTitle}>📋 Tu Plan Semanal</Text>
              <Text style={styles.adviceText}>{dietPlan.general_advice}</Text>
              {dietPlan.weekly_plan?.map((day, i) => (
                <View key={i} style={styles.dayBlock}>
                  <Text style={styles.dayTitle}>{day.day}</Text>
                  {day.meals?.map((meal, j) => (
                    <View key={j} style={styles.planMealRow}>
                      <Text style={styles.planMealTime}>{meal.time}</Text>
                      <Text style={styles.planMealFoods}>{meal.foods?.join(' · ')}</Text>
                      <Text style={styles.planMealMacros}>🔥{meal.calories} · 🥩{meal.protein_g}g · 🍞{meal.carbs_g}g · 🥑{meal.fat_g}g</Text>
                    </View>
                  ))}
                </View>
              ))}
              {dietPlan.shopping_tips && (
                <View style={styles.tipsBox}>
                  <Text style={styles.tipsTitle}>🛒 Tips de compra</Text>
                  <Text style={styles.tipsText}>{dietPlan.shopping_tips}</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>Aún no tienes un plan. Toca el botón para generarlo.</Text>
          )}
        </ScrollView>
      )}

      {/* FAB + para registrar comida (solo en tab hoy) */}
      {tab === 'hoy' && (
        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Modal para registrar comida */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🍽️ Registrar Comida</Text>
            <Text style={styles.inputLabel}>Nombre *</Text>
            <TextInput style={styles.input} placeholder="Ej: Almuerzo — arroz con pollo" placeholderTextColor="#555" value={mealName} onChangeText={setMealName} />
            <View style={styles.row4}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Calorías</Text>
                <TextInput style={styles.input} placeholder="kcal" placeholderTextColor="#555" keyboardType="numeric" value={mealCal} onChangeText={setMealCal} />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Proteína (g)</Text>
                <TextInput style={styles.input} placeholder="g" placeholderTextColor="#555" keyboardType="numeric" value={mealProt} onChangeText={setMealProt} />
              </View>
            </View>
            <View style={styles.row4}>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Carbos (g)</Text>
                <TextInput style={styles.input} placeholder="g" placeholderTextColor="#555" keyboardType="numeric" value={mealCarbs} onChangeText={setMealCarbs} />
              </View>
              <View style={styles.inputHalf}>
                <Text style={styles.inputLabel}>Grasas (g)</Text>
                <TextInput style={styles.input} placeholder="g" placeholderTextColor="#555" keyboardType="numeric" value={mealFat} onChangeText={setMealFat} />
              </View>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveMeal} disabled={savingMeal}>
                {savingMeal ? <ActivityIndicator color="#18181b" /> : <Text style={styles.saveBtnText}>Guardar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },
  tabBar: { flexDirection: 'row', backgroundColor: '#232946', borderBottomWidth: 2, borderBottomColor: '#ff00c8', paddingTop: 50 },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  tabActive: { borderBottomWidth: 3, borderBottomColor: '#39ff14' },
  tabText: { color: '#555', fontWeight: 'bold', fontSize: 12 },
  tabTextActive: { color: '#39ff14', textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  scroll: { padding: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#ff00c8', marginBottom: 12, textShadowColor: '#fffb00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 4 },
  generateBtn: { backgroundColor: '#39ff14', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginBottom: 16, shadowColor: '#39ff14', shadowOpacity: 0.6, shadowRadius: 10, elevation: 4 },
  generateBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 16 },
  card: { backgroundColor: '#232946', borderRadius: 14, padding: 16, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#ff00c8' },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: '#ff00c8', marginBottom: 12 },
  savedAt: { color: '#555', fontSize: 11, fontStyle: 'italic', marginBottom: 6 },
  emptyText: { color: '#666', fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },
  mealRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 8 },
  mealName: { color: '#00eaff', fontWeight: '600', fontSize: 14 },
  mealMacros: { color: '#aaa', fontSize: 12, marginTop: 2 },
  deleteBtn: { color: '#ff00c8', fontSize: 18, paddingHorizontal: 8 },
  adviceText: { color: '#fffb00', fontSize: 13, marginBottom: 12, lineHeight: 20 },
  dayBlock: { marginBottom: 12 },
  dayTitle: { color: '#39ff14', fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
  planMealRow: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 8, marginBottom: 5 },
  planMealTime: { color: '#ff00c8', fontWeight: 'bold', fontSize: 12, marginBottom: 2 },
  planMealFoods: { color: '#ccc', fontSize: 12, lineHeight: 17 },
  planMealMacros: { color: '#666', fontSize: 10, marginTop: 3 },
  tipsBox: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 10, marginTop: 8 },
  tipsTitle: { color: '#fffb00', fontWeight: 'bold', marginBottom: 4, fontSize: 13 },
  tipsText: { color: '#aaa', fontSize: 12, lineHeight: 17 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#ff00c8', paddingBottom: 5, marginBottom: 3 },
  tableRow: { flexDirection: 'row', paddingVertical: 5 },
  tableRowAlt: { backgroundColor: '#1a1a2e' },
  tableCell: { flex: 1, fontSize: 11, textAlign: 'center' },
  tableHead: { color: '#ff00c8', fontWeight: 'bold', fontSize: 11 },
  fab: { position: 'absolute', right: 20, bottom: 24, backgroundColor: '#ff00c8', width: 62, height: 62, borderRadius: 31, justifyContent: 'center', alignItems: 'center', shadowColor: '#ff00c8', shadowOpacity: 0.8, shadowRadius: 12, elevation: 6 },
  fabText: { color: '#18181b', fontSize: 32, fontWeight: 'bold', lineHeight: 36 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#232946', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#39ff14', marginBottom: 16 },
  inputLabel: { color: '#00eaff', fontSize: 13, fontWeight: '600', marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#00eaff', borderRadius: 8, padding: 10, color: '#39ff14', fontSize: 14 },
  row4: { flexDirection: 'row', gap: 10 },
  inputHalf: { flex: 1 },
  modalBtns: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: '#00eaff', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#00eaff', fontWeight: 'bold' },
  saveBtn: { flex: 1, backgroundColor: '#39ff14', borderRadius: 10, paddingVertical: 14, alignItems: 'center', shadowColor: '#39ff14', shadowOpacity: 0.5, shadowRadius: 8 },
  saveBtnText: { color: '#18181b', fontWeight: 'bold', fontSize: 15 },
});

