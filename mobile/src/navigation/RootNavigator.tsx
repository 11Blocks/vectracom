import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme/colors';
import { LoginScreen } from '../screens/LoginScreen';
import { MissionsScreen } from '../screens/MissionsScreen';
import { MissionDetailScreen } from '../screens/MissionDetailScreen';
import { DynamicMissionFormScreen } from '../screens/DynamicMissionFormScreen';
import { StockScreen } from '../screens/StockScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { IncidentScreen } from '../screens/IncidentScreen';
import { ExpenseScreen } from '../screens/ExpenseScreen';
import { PresenceScreen } from '../screens/PresenceScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg,
    card: colors.card,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
  },
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 10, fontWeight: focused ? '700' : '500', color: focused ? colors.primary : colors.muted }}>
      {label}
    </Text>
  );
}

function ChefTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 58,
          paddingBottom: 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen
        name="MissionsTab"
        component={MissionsScreen}
        options={{ title: 'Missions', tabBarIcon: ({ focused }) => <TabIcon label="📋" focused={focused} /> }}
      />
      <Tabs.Screen
        name="StockTab"
        component={StockScreen}
        options={{ title: 'Stock', tabBarIcon: ({ focused }) => <TabIcon label="📦" focused={focused} /> }}
      />
      <Tabs.Screen
        name="EspaceTab"
        options={{ title: 'Espace', tabBarIcon: ({ focused }) => <TabIcon label="👤" focused={focused} /> }}
      >
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

function MagasinierTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen name="StockTab" component={StockScreen} options={{ title: 'Stock' }} />
      <Tabs.Screen name="EspaceTab" options={{ title: 'Profil' }}>
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

export function RootNavigator({
  userRole,
  onLogout,
}: {
  userRole: string | null;
  onLogout: () => void;
}) {
  const isMag = userRole === 'magasinier';

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600', fontSize: 16 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="MainTabs" options={{ headerShown: false }}>
          {() => (isMag ? <MagasinierTabs onLogout={onLogout} /> : <ChefTabs onLogout={onLogout} />)}
        </Stack.Screen>
        <Stack.Screen name="MissionDetail" component={MissionDetailScreen} options={{ title: 'Détail' }} />
        <Stack.Screen name="MissionForm" component={DynamicMissionFormScreen} options={{ title: 'Formulaire' }} />
        <Stack.Screen name="Incident" component={IncidentScreen} options={{ title: 'Incident' }} />
        <Stack.Screen name="Expense" component={ExpenseScreen} options={{ title: 'Dépense' }} />
        <Stack.Screen name="Presence" component={PresenceScreen} options={{ title: 'Présence' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export function AuthGate({
  ready,
  userRole,
  onLogin,
  onLogout,
}: {
  ready: boolean;
  userRole: string | null;
  onLogin: () => void;
  onLogout: () => void;
}) {
  if (!ready) return null;
  if (!userRole) {
    return (
      <NavigationContainer theme={navTheme}>
        <LoginScreen onSuccess={onLogin} />
      </NavigationContainer>
    );
  }
  return <RootNavigator userRole={userRole} onLogout={onLogout} />;
}
