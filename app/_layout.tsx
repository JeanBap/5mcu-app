import { useEffect, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as ExpoNotifications from 'expo-notifications';
import { COLORS } from '@/constants/config';
import useAuth from '@/hooks/useAuth';
import { initPurchases } from '@/lib/purchases';
import {
  registerForPushNotifications,
  handleNotificationResponse,
  setupNotificationCategories,
} from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { initialize, isInitialized, user } = useAuth();
  const notificationListener = useRef<ExpoNotifications.Subscription | null>(null);
  const responseListener = useRef<ExpoNotifications.Subscription | null>(null);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  useEffect(() => {
    setupNotificationCategories();

    notificationListener.current =
      ExpoNotifications.addNotificationReceivedListener((notification) => {
        // Foreground notification received — no-op by default.
        // The system notification banner handles display.
      });

    responseListener.current =
      ExpoNotifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationResponse(response);
      });

    return () => {
      if (notificationListener.current) {
        ExpoNotifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        ExpoNotifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    initPurchases(user.id);
    registerForPushNotifications();
  }, [user?.id]);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: isDark ? COLORS.backgroundDark : COLORS.background,
          },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="onboarding"
          options={{ gestureEnabled: false }}
        />
        <Stack.Screen
          name="invite/[id]"
          options={{ presentation: 'modal' }}
        />
        <Stack.Screen
          name="book/[friendId]"
          options={{ presentation: 'modal' }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}
