import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { APP_CONFIG } from '../constants/config';

/**
 * Register the device for push notifications, save the token to the user's
 * profile, and configure the foreground notification handler.
 *
 * Returns the Expo push token string, or null if registration fails
 * (e.g. running in a simulator or permissions denied).
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) {
      console.warn('Push notifications require a physical device');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Push notification permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Save the push token to the user's profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase
        .from('fmcu_profiles')
        .update({ push_token: token })
        .eq('id', user.id);

      if (error) {
        console.error('Failed to save push token to profile:', error.message);
      }
    }

    // Configure foreground notification display
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('calls', {
        name: 'Call Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
        sound: 'default',
      });
    }

    return token;
  } catch (error) {
    console.error(
      'Failed to register for push notifications:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Schedule a local notification reminding the user that a call is about to start.
 * Fires APP_CONFIG.callBufferMinutes minutes before the call time.
 *
 * @param bookingId - The booking identifier for navigation
 * @param callTime  - When the call is scheduled to begin
 * @param friendName - Display name of the friend being called
 * @returns The notification identifier, or null if scheduling failed
 */
export async function scheduleCallReminder(
  bookingId: string,
  callTime: Date,
  friendName: string
): Promise<string | null> {
  try {
    const triggerDate = new Date(callTime.getTime() - APP_CONFIG.callBufferMinutes * 60 * 1000);
    const secondsUntilTrigger = Math.max(
      1,
      Math.floor((triggerDate.getTime() - Date.now()) / 1000)
    );

    // Don't schedule if the reminder time has already passed
    if (secondsUntilTrigger <= 0) {
      console.warn('Call reminder time has already passed, skipping');
      return null;
    }

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Call in 1 minute!',
        body: `Your 5-minute call with ${friendName} starts soon`,
        data: { bookingId, type: 'call_reminder' },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'calls' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilTrigger,
        repeats: false,
      },
    });

    return identifier;
  } catch (error) {
    console.error(
      'Failed to schedule call reminder:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Schedule a notification alerting the user that their call time is up.
 * Fires at callTime + APP_CONFIG.slotDurationMinutes.
 *
 * @param bookingId     - The booking identifier
 * @param callTime      - When the call started
 * @param friendName    - Display name of the friend just called
 * @param hasNextCall   - Whether another call follows immediately
 * @param nextFriendName - Name of the next friend (if hasNextCall is true)
 * @returns The notification identifier, or null if scheduling failed
 */
export async function scheduleCallEndAlert(
  bookingId: string,
  callTime: Date,
  friendName: string,
  hasNextCall: boolean,
  nextFriendName?: string
): Promise<string | null> {
  try {
    const endTime = new Date(
      callTime.getTime() + APP_CONFIG.slotDurationMinutes * 60 * 1000
    );
    const secondsUntilTrigger = Math.max(
      1,
      Math.floor((endTime.getTime() - Date.now()) / 1000)
    );

    if (secondsUntilTrigger <= 0) {
      console.warn('Call end time has already passed, skipping');
      return null;
    }

    const body = hasNextCall && nextFriendName
      ? `Great catch-up with ${friendName}! ${nextFriendName} is next - wrapping up time!`
      : `Great catch-up with ${friendName}! See you next time.`;

    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Time's up!",
        body,
        data: { bookingId, type: 'call_end' },
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'calls' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: secondsUntilTrigger,
        repeats: false,
      },
    });

    return identifier;
  } catch (error) {
    console.error(
      'Failed to schedule call end alert:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Cancel all scheduled notifications associated with a specific booking.
 * Iterates through all pending notifications and removes those whose
 * data.bookingId matches the provided ID.
 *
 * @param bookingId - The booking whose notifications should be cancelled
 */
export async function cancelBookingNotifications(bookingId: string): Promise<void> {
  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

    const cancellations = scheduledNotifications
      .filter((notification) => {
        const data = notification.content.data as Record<string, unknown> | undefined;
        return data?.bookingId === bookingId;
      })
      .map((notification) =>
        Notifications.cancelScheduledNotificationAsync(notification.identifier)
      );

    await Promise.all(cancellations);
  } catch (error) {
    console.error(
      'Failed to cancel booking notifications:',
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Handle a user's interaction with a notification (e.g. tapping it).
 * Routes to the appropriate screen based on the notification type.
 *
 * @param response - The notification response from the OS
 */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse
): void {
  try {
    const data = response.notification.request.content.data as
      | Record<string, unknown>
      | undefined;

    if (!data) return;

    switch (data.type) {
      case 'call_reminder':
        router.push('/(tabs)/');
        break;
      case 'call_end':
        router.push('/(tabs)/');
        break;
      default:
        break;
    }
  } catch (error) {
    console.error(
      'Failed to handle notification response:',
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Set up iOS notification categories with action buttons.
 * Allows users to interact with notifications directly from the lock screen.
 */
export async function setupNotificationCategories(): Promise<void> {
  try {
    if (Platform.OS !== 'ios') return;

    await Notifications.setNotificationCategoryAsync('call_reminder', [
      {
        identifier: 'open_app',
        buttonTitle: 'Open App',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Dismiss',
        options: { isDestructive: true },
      },
    ]);

    await Notifications.setNotificationCategoryAsync('call_end', [
      {
        identifier: 'open_app',
        buttonTitle: 'Open App',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'dismiss',
        buttonTitle: 'Done',
        options: { isDestructive: false },
      },
    ]);
  } catch (error) {
    console.error(
      'Failed to set up notification categories:',
      error instanceof Error ? error.message : error
    );
  }
}
