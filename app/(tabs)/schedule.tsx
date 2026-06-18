import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { format } from 'date-fns';

import { COLORS, APP_CONFIG } from '@/constants/config';
import { useSlots } from '@/hooks/useSlots';
import { useAuth } from '@/hooks/useAuth';
import SlotPicker from '@/components/SlotPicker';
import PaywallModal from '@/components/PaywallModal';
import type { AvailabilitySlot } from '@/types/database';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Slot {
  id: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked';
  date: string;
}

interface CalendarDay {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasAvailable: boolean;
  hasBooked: boolean;
}

interface QuickAction {
  label: string;
  emoji: string;
  startHour: number;
  endHour: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAY_LABELS: readonly string[] = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CALENDAR_ROWS = 6;
const CALENDAR_COLS = 7;

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Morning (8-9 AM)', emoji: '☀️', startHour: 8, endHour: 9 },
  { label: 'Evening (6-7 PM)', emoji: '🌙', startHour: 18, endHour: 19 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Build a 6x7 grid of CalendarDay objects for the given month,
 * padded with trailing days of the previous month and leading
 * days of the next month.
 */
function buildCalendarGrid(
  month: Date,
  selectedDate: Date,
  slotsMap: Map<string, { available: number; booked: number }>,
): CalendarDay[][] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  const startDayOfWeek = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const selectedKey = `${selectedDate.getFullYear()}-${selectedDate.getMonth()}-${selectedDate.getDate()}`;

  // Previous month's trailing days
  const prevMonthLastDay = new Date(year, monthIndex, 0).getDate();
  const prevMonthStart = prevMonthLastDay - startDayOfWeek + 1;

  const grid: CalendarDay[][] = [];
  let dayCounter = 1;
  let nextMonthDay = 1;

  for (let row = 0; row < CALENDAR_ROWS; row++) {
    const week: CalendarDay[] = [];
    for (let col = 0; col < CALENDAR_COLS; col++) {
      const cellIndex = row * CALENDAR_COLS + col;

      let date: Date;
      let dayNumber: number;
      let isCurrentMonth: boolean;

      if (cellIndex < startDayOfWeek) {
        // Previous month padding
        dayNumber = prevMonthStart + cellIndex;
        date = new Date(year, monthIndex - 1, dayNumber);
        isCurrentMonth = false;
      } else if (dayCounter <= daysInMonth) {
        // Current month
        dayNumber = dayCounter;
        date = new Date(year, monthIndex, dayNumber);
        isCurrentMonth = true;
        dayCounter++;
      } else {
        // Next month padding
        dayNumber = nextMonthDay;
        date = new Date(year, monthIndex + 1, dayNumber);
        isCurrentMonth = false;
        nextMonthDay++;
      }

      const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const slotInfo = slotsMap.get(dateKey);

      week.push({
        date,
        dayNumber,
        isCurrentMonth,
        isToday: dateKey === todayKey,
        isSelected: dateKey === selectedKey,
        hasAvailable: (slotInfo?.available ?? 0) > 0,
        hasBooked: (slotInfo?.booked ?? 0) > 0,
      });
    }
    grid.push(week);
  }

  return grid;
}

/**
 * Build a map keyed by "year-month-day" counting available and booked
 * slots per date from the raw AvailabilitySlot array.
 */
function buildSlotsMap(
  slots: AvailabilitySlot[],
): Map<string, { available: number; booked: number }> {
  const map = new Map<string, { available: number; booked: number }>();
  for (const slot of slots) {
    const d = new Date(slot.start_time);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const entry = map.get(key) ?? { available: 0, booked: 0 };
    if (slot.is_booked) {
      entry.booked++;
    } else {
      entry.available++;
    }
    map.set(key, entry);
  }
  return map;
}

/**
 * Convert an AvailabilitySlot row to the Slot interface used in the UI.
 */
function toSlot(row: AvailabilitySlot): Slot {
  const d = new Date(row.start_time);
  return {
    id: row.id,
    start_time: row.start_time,
    end_time: row.end_time,
    status: row.is_booked ? 'booked' : 'available',
    date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  };
}

/**
 * Format a time string like "2:30 PM" from an ISO date string.
 */
function formatTime(iso: string): string {
  return format(new Date(iso), 'h:mm a');
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ScheduleScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  /* ---------- store ---------- */

  const {
    slots,
    fetchSlots,
    createSlots,
    deleteSlot,
    createQuickSlots,
    getSlotsByDate,
    isLoading,
  } = useSlots();

  const { profile } = useAuth();

  /* ---------- state ---------- */

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [pendingSlots, setPendingSlots] = useState<
    { start_time: string; end_time: string }[]
  >([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  /* ---------- derived data ---------- */

  const slotsMap = useMemo(() => buildSlotsMap(slots), [slots]);

  const calendarGrid = useMemo(
    () => buildCalendarGrid(currentMonth, selectedDate, slotsMap),
    [currentMonth, selectedDate, slotsMap],
  );

  const monthLabel = useMemo(
    () => format(currentMonth, 'MMMM yyyy'),
    [currentMonth],
  );

  const daySlots: Slot[] = useMemo(
    () => getSlotsByDate(selectedDate).map(toSlot),
    [getSlotsByDate, selectedDate, slots],
  );

  const existingSlotsForPicker: AvailabilitySlot[] = useMemo(
    () => getSlotsByDate(selectedDate),
    [getSlotsByDate, selectedDate, slots],
  );

  /* ---------- effects ---------- */

  useEffect(() => {
    fetchSlots(currentMonth);
  }, [currentMonth, fetchSlots]);

  /* ---------- handlers ---------- */

  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m - 1, 1);
    });
  }, []);

  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m + 1, 1);
    });
  }, []);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
    setPendingSlots([]);
  }, []);

  const handleSlotsChange = useCallback(
    (newSlots: { start_time: string; end_time: string }[]) => {
      setPendingSlots(newSlots);
    },
    [],
  );

  const handleSaveSlots = useCallback(async () => {
    if (pendingSlots.length === 0) {
      Alert.alert('No Slots Selected', 'Please select time slots before saving.');
      return;
    }

    setIsSaving(true);
    try {
      await createSlots(pendingSlots);
      setPendingSlots([]);
      Alert.alert('Slots Saved', `${pendingSlots.length} slot${pendingSlots.length > 1 ? 's' : ''} created successfully.`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save slots. Please try again.';
      if (message.includes('Upgrade to premium') || message.includes('limited to')) {
        setPaywallVisible(true);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setIsSaving(false);
    }
  }, [pendingSlots, createSlots]);

  const handleDeleteSlot = useCallback(
    (slotId: string, slotTime: string) => {
      Alert.alert(
        'Delete Slot',
        `Are you sure you want to delete the slot at ${slotTime}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteSlot(slotId);
              } catch (err: unknown) {
                const message =
                  err instanceof Error
                    ? err.message
                    : 'Failed to delete slot. Please try again.';
                Alert.alert('Error', message);
              }
            },
          },
        ],
      );
    },
    [deleteSlot],
  );

  const handleQuickAction = useCallback(
    async (action: QuickAction) => {
      try {
        await createQuickSlots(selectedDate, action.startHour, action.endHour);
        Alert.alert(
          'Slots Created',
          `${action.emoji} ${action.label} slots have been created.`,
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to create slots. Please try again.';
        if (message.includes('Upgrade to premium') || message.includes('limited to')) {
          setPaywallVisible(true);
        } else {
          Alert.alert('Error', message);
        }
      }
    },
    [selectedDate, createQuickSlots],
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await fetchSlots(currentMonth);
    } catch {
      // fetchSlots sets its own error state
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchSlots, currentMonth]);

  const handlePaywallClose = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  const handlePurchaseSuccess = useCallback(() => {
    setPaywallVisible(false);
    Alert.alert(
      'Upgrade Successful',
      'You now have unlimited slots. Enjoy premium!',
    );
  }, []);

  /* ---------- colors ---------- */

  const bg = isDark ? COLORS.backgroundDark : COLORS.background;
  const cardBg = isDark ? COLORS.cardDark : COLORS.card;
  const textColor = isDark ? COLORS.textDark : COLORS.text;
  const secondaryText = isDark ? COLORS.textSecondaryDark : COLORS.textSecondary;
  const borderColor = isDark ? COLORS.borderDark : COLORS.border;

  /* ---------- render helpers ---------- */

  const renderCalendarHeader = () => (
    <View style={styles.calendarHeader}>
      <TouchableOpacity
        onPress={handlePreviousMonth}
        style={styles.monthArrow}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
      >
        <Text style={[styles.monthArrowText, { color: COLORS.primary }]}>
          {'<'}
        </Text>
      </TouchableOpacity>

      <Text
        style={[styles.monthLabel, { color: textColor }]}
        accessibilityRole="header"
      >
        {monthLabel}
      </Text>

      <TouchableOpacity
        onPress={handleNextMonth}
        style={styles.monthArrow}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel="Next month"
      >
        <Text style={[styles.monthArrowText, { color: COLORS.primary }]}>
          {'>'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderDayHeaders = () => (
    <View style={styles.dayHeaderRow}>
      {DAY_LABELS.map((label, index) => (
        <View key={`header-${index}`} style={styles.dayHeaderCell}>
          <Text style={[styles.dayHeaderText, { color: secondaryText }]}>
            {label}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderCalendarDay = (day: CalendarDay) => {
    const dayKey = `${day.date.getFullYear()}-${day.date.getMonth()}-${day.date.getDate()}`;

    const cellBg = day.isToday ? COLORS.primary : 'transparent';
    const cellTextColor = day.isToday
      ? '#FFFFFF'
      : day.isCurrentMonth
        ? textColor
        : secondaryText;
    const cellOpacity = day.isCurrentMonth ? 1 : 0.4;

    return (
      <TouchableOpacity
        key={dayKey}
        style={[
          styles.dayCell,
          {
            backgroundColor: cellBg,
            borderColor: day.isSelected ? COLORS.primary : 'transparent',
            borderWidth: day.isSelected && !day.isToday ? 2 : 0,
            opacity: cellOpacity,
          },
        ]}
        onPress={() => handleSelectDate(day.date)}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`${format(day.date, 'EEEE, MMMM d, yyyy')}${day.isToday ? ', today' : ''}${day.hasAvailable ? ', has available slots' : ''}${day.hasBooked ? ', has booked slots' : ''}`}
        accessibilityState={{ selected: day.isSelected }}
      >
        <Text
          style={[
            styles.dayNumber,
            {
              color: cellTextColor,
              fontWeight: day.isToday || day.isSelected ? '700' : '400',
            },
          ]}
        >
          {day.dayNumber}
        </Text>

        <View style={styles.dotContainer}>
          {day.hasAvailable && (
            <View
              style={[styles.dot, { backgroundColor: COLORS.primary }]}
              accessibilityLabel="Has available slots"
            />
          )}
          {day.hasBooked && (
            <View
              style={[styles.dot, { backgroundColor: COLORS.success }]}
              accessibilityLabel="Has booked slots"
            />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderCalendar = () => (
    <View style={[styles.calendarContainer, { backgroundColor: cardBg, borderColor }]}>
      {renderCalendarHeader()}
      {renderDayHeaders()}
      {calendarGrid.map((week, rowIndex) => (
        <View key={`week-${rowIndex}`} style={styles.weekRow}>
          {week.map(renderCalendarDay)}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
          <Text style={[styles.legendText, { color: secondaryText }]}>
            Available
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
          <Text style={[styles.legendText, { color: secondaryText }]}>
            Booked
          </Text>
        </View>
      </View>
    </View>
  );

  const renderQuickActions = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.quickActionsContent}
      style={styles.quickActionsScroll}
    >
      {QUICK_ACTIONS.map((action) => (
        <TouchableOpacity
          key={action.label}
          style={[styles.quickActionPill, { backgroundColor: cardBg, borderColor }]}
          onPress={() => handleQuickAction(action)}
          disabled={isLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Create ${action.label} slots`}
        >
          <Text style={styles.quickActionEmoji}>{action.emoji}</Text>
          <Text style={[styles.quickActionLabel, { color: textColor }]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  const renderSlotRow = (slot: Slot) => {
    const timeRange = `${formatTime(slot.start_time)} - ${formatTime(slot.end_time)}`;
    const isBooked = slot.status === 'booked';

    return (
      <View
        key={slot.id}
        style={[styles.slotRow, { backgroundColor: cardBg, borderColor }]}
        accessibilityLabel={`Slot from ${timeRange}, ${slot.status}`}
      >
        <View style={styles.slotInfo}>
          <Text style={[styles.slotTime, { color: textColor }]}>{timeRange}</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isBooked
                  ? `${COLORS.success}20`
                  : `${COLORS.primary}20`,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: isBooked ? COLORS.success : COLORS.primary },
              ]}
            >
              {isBooked ? 'Booked' : 'Available'}
            </Text>
          </View>
        </View>

        {!isBooked && (
          <TouchableOpacity
            onPress={() => handleDeleteSlot(slot.id, timeRange)}
            style={styles.deleteButton}
            activeOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={`Delete slot at ${timeRange}`}
          >
            <Text style={styles.deleteEmoji}>{'🗑️'}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderDaySlots = () => {
    if (daySlots.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateText, { color: secondaryText }]}>
            No slots for {format(selectedDate, 'MMMM d')}. Use the time picker above to add some.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.slotsList}>
        <Text style={[styles.slotsListTitle, { color: textColor }]}>
          Existing Slots ({daySlots.length})
        </Text>
        {daySlots.map(renderSlotRow)}
      </View>
    );
  };

  /* ---------- main render ---------- */

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Quick action pills */}
        {renderQuickActions()}

        {/* Calendar */}
        {renderCalendar()}

        {/* Loading indicator */}
        {isLoading && !isRefreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={[styles.loadingText, { color: secondaryText }]}>
              Loading slots...
            </Text>
          </View>
        )}

        {/* Selected date section */}
        <View style={styles.selectedDateSection}>
          <Text style={[styles.selectedDateTitle, { color: textColor }]}>
            {format(selectedDate, 'EEEE, MMMM d')}
          </Text>

          {/* Slot picker */}
          <SlotPicker
            date={selectedDate}
            existingSlots={existingSlotsForPicker}
            onSlotsChange={handleSlotsChange}
            disabled={isSaving}
          />

          {/* Save button */}
          {pendingSlots.length > 0 && (
            <TouchableOpacity
              style={[
                styles.saveButton,
                {
                  backgroundColor: isSaving
                    ? `${COLORS.primary}80`
                    : COLORS.primary,
                },
              ]}
              onPress={handleSaveSlots}
              disabled={isSaving}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Save ${pendingSlots.length} slot${pendingSlots.length > 1 ? 's' : ''}`}
              accessibilityState={{ disabled: isSaving }}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>
                  Save Slots ({pendingSlots.length})
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Existing slots for selected date */}
          {renderDaySlots()}

          {/* Slot limit notice for free users */}
          {profile && !profile.is_premium && (
            <TouchableOpacity
              style={[styles.limitNotice, { backgroundColor: `${COLORS.warning}15`, borderColor: `${COLORS.warning}40` }]}
              onPress={() => setPaywallVisible(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="View upgrade options"
            >
              <Text style={[styles.limitNoticeText, { color: COLORS.warning }]}>
                Free plan: {APP_CONFIG.maxFreeSlots} slots max.{' '}
                <Text style={styles.limitNoticeLink}>Upgrade for unlimited.</Text>
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Paywall modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={handlePaywallClose}
        onPurchaseSuccess={handlePurchaseSuccess}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },

  /* Quick actions */
  quickActionsScroll: {
    marginTop: 16,
    marginBottom: 12,
  },
  quickActionsContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  quickActionEmoji: {
    fontSize: 16,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* Calendar */
  calendarContainer: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  monthArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  monthArrowText: {
    fontSize: 22,
    fontWeight: '700',
  },
  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontSize: 13,
    fontWeight: '600',
  },
  weekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginVertical: 1,
    borderRadius: 10,
    minHeight: 42,
  },
  dayNumber: {
    fontSize: 15,
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 2,
    height: 6,
    alignItems: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },

  /* Legend */
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
    paddingTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },

  /* Loading */
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  loadingText: {
    fontSize: 14,
  },

  /* Selected date section */
  selectedDateSection: {
    paddingHorizontal: 16,
  },
  selectedDateTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },

  /* Save button */
  saveButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 52,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Slots list */
  slotsList: {
    marginTop: 20,
  },
  slotsListTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  slotInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  deleteEmoji: {
    fontSize: 18,
  },

  /* Empty state */
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Limit notice */
  limitNotice: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  limitNoticeText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  limitNoticeLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
