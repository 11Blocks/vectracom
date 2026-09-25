import 'react-native-gesture-handler';
// Enregistre la task GPS background avant tout (requis TaskManager)
import './tracking/background';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { registerRootComponent } from 'expo';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthGate } from './navigation/RootNavigator';
import { getUser, onAuthExpired, onPasswordChangeRequired, loadApiUrlOverride } from './services/api';
import { startAutoFlush } from './offline/queue';
import { startForegroundTracking, stopForegroundTracking } from './tracking/foreground';
import { startBackgroundTracking, stopBackgroundTracking } from './tracking/background';
import { registerPushToken } from './services/push';
import { colors } from './theme/colors';
import { ToastProvider } from './components/ui';

async function startTracking() {
  await startForegroundTracking().catch(() => undefined);
  // Background : best-effort (nécessite build native + permission Always)
  await startBackgroundTracking().catch(() => undefined);
}

function stopTracking() {
  stopForegroundTracking();
  stopBackgroundTracking().catch(() => undefined);
}

function App() {
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const refresh = useCallback(async () => {
    const user = await getUser();
    setRole(user?.role ?? null);
    setMustChangePassword(Boolean(user?.mustChangePassword));
    setReady(true);
    if (user) {
      startTracking().catch(() => undefined);
      // Push : stub sous Expo Go Android ; réel via push.register en dev build
      registerPushToken().catch(() => undefined);
    } else {
      stopTracking();
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadApiUrlOverride();
      await refresh();
    })();
    startAutoFlush();
    const unsub = onAuthExpired(() => {
      stopTracking();
      setRole(null);
    });
    const unsubPwd = onPasswordChangeRequired(() => setMustChangePassword(true));
    return () => {
      stopTracking();
      unsub();
      unsubPwd();
    };
  }, [refresh]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <AuthGate
            ready={ready}
            userRole={role}
            mustChangePassword={mustChangePassword}
            onLogin={refresh}
            onLogout={() => {
              stopTracking();
              setRole(null);
            }}
          />
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

registerRootComponent(App);
export default App;
