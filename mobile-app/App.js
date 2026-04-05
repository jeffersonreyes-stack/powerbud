import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import api from './src/api';

// Pantallas
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import DietScreen from './src/screens/DietScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import TrainerClientsScreen from './src/screens/TrainerClientsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- El Menú de Pestañas Inferiores ---
function MainTabNavigator({ setIsAuthenticated, userRole }) {
  const insets = useSafeAreaInsets();

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get('/v2/notifications/unread-count');
        setUnreadCount(res.data.count || 0);
      } catch { /* silencioso */ }
    };
    fetchUnread();
    const t = setInterval(fetchUnread, 60000); // poll cada 60s
    return () => clearInterval(t);
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Inicio') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Dieta') {
            iconName = focused ? 'restaurant' : 'restaurant-outline';
          } else if (route.name === 'Rutina') {
            iconName = focused ? 'barbell' : 'barbell-outline';
          } else if (route.name === 'Progreso') {
            iconName = focused ? 'body' : 'body-outline';
          } else if (route.name === 'Reseñas') {
            iconName = focused ? 'star' : 'star-outline';
          } else if (route.name === 'Mis Clientes') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Avisos') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          }
          return (
            <View>
              <Ionicons name={iconName} size={size} color={color} style={{ textShadowColor: focused ? '#ff00c8' : undefined, textShadowRadius: focused ? 8 : 0 }} />
              {route.name === 'Avisos' && unreadCount > 0 && (
                <View style={badgeStyle.dot}>
                  <Text style={badgeStyle.dotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
          );
        },
        tabBarActiveTintColor: '#39ff14',
        tabBarInactiveTintColor: '#00eaff',
        tabBarStyle: {
          backgroundColor: '#18181b',
          borderTopColor: '#ff00c8',
          borderTopWidth: 2,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 5,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
          shadowColor: '#ff00c8',
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 8,
        },
        tabBarLabelStyle: {
          fontWeight: 'bold',
          textShadowColor: '#fffb00',
          textShadowRadius: 6,
        },
      })}
    >
      <Tab.Screen name="Inicio">
        {props => <DashboardScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
      </Tab.Screen>

      {/* Tabs exclusivos de clientes */}
      {userRole === 'client' && <Tab.Screen name="Dieta" component={DietScreen} />}
      {userRole === 'client' && <Tab.Screen name="Rutina" component={WorkoutScreen} />}
      {userRole === 'client' && <Tab.Screen name="Progreso" component={ProgressScreen} />}
      {userRole === 'client' && <Tab.Screen name="Reseñas" component={ReviewScreen} />}

      {/* Nutricionista: acceso a dieta para sus clientes */}
      {userRole === 'nutritionist' && <Tab.Screen name="Dieta" component={DietScreen} />}

      {/* Profesionales: panel de clientes */}
      {(userRole === 'trainer' || userRole === 'nutritionist') && (
        <Tab.Screen name="Mis Clientes" component={TrainerClientsScreen} />
      )}

      <Tab.Screen
        name="Avisos"
        component={NotificationsScreen}
        listeners={{ tabPress: () => setUnreadCount(0) }}
      />
    </Tab.Navigator>
  );
}

const badgeStyle = StyleSheet.create({
  dot: {
    position: 'absolute', top: -3, right: -6,
    backgroundColor: '#ff00c8', borderRadius: 8,
    minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  dotText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
});

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('client');
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const checkOnboardingStatus = async () => {
    try {
      const res = await api.get('/v2/user-profile');
      if (!res.data || !res.data.goal) {
        setNeedsOnboarding(true);
      } else {
        setNeedsOnboarding(false);
      }
    } catch {
      setNeedsOnboarding(true);
    }
  };

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userInfo = await AsyncStorage.getItem('userInfo');
        if (token && userInfo) {
          setIsAuthenticated(true);
          setUserRole(JSON.parse(userInfo).role);
          await checkOnboardingStatus();
        }
      } catch (e) {
        console.error('Error leyendo token local', e);
      } finally {
        setLoading(false);
      }
    };

    checkToken();
  }, []);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2a9df4" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        {/* Sistema de Navegación "Switch" basado en Estado */}
        {!isAuthenticated ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Login">
              {props => <LoginScreen {...props} setIsAuthenticated={async (val) => {
                 setIsAuthenticated(val);
                 const ui = await AsyncStorage.getItem('userInfo');
                 if (ui) setUserRole(JSON.parse(ui).role);
                 await checkOnboardingStatus();
              }} />}
            </Stack.Screen>
            <Stack.Screen name="Register" component={RegisterScreen} />
          </Stack.Navigator>
        ) : needsOnboarding ? (
          <OnboardingScreen onComplete={() => setNeedsOnboarding(false)} userRole={userRole} />
        ) : (
          <MainTabNavigator setIsAuthenticated={setIsAuthenticated} userRole={userRole} />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#18181b', // Cyberpunk dark
  },
});
