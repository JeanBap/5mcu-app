import React, { useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useBookings } from '@/hooks/useBookings';
import BookingCard from '@/components/BookingCard';
import { openVideoCall } from '@/lib/deeplink';
import { COLORS } from '@/constants/config';

interface BookingFriend {
  id: string;
  name: string;
  phone?: string;
}

interface Booking {
  id: string;
  scheduled_at: string;
  video_app: string;
  video_url?: string;
  status: string;
  friend: BookingFriend;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function getFirstName(fullName: string | undefined | null): string {
  if (!fullName) return 'there';
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(' ')[0];
}

function formatHeaderDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function getEndOfWeek(): Date {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);
  return endOfWeek;
}

function getStartOfTomorrow(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

function formatDayName(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { profile } = useAuth();
  const {
    bookings,
    fetchUpcomingBookings,
    cancelBooking,
    getTodaysBookings,
    isLoading,
  } = useBookings();

  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    try {
      setError(null);
      await fetchUpcomingBookings();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load bookings';
      setError(message);
    }
  }, [fetchUpcomingBookings]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  }, [loadBookings]);

  const todaysBookings: Booking[] = useMemo(() => {
    return (getTodaysBookings() as Booking[]) ?? [];
  }, [getTodaysBookings]);

  const thisWeekBookings: Booking[] = useMemo(() => {
    const startOfTomorrow = getStartOfTomorrow();
    const endOfWeek = getEndOfWeek();
    return ((bookings as Booking[]) ?? []).filter((booking) => {
      const date = new Date(booking.scheduled_at);
      return date >= startOfTomorrow && date <= endOfWeek;
    });
  }, [bookings]);

  const firstName = getFirstName(profile?.full_name);
  const greeting = getGreeting();
  const headerDate = formatHeaderDate();

  const handleJoinCall = useCallback((booking: Booking) => {
    const urlOrPhone = booking.video_url || booking.friend.phone || '';
    if (!urlOrPhone) {
      Alert.alert(
        'No call link',
        'There is no video link or phone number for this call.'
      );
      return;
    }
    openVideoCall(booking.video_app, urlOrPhone);
  }, []);

  const handleCancelBooking = useCallback(
    (booking: Booking) => {
      Alert.alert(
        'Cancel Call',
        `Are you sure you want to cancel your call with ${booking.friend.name}?`,
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Cancel Call',
            style: 'destructive',
            onPress: async () => {
              try {
                await cancelBooking(booking.id);
              } catch (err: unknown) {
                const message =
                  err instanceof Error
                    ? err.message
                    : 'Failed to cancel booking';
                Alert.alert('Error', message);
              }
            },
          },
        ]
      );
    },
    [cancelBooking]
  );

  const colors = {
    background: isDark ? COLORS.backgroundDark : COLORS.background,
    text: isDark ? COLORS.textDark : COLORS.text,
    textSecondary: isDark ? COLORS.textSecondaryDark : COLORS.textSecondary,
    card: isDark ? COLORS.cardDark : COLORS.card,
    border: isDark ? COLORS.borderDark : COLORS.border,
  };

  if (isLoading && !refreshing) {
    return (
      <View
        style={[styles.loadingContainer, { backgroundColor: colors.background }]}
        accessibilityLabel="Loading your bookings"
        accessibilityRole="progressbar"
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading your schedule...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
      accessibilityRole="scrollbar"
      accessibilityLabel="Home screen"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text
          style={[styles.greeting, { color: colors.text }]}
          accessibilityRole="header"
        >
          Good {greeting}, {firstName}!
        </Text>
        <Text style={[styles.headerDate, { color: colors.textSecondary }]}>
          {headerDate}
        </Text>
      </View>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={loadBookings}
            accessibilityLabel="Retry loading bookings"
            accessibilityRole="button"
          >
            <Text style={styles.errorRetry}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Today's Calls */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          Today&apos;s Calls
        </Text>
        {todaysBookings.length > 0 ? (
          todaysBookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onJoinCall={() => handleJoinCall(booking)}
              onCancel={() => handleCancelBooking(booking)}
            />
          ))
        ) : (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            accessibilityLabel="No calls scheduled for today"
          >
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No calls today
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: colors.textSecondary }]}
            >
              Check your schedule to set up your next catch-up
            </Text>
          </View>
        )}
      </View>

      {/* This Week */}
      {thisWeekBookings.length > 0 && (
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            This Week
          </Text>
          {thisWeekBookings.map((booking) => (
            <View
              key={booking.id}
              style={[
                styles.weekRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              accessibilityLabel={`Call with ${booking.friend.name} on ${formatDayName(booking.scheduled_at)} at ${formatTime(booking.scheduled_at)}`}
            >
              <View style={styles.weekRowLeft}>
                <Text style={[styles.weekRowName, { color: colors.text }]}>
                  {booking.friend.name}
                </Text>
                <Text
                  style={[
                    styles.weekRowDay,
                    { color: colors.textSecondary },
                  ]}
                >
                  {formatDayName(booking.scheduled_at)}
                </Text>
              </View>
              <Text style={[styles.weekRowTime, { color: COLORS.primary }]}>
                {formatTime(booking.scheduled_at)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text
          style={[styles.sectionTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          Quick Actions
        </Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionCard, { borderColor: COLORS.primary }]}
            onPress={() => router.push('/(tabs)/schedule')}
            accessibilityLabel="Add your availability"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Text style={[styles.quickActionIcon, { color: COLORS.primary }]}>
              🗓
            </Text>
            <Text
              style={[styles.quickActionLabel, { color: COLORS.primary }]}
            >
              Add Availability
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionCard, { borderColor: COLORS.primary }]}
            onPress={() => router.push('/(tabs)/friends')}
            accessibilityLabel="Invite a friend"
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <Text style={[styles.quickActionIcon, { color: COLORS.primary }]}>
              👋
            </Text>
            <Text
              style={[styles.quickActionLabel, { color: COLORS.primary }]}
            >
              Invite a Friend
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    marginTop: 8,
  },
  header: {
    marginBottom: 28,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headerDate: {
    fontSize: 15,
    marginTop: 4,
  },
  errorBanner: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  errorRetry: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 14,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  weekRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  weekRowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  weekRowDay: {
    fontSize: 13,
  },
  weekRowTime: {
    fontSize: 14,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    fontSize: 24,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
