import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import api from '../api';

const TYPE_CONFIG = {
  system:       { icon: '🔔', color: '#00eaff',  label: 'Sistema' },
  trainer:      { icon: '🏋️', color: '#39ff14',  label: 'Entrenador' },
  nutritionist: { icon: '🥗', color: '#ff00c8',  label: 'Nutricionista' },
};

function NotifCard({ item, onRead, onDelete }) {
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.system;
  const date = new Date(item.created_at).toLocaleDateString('es-CO', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <View style={[styles.card, !item.read && styles.cardUnread]}>
      <View style={styles.cardTop}>
        <View style={styles.typeRow}>
          <Text style={styles.typeIcon}>{cfg.icon}</Text>
          <Text style={[styles.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
          {item.sender_name && (
            <Text style={styles.senderName}> · {item.sender_name}</Text>
          )}
        </View>
        <Text style={styles.dateText}>{date}</Text>
      </View>

      <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>

      <View style={styles.cardActions}>
        {!item.read && (
          <TouchableOpacity style={styles.readBtn} onPress={() => onRead(item.id)}>
            <Text style={styles.readBtnText}>✓ Marcar leída</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(item.id)}>
          <Text style={styles.deleteBtnText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/v2/notifications');
      setNotifications(res.data);
    } catch (e) {
      console.error('Error cargando notificaciones', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const handleRead = async (id) => {
    try {
      await api.put(`/v2/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch {
      Alert.alert('Error', 'No se pudo marcar como leída');
    }
  };

  const handleReadAll = async () => {
    try {
      await api.put('/v2/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch {
      Alert.alert('Error', 'No se pudo actualizar');
    }
  };

  const handleDelete = (id) => {
    Alert.alert('Eliminar', '¿Eliminar esta notificación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/v2/notifications/${id}`);
            setNotifications(prev => prev.filter(n => n.id !== id));
          } catch {
            Alert.alert('Error', 'No se pudo eliminar');
          }
        }
      }
    ]);
  };

  const displayed = filter === 'unread'
    ? notifications.filter(n => !n.read)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Notificaciones</Text>
          <Text style={styles.headerSub}>
            {unreadCount > 0 ? `${unreadCount} sin leer` : 'Todo al día ✓'}
          </Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity style={styles.readAllBtn} onPress={handleReadAll}>
            <Text style={styles.readAllText}>✓ Todas leídas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <View style={styles.filterBar}>
        {['all', 'unread'].map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'Todas' : `Sin leer${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#ff00c8" style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <NotifCard item={item} onRead={handleRead} onDelete={handleDelete} />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor="#ff00c8" />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyIcon}>🔕</Text>
              <Text style={styles.emptyText}>
                {filter === 'unread' ? 'No tienes notificaciones sin leer' : 'Sin notificaciones aún'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#18181b' },

  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#232946',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottomWidth: 2,
    borderBottomColor: '#ff00c8',
  },
  headerTitle: {
    fontSize: 26, fontWeight: 'bold', color: '#39ff14',
    textShadowColor: '#ff00c8', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  headerSub: { color: '#00eaff', fontSize: 13, marginTop: 3 },
  readAllBtn: {
    backgroundColor: '#232946', borderWidth: 1, borderColor: '#39ff14',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
  },
  readAllText: { color: '#39ff14', fontSize: 12, fontWeight: '700' },

  filterBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#18181b', gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#333',
  },
  filterChipActive: { backgroundColor: '#ff00c8', borderColor: '#ff00c8' },
  filterText: { color: '#555', fontWeight: '600', fontSize: 13 },
  filterTextActive: { color: '#fff' },

  list: { padding: 16, paddingBottom: 30 },

  card: {
    backgroundColor: '#232946',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#333',
  },
  cardUnread: { borderLeftColor: '#ff00c8' },

  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typeIcon: { fontSize: 16 },
  typeLabel: { fontWeight: 'bold', fontSize: 12 },
  senderName: { color: '#888', fontSize: 12 },
  dateText: { color: '#444', fontSize: 11 },

  title: { color: '#aaa', fontWeight: '600', fontSize: 14, marginBottom: 5 },
  titleUnread: { color: '#fff' },
  body: { color: '#999', fontSize: 13, lineHeight: 20 },

  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 10, gap: 8 },
  readBtn: {
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#39ff14',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16,
  },
  readBtnText: { color: '#39ff14', fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  deleteBtnText: { fontSize: 18 },

  emptyWrap: { alignItems: 'center', marginTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#555', fontSize: 16, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 40 },
});
