import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { Database } from '../types/database';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Custom storage adapter that uses SecureStore on native platforms
 * and localStorage on web. SecureStore has a 2048 byte limit per item,
 * so large values are handled gracefully with error recovery.
 */
const ExpoSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }

    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.warn(
        `SecureStore getItem failed for key "${key}":`,
        error instanceof Error ? error.message : error
      );
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn(
          `localStorage setItem failed for key "${key}":`,
          error instanceof Error ? error.message : error
        );
      }
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      // SecureStore has a 2048 byte limit per item on some platforms.
      // If the value exceeds the limit, log and fail silently so the
      // session can still function (it just won't persist across restarts).
      console.warn(
        `SecureStore setItem failed for key "${key}" (value length: ${value.length}):`,
        error instanceof Error ? error.message : error
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore removal errors on web
      }
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(
        `SecureStore removeItem failed for key "${key}":`,
        error instanceof Error ? error.message : error
      );
    }
  },
};

/**
 * Supabase client configured with secure storage for auth token persistence.
 * Typed with the application's Database schema for full type safety.
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Retrieve the current auth session.
 * Returns null if no active session exists.
 */
export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Failed to get session:', error.message);
      return null;
    }
    return data.session;
  } catch (error) {
    console.error(
      'Unexpected error getting session:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Retrieve the current authenticated user.
 * Returns null if no user is signed in.
 */
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error('Failed to get current user:', error.message);
      return null;
    }
    return data.user;
  } catch (error) {
    console.error(
      'Unexpected error getting current user:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
