import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme/colors';
import { TabBarIcon } from '../components/ui';
import { LoginScreen } from '../screens/LoginScreen';
import { MissionsScreen } from '../screens/MissionsScreen';
import { MissionDetailScreen } from '../screens/MissionDetailScreen';
import { DynamicMissionFormScreen } from '../screens/DynamicMissionFormScreen';
import { StockScreen } from '../screens/StockScreen';
import { StockDetailScreen } from '../screens/StockDetailScreen';
import { StockScanScreen } from '../screens/StockScanScreen';
import { SerialDetailScreen } from '../screens/SerialDetailScreen';
import { StockMoveScreen } from '../screens/StockMoveScreen';
import { AssistScreen } from '../screens/AssistScreen';
import { VisionAssistScreen } from '../screens/VisionAssistScreen';
import { VocalAssistScreen } from '../screens/VocalAssistScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ConversationScreen } from '../screens/ConversationScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { IncidentScreen } from '../screens/IncidentScreen';
import { ExpenseScreen } from '../screens/ExpenseScreen';
import { PresenceScreen } from '../screens/PresenceScreen';
import { VehicleCheckScreen } from '../screens/VehicleCheckScreen';
import { LeaveScreen } from '../screens/LeaveScreen';
import { MissionConsoScreen } from '../screens/MissionConsoScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';

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

const tabBarOpts = {
  headerShown: false as const,
  tabBarStyle: {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    height: 62,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.muted,
  tabBarLabelStyle: { fontSize: 10, fontWeight: '600' as const },
};

function ChefTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tabs.Navigator screenOptions={tabBarOpts}>
      <Tabs.Screen
        name="MissionsTab"
        component={MissionsScreen}
        options={{
          title: 'Missions',
          tabBarIcon: ({ focused }) => <TabBarIcon name="missions" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="StockTab"
        component={StockScreen}
        options={{
          title: 'Stock',
          tabBarIcon: ({ focused }) => <TabBarIcon name="stock" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="AssistTab"
        component={AssistScreen}
        options={{
          title: 'Assist',
          tabBarIcon: ({ focused }) => <TabBarIcon name="assist" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="EspaceTab"
        options={{
          title: 'Espace',
          tabBarIcon: ({ focused }) => <TabBarIcon name="profile" focused={focused} />,
        }}
      >
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tabs.Screen>
    </Tabs.Navigator>
  );
}

function MagasinierTabs({ onLogout }: { onLogout: () => void }) {
  return (
    <Tabs.Navigator screenOptions={tabBarOpts}>
      <Tabs.Screen
        name="StockTab"
        component={StockScreen}
        options={{
          title: 'Stock',
          tabBarIcon: ({ focused }) => <TabBarIcon name="stock" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="AssistTab"
        component={AssistScreen}
        options={{
          title: 'Assist',
          tabBarIcon: ({ focused }) => <TabBarIcon name="assist" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="EspaceTab"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => <TabBarIcon name="profile" focused={focused} />,
        }}
      >
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
        <Stack.Screen name="StockDetail" component={StockDetailScreen} options={{ title: 'Article' }} />
        <Stack.Screen name="StockScan" component={StockScanScreen} options={{ title: 'Scanner' }} />
        <Stack.Screen name="SerialDetail" component={SerialDetailScreen} options={{ title: 'Série' }} />
        <Stack.Screen name="StockMove" component={StockMoveScreen} options={{ title: 'Mouvement' }} />
        <Stack.Screen name="VisionAssist" component={VisionAssistScreen} options={{ title: 'Vision' }} />
        <Stack.Screen name="VocalAssist" component={VocalAssistScreen} options={{ title: 'Vocal' }} />
        <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
        <Stack.Screen name="Conversation" component={ConversationScreen} options={{ title: 'Conversation' }} />
        <Stack.Screen name="Incident" component={IncidentScreen} options={{ title: 'Incident' }} />
        <Stack.Screen name="Expense" component={ExpenseScreen} options={{ title: 'Dépense' }} />
        <Stack.Screen name="Presence" component={PresenceScreen} options={{ title: 'Présence' }} />
        <Stack.Screen name="VehicleCheck" component={VehicleCheckScreen} options={{ title: 'Véhicule' }} />
        <Stack.Screen name="Leave" component={LeaveScreen} options={{ title: 'Congé' }} />
        <Stack.Screen name="MissionConso" component={MissionConsoScreen} options={{ title: 'Conso' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Réglages' }} />
        <Stack.Screen name="ChangePassword" options={{ title: 'Mot de passe' }}>
          {() => <ChangePasswordScreen />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export function AuthGate({
  ready,
  userRole,
  mustChangePassword,
  onLogin,
  onLogout,
}: {
  ready: boolean;
  userRole: string | null;
  mustChangePassword?: boolean;
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
  if (mustChangePassword) {
    return (
      <NavigationContainer theme={navTheme}>
        <ChangePasswordScreen forced onDone={onLogin} onLogout={onLogout} />
      </NavigationContainer>
    );
  }
  return <RootNavigator userRole={userRole} onLogout={onLogout} />;
}
