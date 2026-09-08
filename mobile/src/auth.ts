import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { apiOrigin } from '@fintrack/client';
import { chunkedStorage } from './secureStorage';

export function createAuth() {
  const origin = apiOrigin(process.env.EXPO_PUBLIC_API_URL ?? '', __DEV__);
  const url = apiOrigin(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', __DEV__);
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!key || key.startsWith('sb_secret_')) throw new Error('Configure only the public Supabase anon/publishable key.');
  // A public key is bundle configuration. Service-role/provider credentials are forbidden.
  const storage = chunkedStorage({
    getItem: key => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    removeItem: key => SecureStore.deleteItemAsync(key),
  }, Crypto.randomUUID);
  const supabase = createClient(url, key, { auth: {
    storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, lock: processLock,
  }});
  return { supabase, origin };
}
export type Auth = ReturnType<typeof createAuth>;
