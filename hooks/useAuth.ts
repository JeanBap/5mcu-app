import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Session, User } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { Profile } from '@/types/database';

/**
 * SecureStore-based storage adapter for zustand persist middleware.
 * Stores sensitive auth state in the device's secure enclave.
 */
const secureStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return SecureStore.getItemAsync(name);
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await SecureStore.deleteItemAsync(name);
  },
};

interface AuthState {
  /** Current Supabase session, null if not authenticated */
  session: Session | null;
  /** Current Supabase user object, null if not authenticated */
  user: User | null;
  /** User profile from the profiles table, null if not loaded */
  profile: Profile | null;
  /** Whether an auth operation is in progress */
  isLoading: boolean;
  /** Whether the auth state has been initialized from storage/listener */
  isInitialized: boolean;
}

interface AuthActions {
  /** Set up the auth state listener and restore session */
  initialize: () => void;
  /** Sign in with email and password */
  signInWithEmail: (email: string, password: string) => Promise<void>;
  /** Create a new account with email, password, and full name */
  signUpWithEmail: (email: string, password: string, fullName: string) => Promise<void>;
  /** Sign in with Google OAuth */
  signInWithGoogle: () => Promise<void>;
  /** Sign in with Apple OAuth */
  signInWithApple: () => Promise<void>;
  /** Sign out and reset all auth state */
  signOut: () => Promise<void>;
  /** Update the user profile in the database and local state */
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  /** Re-fetch the user profile from the database */
  refreshProfile: () => Promise<void>;
}

/**
 * Fetch a user profile from the profiles table by user ID.
 */
async function fetchProfileById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('fmcu_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to fetch profile:', error.message);
    return null;
  }

  return data as Profile;
}

/**
 * Primary authentication store for the 5MCU app.
 *
 * Uses zustand with persist middleware backed by expo-secure-store
 * to keep session data encrypted on device.
 *
 * @example
 * ```tsx
 * const { user, profile, signInWithEmail } = useAuth();
 * ```
 */
export const useAuth = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      profile: null,
      isLoading: false,
      isInitialized: false,

      initialize: () => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            set({ session, user: session?.user ?? null });

            if (session?.user) {
              const profile = await fetchProfileById(session.user.id);
              set({ profile, isInitialized: true });
            } else {
              set({ profile: null, isInitialized: true });
            }
          }
        );

        // Return the unsubscribe function for cleanup
        return () => {
          subscription.unsubscribe();
        };
      },

      signInWithEmail: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            if (error.message.includes('Invalid login credentials')) {
              throw new Error('Incorrect email or password. Please try again.');
            }
            if (error.message.includes('Email not confirmed')) {
              throw new Error(
                'Please verify your email address before signing in. Check your inbox for a confirmation link.'
              );
            }
            throw new Error(error.message);
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      signUpWithEmail: async (
        email: string,
        password: string,
        fullName: string
      ) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
          });

          if (error) {
            if (
              error.message.includes('User already registered') ||
              error.message.includes('already been registered')
            ) {
              throw new Error(
                'An account with this email already exists. Please sign in instead.'
              );
            }
            if (error.message.includes('Password')) {
              throw new Error(
                'Password must be at least 6 characters long.'
              );
            }
            throw new Error(error.message);
          }

          if (data.user) {
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const { error: profileError } = await supabase
              .from('fmcu_profiles')
              .upsert({
                id: data.user.id,
                full_name: fullName,
                timezone,
                updated_at: new Date().toISOString(),
              });

            if (profileError) {
              console.error('Failed to create profile:', profileError.message);
            }
          }
        } catch (error) {
          set({ isLoading: false });
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      signInWithGoogle: async () => {
        set({ isLoading: true });
        try {
          await GoogleSignin.hasPlayServices();
          const signInResult = await GoogleSignin.signIn();

          const idToken = signInResult?.data?.idToken;
          if (!idToken) {
            throw new Error(
              'Google sign-in failed: no authentication token received. Please try again.'
            );
          }

          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'google',
            token: idToken,
          });

          if (error) {
            throw new Error(
              `Google sign-in failed: ${error.message}`
            );
          }
        } catch (error: any) {
          set({ isLoading: false });
          if (error?.code === 'SIGN_IN_CANCELLED') {
            throw new Error('Google sign-in was cancelled.');
          }
          if (error?.code === 'IN_PROGRESS') {
            throw new Error(
              'A sign-in operation is already in progress. Please wait.'
            );
          }
          if (error?.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
            throw new Error(
              'Google Play Services is not available on this device.'
            );
          }
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      signInWithApple: async () => {
        set({ isLoading: true });
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          if (!credential.identityToken) {
            throw new Error(
              'Apple sign-in failed: no identity token received. Please try again.'
            );
          }

          const { error } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });

          if (error) {
            throw new Error(
              `Apple sign-in failed: ${error.message}`
            );
          }
        } catch (error: any) {
          set({ isLoading: false });
          if (error?.code === 'ERR_REQUEST_CANCELED') {
            throw new Error('Apple sign-in was cancelled.');
          }
          throw error;
        } finally {
          set({ isLoading: false });
        }
      },

      signOut: async () => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.signOut();
          if (error) {
            throw new Error(`Sign out failed: ${error.message}`);
          }
          set({
            session: null,
            user: null,
            profile: null,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      updateProfile: async (updates: Partial<Profile>) => {
        const { user } = get();
        if (!user) {
          throw new Error('You must be signed in to update your profile.');
        }

        set({ isLoading: true });
        try {
          const { data, error } = await supabase
            .from('fmcu_profiles')
            .update({
              ...updates,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
            .select()
            .single();

          if (error) {
            throw new Error(`Failed to update profile: ${error.message}`);
          }

          set({ profile: data as Profile, isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      refreshProfile: async () => {
        const { user } = get();
        if (!user) {
          return;
        }

        const profile = await fetchProfileById(user.id);
        set({ profile });
      },
    }),
    {
      name: '5mcu-auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        session: state.session,
        user: state.user,
        profile: state.profile,
      }),
    }
  )
);

/**
 * Get the current auth state outside of React components.
 *
 * Useful for API interceptors, navigation guards, or utility functions
 * that need access to the current user without being inside a component.
 *
 * @example
 * ```ts
 * const { user, session } = getAuthState();
 * if (!user) throw new Error('Not authenticated');
 * ```
 */
export function getAuthState(): AuthState {
  const state = useAuth.getState();
  return {
    session: state.session,
    user: state.user,
    profile: state.profile,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
  };
}
