import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

// Pantallas
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import DietScreen from './src/screens/DietScreen';
import WorkoutScreen from './src/screens/WorkoutScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import ReviewScreen from './src/screens/ReviewScreen';
import TrainerClientsScreen from './src/screens/TrainerClientsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- El Menú de Pestañas Inferiores ---
function MainTabNavigator({ setIsAuthenticated, userRole }) {
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
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2a9df4',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: { paddingBottom: 5, paddingTop: 5, height: 60 }
      })}
    >
      {/* Pasamos setIsAuthenticated al Dashboard para que pueda cerrar sesión */}
      <Tab.Screen name="Inicio">
        {props => <DashboardScreen {...props} setIsAuthenticated={setIsAuthenticated} />}
      </Tab.Screen>
      <Tab.Screen name="Dieta" component={DietScreen} />
      <Tab.Screen name="Rutina" component={WorkoutScreen} />

      {/* Diferenciar Menú según Rol: Clientes ven Progreso/Reseñas, Entrenadores ven sus Clientes */}
      {userRole === 'client' ? (
        <>
          <Tab.Screen name="Progreso" component={ProgressScreen} />
          <Tab.Screen name="Reseñas" component={ReviewScreen} />
        </>
      ) : (
        <Tab.Screen name="Mis Clientes" component={TrainerClientsScreen} />
      )}
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('client');
  const [loading, setLoading] = useState(true);

  // Al abrir la app en el celular, revisamos rápido la "Bóveda" (AsyncStorage)
  // para ver si el usuario ya se había logueado la semana pasada
  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userInfo = await AsyncStorage.getItem('userInfo');
        if (token && userInfo) {
          setIsAuthenticated(true);
          setUserRole(JSON.parse(userInfo).role);
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
    <NavigationContainer>
      {/* Sistema de Navegación "Switch" basado en Estado */}
      {!isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login">
            {props => <LoginScreen {...props} setIsAuthenticated={(val) => {
               setIsAuthenticated(val);
               AsyncStorage.getItem('userInfo').then(ui => {
                  if(ui) setUserRole(JSON.parse(ui).role);
               });
            }} />}
          </Stack.Screen>
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      ) : (
        <MainTabNavigator setIsAuthenticated={setIsAuthenticated} userRole={userRole} />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
