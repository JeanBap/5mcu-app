import React, { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { format } from 'date-fns';

import { COLORS } from '@/constants/config';
import type { Friend } from '@/types/database';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FriendCardProps {
  friend: Friend;
  onPress?: () => void;
  onEditFrequency?: () => void;
  onRemove?: () => void;
  nextCallDate?: Date | null;
  showActions?: boolean;
}

type FrequencyLabel = '1x/month' | '2x/month' | '4x/month';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getFrequencyLabel(timesPerMonth: number): FrequencyLabel {
  if (timesPerMonth >= 4) return '4x/month';
  if (timesPerMonth >= 2) return '2x/month';
  return '1x/month';
}

function getInitial(name: string): string {
  return (name.charAt(0) || '?').toUpperCase();
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const FriendCard: React.FC<FriendCardProps> = React.memo(
  ({
    friend,
    onPress,
    onEditFrequency,
    onRemove,
    nextCallDate = null,
    showActions = true,
  }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [menuOpen, setMenuOpen] = useState(false);

    const toggleMenu = useCallback(() => {
      setMenuOpen((prev) => !prev);
    }, []);

    const handleEditFrequency = useCallback(() => {
      setMenuOpen(false);
      onEditFrequency?.();
    }, [onEditFrequency]);

    const handleRemove = useCallback(() => {
      setMenuOpen(false);
      onRemove?.();
    }, [onRemove]);

    /* ---------- colors ---------- */

    const cardBg = isDark ? COLORS.cardDark : COLORS.card;
    const textColor = isDark ? COLORS.textDark : COLORS.text;
    const secondaryText = isDark ? COLORS.textSecondaryDark : COLORS.textSecondary;
    const borderColor = isDark ? COLORS.borderDark : COLORS.border;

    const isActive = friend.status === 'active';
    const statusColor = isActive ? COLORS.success : COLORS.warning;
    const statusLabel = isActive ? 'Active' : 'Pending';

    const frequencyLabel = getFrequencyLabel(friend.call_frequency_per_month);

    const nextCallText = nextCallDate
      ? `Next: ${format(nextCallDate, 'MMM d, h:mm a')}`
      : 'No upcoming calls';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: cardBg,
            borderColor,
            shadowColor: isDark ? '#000000' : '#000000',
          },
        ]}
        onPress={onPress}
        activeOpacity={onPress ? 0.7 : 1}
        accessibilityRole="button"
        accessibilityLabel={`${friend.name}, ${statusLabel}, ${frequencyLabel}, ${nextCallText}`}
      >
        {/* Avatar */}
        <View
          style={[styles.avatar, { backgroundColor: COLORS.primary }]}
          accessibilityLabel={`Avatar for ${friend.name}`}
        >
          <Text style={styles.avatarText}>{getInitial(friend.name)}</Text>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
            {friend.name}
          </Text>

          <View style={styles.badges}>
            {/* Status badge */}
            <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
              <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>

            {/* Frequency badge */}
            <View
              style={[
                styles.badge,
                { backgroundColor: isDark ? COLORS.borderDark : COLORS.border },
              ]}
            >
              <Text style={[styles.badgeText, { color: secondaryText }]}>
                {frequencyLabel}
              </Text>
            </View>
          </View>

          <Text style={[styles.nextCall, { color: secondaryText }]}>{nextCallText}</Text>
        </View>

        {/* Actions */}
        {showActions && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.menuButton}
              onPress={toggleMenu}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Friend options menu"
            >
              <Text style={[styles.menuDots, { color: secondaryText }]}>
                {'•••'}
              </Text>
            </TouchableOpacity>

            {menuOpen && (
              <View
                style={[
                  styles.menuDropdown,
                  {
                    backgroundColor: isDark ? COLORS.backgroundDark : COLORS.background,
                    borderColor,
                    shadowColor: '#000000',
                  },
                ]}
              >
                {onEditFrequency && (
                  <TouchableOpacity
                    style={[styles.menuItem, { borderBottomColor: borderColor }]}
                    onPress={handleEditFrequency}
                    accessibilityRole="button"
                    accessibilityLabel="Edit call frequency"
                  >
                    <Text style={[styles.menuItemText, { color: textColor }]}>
                      Edit Frequency
                    </Text>
                  </TouchableOpacity>
                )}
                {onRemove && (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleRemove}
                    accessibilityRole="button"
                    accessibilityLabel="Remove friend"
                  >
                    <Text style={[styles.menuItemText, { color: COLORS.error }]}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

FriendCard.displayName = 'FriendCard';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 4,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  nextCall: {
    fontSize: 13,
    marginTop: 2,
  },
  actionsContainer: {
    position: 'relative',
    marginLeft: 8,
  },
  menuButton: {
    padding: 4,
  },
  menuDots: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    transform: [{ rotate: '90deg' }],
  },
  menuDropdown: {
    position: 'absolute',
    top: 28,
    right: 0,
    minWidth: 150,
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 100,
    overflow: 'hidden',
  },
  menuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FriendCard;
