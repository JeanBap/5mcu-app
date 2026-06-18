import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { format, setHours, setMinutes, setSeconds } from 'date-fns';

import { COLORS } from '@/constants/config';
import type { AvailabilitySlot } from '@/types/database';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SlotPickerProps {
  date: Date;
  existingSlots: AvailabilitySlot[];
  onSlotsChange: (slots: { start_time: string; end_time: string }[]) => void;
  disabled?: boolean;
}

interface TimeBlock {
  hour: number;
  minute: number;
  label: string;
  isoStart: string;
  isoEnd: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const START_HOUR = 6;
const END_HOUR = 22; // 10 PM (exclusive — last slot starts at 21:55)
const INCREMENT = 5;
const BLOCKS_PER_ROW = 6; // 30 minutes per row

interface QuickRange {
  label: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

const QUICK_RANGES: QuickRange[] = [
  { label: 'Morning (8–9 AM)', startHour: 8, startMinute: 0, endHour: 9, endMinute: 0 },
  { label: 'Lunch (12–1 PM)', startHour: 12, startMinute: 0, endHour: 13, endMinute: 0 },
  { label: 'Evening (6–7 PM)', startHour: 18, startMinute: 0, endHour: 19, endMinute: 0 },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildTimeBlocks(date: Date): TimeBlock[] {
  const blocks: TimeBlock[] = [];
  for (let h = START_HOUR; h < END_HOUR; h++) {
    for (let m = 0; m < 60; m += INCREMENT) {
      const start = setSeconds(setMinutes(setHours(date, h), m), 0);
      const endMin = m + INCREMENT;
      const endH = endMin >= 60 ? h + 1 : h;
      const endM = endMin >= 60 ? 0 : endMin;
      const end = setSeconds(setMinutes(setHours(date, endH), endM), 0);

      blocks.push({
        hour: h,
        minute: m,
        label: format(start, 'h:mm'),
        isoStart: start.toISOString(),
        isoEnd: end.toISOString(),
      });
    }
  }
  return blocks;
}

function blockKey(hour: number, minute: number): string {
  return `${hour}:${minute}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const SlotPicker: React.FC<SlotPickerProps> = React.memo(
  ({ date, existingSlots, onSlotsChange, disabled = false }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    /* ---------- derived data ---------- */

    const timeBlocks = useMemo(() => buildTimeBlocks(date), [date]);

    // Map existing slots by their start time for fast lookup
    const existingMap = useMemo(() => {
      const map = new Map<string, AvailabilitySlot>();
      existingSlots.forEach((slot) => {
        const d = new Date(slot.start_time);
        map.set(blockKey(d.getHours(), d.getMinutes()), slot);
      });
      return map;
    }, [existingSlots]);

    // Group blocks into rows by hour
    const rows = useMemo(() => {
      const grouped: { hour: number; blocks: TimeBlock[] }[] = [];
      let currentHour = -1;
      let currentBlocks: TimeBlock[] = [];

      timeBlocks.forEach((block) => {
        if (block.hour !== currentHour) {
          if (currentBlocks.length > 0) {
            // split into sub-rows of BLOCKS_PER_ROW
            for (let i = 0; i < currentBlocks.length; i += BLOCKS_PER_ROW) {
              grouped.push({
                hour: currentHour,
                blocks: currentBlocks.slice(i, i + BLOCKS_PER_ROW),
              });
            }
          }
          currentHour = block.hour;
          currentBlocks = [block];
        } else {
          currentBlocks.push(block);
        }
      });
      // flush last batch
      if (currentBlocks.length > 0) {
        for (let i = 0; i < currentBlocks.length; i += BLOCKS_PER_ROW) {
          grouped.push({
            hour: currentHour,
            blocks: currentBlocks.slice(i, i + BLOCKS_PER_ROW),
          });
        }
      }

      return grouped;
    }, [timeBlocks]);

    /* ---------- selection state ---------- */

    const [selected, setSelected] = useState<Set<string>>(new Set());

    const emitChange = useCallback(
      (next: Set<string>) => {
        const slots = Array.from(next).map((key) => {
          const [h, m] = key.split(':').map(Number);
          const start = setSeconds(setMinutes(setHours(date, h), m), 0);
          const endMin = m + INCREMENT;
          const endH = endMin >= 60 ? h + 1 : h;
          const endM = endMin >= 60 ? 0 : endMin;
          const end = setSeconds(setMinutes(setHours(date, endH), endM), 0);
          return { start_time: start.toISOString(), end_time: end.toISOString() };
        });
        onSlotsChange(slots);
      },
      [date, onSlotsChange],
    );

    const toggleBlock = useCallback(
      (hour: number, minute: number) => {
        if (disabled) return;
        const key = blockKey(hour, minute);
        if (existingMap.has(key)) return; // can't toggle existing
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(key)) {
            next.delete(key);
          } else {
            next.add(key);
          }
          emitChange(next);
          return next;
        });
      },
      [disabled, existingMap, emitChange],
    );

    const applyQuickRange = useCallback(
      (range: QuickRange) => {
        if (disabled) return;
        setSelected((prev) => {
          const next = new Set(prev);
          let h = range.startHour;
          let m = range.startMinute;
          while (h < range.endHour || (h === range.endHour && m < range.endMinute)) {
            const key = blockKey(h, m);
            if (!existingMap.has(key)) {
              next.add(key);
            }
            m += INCREMENT;
            if (m >= 60) {
              m = 0;
              h += 1;
            }
          }
          emitChange(next);
          return next;
        });
      },
      [disabled, existingMap, emitChange],
    );

    const clearAll = useCallback(() => {
      if (disabled) return;
      setSelected(new Set());
      onSlotsChange([]);
    }, [disabled, onSlotsChange]);

    /* ---------- colors ---------- */

    const bg = isDark ? COLORS.backgroundDark : COLORS.background;
    const cardBg = isDark ? COLORS.cardDark : COLORS.card;
    const textColor = isDark ? COLORS.textDark : COLORS.text;
    const secondaryText = isDark ? COLORS.textSecondaryDark : COLORS.textSecondary;
    const borderColor = isDark ? COLORS.borderDark : COLORS.border;

    /* ---------- render ---------- */

    const renderBlock = (block: TimeBlock) => {
      const key = blockKey(block.hour, block.minute);
      const existing = existingMap.get(key);
      const isSelected = selected.has(key);
      const isExisting = !!existing;
      const isBooked = existing?.is_booked === true;

      let blockBg = cardBg;
      let blockTextColor = secondaryText;
      let blockLabel = block.label;

      if (isBooked) {
        blockBg = COLORS.success;
        blockTextColor = '#FFFFFF';
        blockLabel = 'Booked';
      } else if (isExisting) {
        blockBg = COLORS.primaryLight;
        blockTextColor = '#FFFFFF';
      } else if (isSelected) {
        blockBg = COLORS.primary;
        blockTextColor = '#FFFFFF';
      }

      return (
        <TouchableOpacity
          key={key}
          style={[styles.block, { backgroundColor: blockBg, borderColor }]}
          onPress={() => toggleBlock(block.hour, block.minute)}
          disabled={disabled || isExisting}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${format(new Date(block.isoStart), 'h:mm a')} time slot${isBooked ? ', booked' : isExisting ? ', already set' : isSelected ? ', selected' : ''}`}
          accessibilityState={{ selected: isSelected || isExisting, disabled: disabled || isExisting }}
        >
          <Text style={[styles.blockText, { color: blockTextColor }]} numberOfLines={1}>
            {blockLabel}
          </Text>
        </TouchableOpacity>
      );
    };

    return (
      <View style={[styles.container, { backgroundColor: bg }]}>
        {/* Date header */}
        <Text style={[styles.dateHeader, { color: textColor }]}>
          {format(date, 'EEEE, MMMM d')}
        </Text>

        {/* Quick actions */}
        <View style={styles.quickActions}>
          {QUICK_RANGES.map((range) => (
            <TouchableOpacity
              key={range.label}
              style={[styles.quickButton, { backgroundColor: cardBg, borderColor }]}
              onPress={() => applyQuickRange(range)}
              disabled={disabled}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Select ${range.label}`}
            >
              <Text style={[styles.quickButtonText, { color: COLORS.primary }]}>
                {range.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.quickButton, { backgroundColor: cardBg, borderColor }]}
            onPress={clearAll}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Clear all selections"
          >
            <Text style={[styles.quickButtonText, { color: COLORS.error }]}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.primary }]} />
            <Text style={[styles.legendText, { color: secondaryText }]}>Selected</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.primaryLight }]} />
            <Text style={[styles.legendText, { color: secondaryText }]}>Existing</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.success }]} />
            <Text style={[styles.legendText, { color: secondaryText }]}>Booked</Text>
          </View>
        </View>

        {/* Time grid */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {rows.map((row, rowIndex) => {
            const isFirstRowOfHour =
              rowIndex === 0 || rows[rowIndex - 1].hour !== row.hour;

            return (
              <View key={`row-${row.hour}-${rowIndex}`}>
                {isFirstRowOfHour && (
                  <Text style={[styles.hourHeader, { color: textColor }]}>
                    {format(setMinutes(setHours(new Date(), row.hour), 0), 'h a')}
                  </Text>
                )}
                <View style={styles.row}>{row.blocks.map(renderBlock)}</View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  },
);

SlotPicker.displayName = 'SlotPicker';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dateHeader: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  quickButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  hourHeader: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 4,
  },
  block: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 48,
  },
  blockText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default SlotPicker;
