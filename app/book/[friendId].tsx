import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  FlatList,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay, isToday } from 'date-fns';
import { COLORS } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import { useSlots } from '@/hooks/useSlots';
import { useBookings } from '@/hooks/useBookings';
import { supabase } from '@/lib/supabase';

interface FriendData {
  id: string;
  user_id: string;
  friend_user_id: string | null;
  friend_name: string;
  frequency: number;
}

interface AvailableSlot {
  id: string;
  user_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  date?: string;
}

interface DayCell {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  hasSlots: boolean;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function BookCallScreen() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { session } = useAuth();
  const { getAvailableSlotsForFriend } = useSlots();
  const { createBooking } = useBookings();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friend, setFriend] = useState<FriendData | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [booking, setBooking] = useState(false);

  const colors = {
    bg: isDark ? COLORS.backgroundDark : COLORS.background,
    card: isDark ? COLORS.cardDark : COLORS.card,
    text: isDark ? COLORS.textDark : COLORS.text,
    textSecondary: isDark ? COLORS.textSecondaryDark : COLORS.textSecondary,
    border: isDark ? COLORS.borderDark : COLORS.border,
  };

  const fetchFriendAndSlots = useCallback(async () => {
    if (!friendId) {
      setError('No friend ID provided.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: friendData, error: friendError } = await supabase
        .from('fmcu_friends')
        .select('id, user_id, friend_user_id, friend_name, frequency')
        .eq('id', friendId)
        .single();

      if (friendError || !friendData) {
        setError('Friend not found.');
        setLoading(false);
        return;
      }

      setFriend(friendData as FriendData);

      if (!friendData.friend_user_id) {
        setLoading(false);
        return;
      }

      const slots = await getAvailableSlotsForFriend(friendId);
      setAvailableSlots(slots ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load data.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [friendId, getAvailableSlotsForFriend]);

  useEffect(() => {
    fetchFriendAndSlots();
  }, [fetchFriendAndSlots]);

  const datesWithSlots = useMemo((): Set<string> => {
    const dateSet = new Set<string>();
    availableSlots.forEach((slot) => {
      if (slot.date) {
        dateSet.add(slot.date);
      }
    });
    return dateSet;
  }, [availableSlots]);

  const calendarDays = useMemo((): DayCell[] => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);
    const today = startOfDay(new Date());

    const leadingBlanks: DayCell[] = Array.from({ length: startDayOfWeek }, (_, i) => ({
      date: new Date(0),
      dayNumber: 0,
      isCurrentMonth: false,
      isToday: false,
      isPast: true,
      hasSlots: false,
    }));

    const dayCells: DayCell[] = allDays.map((date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return {
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: true,
        isToday: isToday(date),
        isPast: isBefore(date, today),
        hasSlots: datesWithSlots.has(dateStr),
      };
    });

    return [...leadingBlanks, ...dayCells];
  }, [currentMonth, datesWithSlots]);

  const slotsForSelectedDate = useMemo((): AvailableSlot[] => {
    if (!selectedDate) return [];
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return availableSlots.filter((slot) => slot.date === dateStr);
  }, [selectedDate, availableSlots]);

  const goToPreviousMonth = () => {
    const prev = subMonths(currentMonth, 1);
    const today = startOfDay(new Date());
    if (isBefore(endOfMonth(prev), today)) return;
    setCurrentMonth(prev);
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateSelect = (day: DayCell) => {
    if (!day.isCurrentMonth || day.isPast) return;
    setSelectedDate(day.date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slot: AvailableSlot) => {
    setSelectedSlot(slot.id === selectedSlot?.id ? null : slot);
  };

  const formatSlotTime = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return format(date, 'h:mm a');
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !friendId || booking) return;

    try {
      setBooking(true);
      await createBooking(selectedSlot.id, friendId);
      Alert.alert(
        'Call Booked!',
        "You'll get a reminder 1 minute before.",
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/'),
          },
        ]
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to book call.';
      Alert.alert('Booking Failed', message);
    } finally {
      setBooking(false);
    }
  };

  const handleSendReminder = async () => {
    if (!friend) return;
    Alert.alert(
      'Reminder Sent',
      `We've sent ${friend.friend_name} a reminder to join 5MCU.`
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text
            style={[styles.loadingText, { color: colors.textSecondary }]}
            accessibilityLabel="Loading booking details"
          >
            Loading...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <View style={[styles.errorIconWrap, { backgroundColor: isDark ? '#3B1C1C' : '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={48} color={COLORS.error} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Something went wrong
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {error}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
            onPress={() => router.back()}
            accessibilityLabel="Go back to previous screen"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (friend && !friend.friend_user_id) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Book a call with {friend.friend_name}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centered}>
          <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
            <Ionicons name="person-add-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {friend.friend_name} hasn't joined 5MCU yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Send them a reminder to join so you can start booking calls.
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
            onPress={handleSendReminder}
            accessibilityLabel={`Send reminder to ${friend.friend_name}`}
            accessibilityRole="button"
          >
            <Ionicons name="send-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
            <Text style={styles.primaryButtonText}>Send Reminder</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (friend && availableSlots.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            Book a call with {friend.friend_name}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.centered}>
          <View style={[styles.emptyIconWrap, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No availability yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {friend.friend_name} hasn't set their availability yet. Check back later.
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
            onPress={() => router.back()}
            accessibilityLabel="Go back to previous screen"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Book a call with {friend?.friend_name}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Calendar */}
        <View style={[styles.calendarContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Month navigation */}
          <View style={styles.monthNav}>
            <Pressable
              onPress={goToPreviousMonth}
              style={styles.monthArrow}
              accessibilityLabel="Previous month"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </Pressable>
            <Text style={[styles.monthLabel, { color: colors.text }]}>
              {format(currentMonth, 'MMMM yyyy')}
            </Text>
            <Pressable
              onPress={goToNextMonth}
              style={styles.monthArrow}
              accessibilityLabel="Next month"
              accessibilityRole="button"
            >
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label) => (
              <View key={label} style={styles.weekdayCell}>
                <Text style={[styles.weekdayText, { color: colors.textSecondary }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <View style={styles.dayGrid}>
            {calendarDays.map((day, index) => {
              if (!day.isCurrentMonth) {
                return <View key={`blank-${index}`} style={styles.dayCell} />;
              }

              const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false;
              const isDisabled = day.isPast;

              return (
                <Pressable
                  key={`day-${day.dayNumber}`}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: COLORS.primary, borderRadius: 20 },
                  ]}
                  onPress={() => handleDateSelect(day)}
                  disabled={isDisabled}
                  accessibilityLabel={`${format(day.date, 'MMMM d')}${day.hasSlots ? ', has available slots' : ''}${isDisabled ? ', not available' : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected, disabled: isDisabled }}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: colors.text },
                      isDisabled && { color: colors.textSecondary, opacity: 0.4 },
                      day.isToday && !isSelected && { color: COLORS.primary, fontWeight: '700' },
                      isSelected && { color: '#FFFFFF', fontWeight: '700' },
                    ]}
                  >
                    {day.dayNumber}
                  </Text>
                  {day.hasSlots && !isSelected && (
                    <View style={[styles.slotDot, { backgroundColor: COLORS.primary }]} />
                  )}
                  {day.hasSlots && isSelected && (
                    <View style={[styles.slotDot, { backgroundColor: '#FFFFFF' }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Time slots */}
        {selectedDate && (
          <View style={styles.slotsSection}>
            <Text style={[styles.slotsTitle, { color: colors.text }]}>
              {format(selectedDate, 'EEEE, MMMM d')}
            </Text>

            {slotsForSelectedDate.length === 0 ? (
              <View style={[styles.emptySlotCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptySlotText, { color: colors.textSecondary }]}>
                  No available slots on this day. Try another date.
                </Text>
              </View>
            ) : (
              slotsForSelectedDate.map((slot) => {
                const isSlotSelected = selectedSlot?.id === slot.id;
                return (
                  <Pressable
                    key={slot.id}
                    style={[
                      styles.slotCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: isSlotSelected ? COLORS.primary : colors.border,
                        borderWidth: isSlotSelected ? 2 : 1,
                      },
                    ]}
                    onPress={() => handleSlotSelect(slot)}
                    accessibilityLabel={`Time slot ${formatSlotTime(slot.start_time)} to ${formatSlotTime(slot.end_time)}${isSlotSelected ? ', selected' : ''}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSlotSelected }}
                  >
                    <View style={styles.slotCardContent}>
                      <View style={styles.slotTimeRow}>
                        <Ionicons
                          name="time-outline"
                          size={20}
                          color={isSlotSelected ? COLORS.primary : colors.textSecondary}
                          style={styles.slotIcon}
                        />
                        <Text style={[styles.slotTimeText, { color: colors.text }]}>
                          {formatSlotTime(slot.start_time)} – {formatSlotTime(slot.end_time)}
                        </Text>
                      </View>
                      <Text style={[styles.slotDayLabel, { color: colors.textSecondary }]}>
                        {format(selectedDate, 'EEEE')}
                      </Text>
                    </View>
                    {isSlotSelected && (
                      <View style={[styles.checkCircle, { backgroundColor: COLORS.primary }]}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        )}

        {!selectedDate && (
          <View style={styles.promptSection}>
            <Text style={[styles.promptText, { color: colors.textSecondary }]}>
              Select a date to see available time slots
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Confirm button */}
      <View style={[styles.bottomBar, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <Pressable
          style={[
            styles.confirmButton,
            { backgroundColor: COLORS.primary },
            (!selectedSlot || booking) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmBooking}
          disabled={!selectedSlot || booking}
          accessibilityLabel="Confirm booking"
          accessibilityRole="button"
          accessibilityState={{ disabled: !selectedSlot || booking }}
        >
          {booking ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.confirmButtonText}>Confirm Booking</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 300,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },

  /* Calendar */
  calendarContainer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  monthArrow: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNumber: {
    fontSize: 15,
    fontWeight: '500',
  },
  slotDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },

  /* Time slots */
  slotsSection: {
    marginBottom: 16,
  },
  slotsTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  emptySlotCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  emptySlotText: {
    fontSize: 15,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  slotCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slotCardContent: {
    flex: 1,
  },
  slotTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  slotIcon: {
    marginRight: 8,
  },
  slotTimeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  slotDayLabel: {
    fontSize: 13,
    marginLeft: 28,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },

  promptSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  promptText: {
    fontSize: 15,
    textAlign: 'center',
  },

  /* Bottom bar */
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 34,
    borderTopWidth: 1,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
});
