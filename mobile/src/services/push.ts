/**
 * Entrée push sûre pour Expo Go Android (SDK 53+) :
 * ne jamais importer expo-notifications tant qu’on est dans Expo Go Android
 * (side-effect addPushTokenListener → red screen).
 */
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_TOKEN_KEY = 'vectracom_push_token';

export type PushCapability = 'expo-go-blocked' | 'dev-build' | 'available';

export function getPushCapability(): PushCapability {
  if (Platform.OS === 'android' && isRunningInExpoGo()) return 'expo-go-blocked';
  if (!isRunningInExpoGo()) return 'dev-build';
  return 'available'; // iOS Expo Go encore supporté côté Expo
}

export async function getLastPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_TOKEN_KEY);
}

export async function registerPushToken(): Promise<string | null> {
  if (getPushCapability() === 'expo-go-blocked') return null;
  try {
    const { registerPushTokenImpl } = await import('./push.register');
    const token = await registerPushTokenImpl();
    if (token) await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
    return token;
  } catch {
    return null;
  }
}
