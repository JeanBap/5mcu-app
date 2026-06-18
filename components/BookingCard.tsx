import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import {
  differenceInMinutes,
  differenceInSeconds,
  format,
  isToday,
  isTomorrow,
} from 'date-fns';

import { COLORS } from '@/constants/config';
import type { Booking } from '@/types/database';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BookingCardProps {
  booking: Booking & { friend_name?: string; friend_phone?: string };
  onJoinCall: () => void;
  onCancel: () => void;
}

type CallStatus = 'upcoming' | 'starting_soon' | 'starting_now' | 'in_progress' | 'ended';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CALL_WINDOW_MINUTES = 5;
const JOIN_EARLY_MINUTES = 1;
const COUNTDOWN_INTERVAL_MS = 30_000;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getCallStatus(scheduledAt: Date, now: Date): CallStatus {
  const diffMin = differenceInMinutes(scheduledAt, now);
  const diffSec = differenceInSeconds(scheduledAt, now);

  if (diffSec < -CALL_WINDOW_MINUTES * 60) return 'ended';
  if (diffSec <= 0) return 'in_progress';
  if (diffSec <= 60) return 'starting_now';
  if (diffMin <= 5) return 'starting_soon';
  return 'upcoming';
}

function formatScheduledTime(scheduledAt: Date): string {
  const timeStr = format(scheduledAt, 'h:mm a');
  if (isToday(scheduledAt)) return `Today at ${timeStr}`;
  if (isTomorrow(scheduledAt)) return `Tomorrow at ${timeStr}`;
  return `${format(scheduledAt, 'MMM d')} at ${timeStr}`;
}

function formatCountdown(scheduledAt: Date, now: Date): string {
  const diffMin = differenceInMinutes(scheduledAt, now);
  const diffSec = differenceInSeconds(scheduledAt, now);

  if (diffSec <= 0 && diffSec > -CALL_WINDOW_MINUTES * 60) return 'In progress';
  if (diffSec <= 0) return 'Ended';
  if (diffSec <= 60) return 'Starting now!';
  if (diffMin < 60) return `Starts in ${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (mins === 0) return `Starts in ${hours}h`;
  return `Starts in ${hours}h ${mins}m`;
}

function getVideoAppLabel(booking: Booking): string {
  if (booking.video_app) {
    const name = booking.video_app.charAt(0).toUpperCase() + booking.video_app.slice(1);
    return `via ${name}`;
  }
  return '';
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const BookingCard: React.FC<BookingCardProps> = React.memo(
  ({ booking, onJoinCall, onCancel }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [now, setNow] = useState(() => new Date());

    /* ---------- countdown timer ---------- */

    useEffect(() => {
      const interval = setInterval(() => {
        setNow(new Date());
      }, COUNTDOWN_INTERVAL_MS);

      return () => clearInterval(interval);
    }, []);

    /* ---------- derived data ---------- */

    const scheduledAt = useMemo(() => new Date(booking.scheduled_at), [booking.scheduled_at]);
    const status = useMemo(() => getCallStatus(scheduledAt, now), [scheduledAt, now]);
    const timeLabel = useMemo(() => formatScheduledTime(scheduledAt), [scheduledAt]);
    const countdownLabel = useMemo(() => formatCountdown(scheduledAt, now), [scheduledAt, now]);
    const videoAppLabel = useMemo(() => getVideoAppLabel(booking), [booking]);

    const canJoin = status === 'starting_now' || status === 'in_progress' || status === 'starting_soon';

    const handleJoinCall = useCallback(() => {
      if (canJoin) onJoinCall();
    }, [canJoin, onJoinCall]);

    /* ---------- colors ---------- */

    const cardBg = isDark ? COLORS.cardDark : COLORS.card;
    const textColor = isDark ? COLORS.textDark : COLORS.text;
    const secondaryText = isDark ? COLORS.textSecondaryDark : COLORS.textSecondary;
    const borderColor = isDark ? COLORS.borderDark : COLORS.border;

    let countdownColor = secondaryText;
    if (status === 'starting_now' || status === 'in_progress') countdownColor = COLORS.success;
    else if (status === 'starting_soon') countdownColor = COLORS.warning;

    const friendName = booking.friend_name || 'Friend';

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor,
            shadowColor: isDark ? '#000000' : '#000000',
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Call with ${friendName}, ${timeLabel}, ${countdownLabel}`}
      >
        {/* Primary color left border */}
        <View style={styles.leftBorder} />

        <View style={styles.cardContent}>
          {/* Top row: friend name + time */}
          <View style={styles.topRow}>
            <View style={styles.topRowLeft}>
              <Text style={[styles.friendName, { color: textColor }]} numberOfLines={1}>
                {friendName}
              </Text>
              {videoAppLabel.length > 0 && (
                <View style={[styles.appBadge, { backgroundColor: `${COLORS.primary}15` }]}>
                  <Text style={[styles.appBadgeText, { color: COLORS.primary }]}>
                    {videoAppLabel}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.timeLabel, { color: secondaryText }]}>{timeLabel}</Text>
          </View>

          {/* Countdown */}
          <View style={styles.countdownRow}>
            <View
              style={[
                styles.countdownDot,
                {
                  backgroundColor: countdownColor,
                },
              ]}
            />
            <Text style={[styles.countdownText, { color: countdownColor, fontWeight: status === 'starting_now' || status === 'in_progress' ? '700' : '500' }]}>
              {countdownLabel}
            </Text>
          </View>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.joinButton,
                {
                  backgroundColor: canJoin ? COLORS.primary : `${COLORS.primary}40`,
                },
              ]}
              onPress={handleJoinCall}
              disabled={!canJoin}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Join call with ${friendName}`}
              accessibilityState={{ disabled: !canJoin }}
            >
              <Text style={styles.joinButtonText}>Join Call</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { borderColor }]}
              onPress={onCancel}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Cancel call with ${friendName}`}
            >
              <Text style={[styles.cancelButtonText, { color: secondaryText }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  },
);

BookingCard.displayName = 'BookingCard';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  leftBorder: {
    width: 4,
    backgroundColor: COLORS.primary,
  },
  cardContent: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  topRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginRight: 8,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  appBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  appBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countdownText: {
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  joinButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default BookingCard;
