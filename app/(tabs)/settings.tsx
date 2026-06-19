import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Switch,
  Modal,
  Alert,
  Linking,
  useColorScheme,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { COLORS, APP_CONFIG, VIDEO_APPS } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import PaywallModal from '@/components/PaywallModal';

const COMMON_TIMEZONES: string[] = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'Pacific/Auckland',
];

interface VideoApp {
  id: string;
  name: string;
  icon: string;
}

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { session, user, profile, signOut, updateProfile } = useAuth();

  const [showPaywall, setShowPaywall] = useState(false);
  const [showTimezoneModal, setShowTimezoneModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(profile?.full_name ?? '');
  const [callReminders, setCallReminders] = useState(
    profile?.call_reminders ?? true
  );
  const [weeklySummary, setWeeklySummary] = useState(
    profile?.weekly_summary ?? true
  );
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const bg = isDark ? COLORS.backgroundDark : COLORS.background;
  const cardBg = isDark ? COLORS.cardDark : COLORS.card;
  const textColor = isDark ? COLORS.textDark : COLORS.text;
  const textSecondaryColor = isDark
    ? COLORS.textSecondaryDark
    : COLORS.textSecondary;
  const borderColor = isDark ? COLORS.borderDark : COLORS.border;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await updateProfile({});
    } catch {
      // profile refresh failed silently
    } finally {
      setRefreshing(false);
    }
  }, [updateProfile]);

  const handleUpdateProfile = async (
    field: string,
    updates: Record<string, unknown>
  ) => {
    setUpdatingField(field);
    try {
      await updateProfile(updates);
    } catch {
      Alert.alert('Error', `Failed to update ${field}. Please try again.`);
    } finally {
      setUpdatingField(null);
    }
  };

  const handleEditName = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Edit Name',
        'Enter your full name',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (value?: string) => {
              if (value && value.trim().length > 0) {
                handleUpdateProfile('full_name', {
                  full_name: value.trim(),
                });
              }
            },
          },
        ],
        'plain-text',
        profile?.full_name ?? ''
      );
    } else {
      setEditedName(profile?.full_name ?? '');
      setIsEditingName(true);
    }
  };

  const handleSaveName = () => {
    const trimmed = editedName.trim();
    if (trimmed.length > 0) {
      handleUpdateProfile('full_name', { full_name: trimmed });
    }
    setIsEditingName(false);
  };

  const handlePhotoPress = () => {
    Alert.alert('Not quite ready', 'Photo upload is on its way.');
  };

  const handleSelectVideoApp = (appId: string) => {
    handleUpdateProfile('preferred_video_app', {
      preferred_video_app: appId,
    });
  };

  const handleSelectTimezone = (tz: string) => {
    setShowTimezoneModal(false);
    handleUpdateProfile('timezone', { timezone: tz });
  };

  const handleToggleCallReminders = (value: boolean) => {
    setCallReminders(value);
    handleUpdateProfile('call_reminders', { call_reminders: value });
  };

  const handleToggleWeeklySummary = (value: boolean) => {
    setWeeklySummary(value);
    handleUpdateProfile('weekly_summary', { weekly_summary: value });
  };

  const handleRestore = () => {
    Alert.alert('Not quite ready', 'Restore purchases is on its way.');
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          signOut();
        },
      },
    ]);
  };

  const currentTimezone =
    profile?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  const selectedVideoApp = profile?.preferred_video_app ?? 'facetime';

  const userInitial =
    profile?.full_name && profile.full_name.length > 0
      ? profile.full_name.charAt(0).toUpperCase()
      : '?';

  const isPremium = profile?.is_premium === true;

  const renderSectionHeader = (title: string) => (
    <Text style={[styles.sectionHeader, { color: textSecondaryColor }]}>
      {title}
    </Text>
  );

  const renderRow = (
    left: React.ReactNode,
    right: React.ReactNode,
    options?: {
      onPress?: () => void;
      isLast?: boolean;
      accessibilityLabel?: string;
    }
  ) => {
    const content = (
      <View
        style={[
          styles.row,
          !options?.isLast && { borderBottomWidth: 1, borderBottomColor: borderColor },
        ]}
      >
        <View style={styles.rowLeft}>{left}</View>
        <View style={styles.rowRight}>{right}</View>
      </View>
    );

    if (options?.onPress) {
      return (
        <TouchableOpacity
          onPress={options.onPress}
          accessibilityLabel={options.accessibilityLabel}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          {content}
        </TouchableOpacity>
      );
    }

    return content;
  };

  const renderChevron = () => (
    <Text style={[styles.chevron, { color: textSecondaryColor }]}>{'>'}</Text>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            onPress={handlePhotoPress}
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
            style={styles.avatarContainer}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{userInitial}</Text>
            </View>
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraIcon}>{'📷'}</Text>
            </View>
          </TouchableOpacity>

          {isEditingName ? (
            <View style={styles.nameEditContainer}>
              <TextInput
                style={[
                  styles.nameInput,
                  { color: textColor, borderColor: COLORS.primary },
                ]}
                value={editedName}
                onChangeText={setEditedName}
                onSubmitEditing={handleSaveName}
                onBlur={handleSaveName}
                autoFocus
                returnKeyType="done"
                accessibilityLabel="Edit full name"
                placeholder="Enter your name"
                placeholderTextColor={textSecondaryColor}
              />
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleEditName}
              accessibilityLabel="Tap to edit your name"
              accessibilityRole="button"
            >
              <View style={styles.nameRow}>
                <Text style={[styles.profileName, { color: textColor }]}>
                  {profile?.full_name ?? 'Set your name'}
                </Text>
                {updatingField === 'full_name' && (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                    style={styles.inlineLoader}
                  />
                )}
              </View>
            </TouchableOpacity>
          )}

          <Text
            style={[styles.profileEmail, { color: textSecondaryColor }]}
            accessibilityLabel={`Email: ${user?.email ?? 'Not set'}`}
          >
            {user?.email ?? ''}
          </Text>
        </View>

        {/* Preferences Section */}
        {renderSectionHeader('PREFERENCES')}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: borderColor }]}>
            <View style={styles.fullWidth}>
              <Text style={[styles.rowLabel, { color: textColor }]}>
                Preferred Video App
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.videoAppsRow}
                style={styles.videoAppsScroll}
              >
                {(VIDEO_APPS as VideoApp[]).map((app) => {
                  const isSelected = selectedVideoApp === app.id;
                  return (
                    <TouchableOpacity
                      key={app.id}
                      onPress={() => handleSelectVideoApp(app.id)}
                      accessibilityLabel={`Select ${app.name} as preferred video app${isSelected ? ', currently selected' : ''}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      activeOpacity={0.7}
                      style={[
                        styles.videoAppCard,
                        {
                          backgroundColor: isDark
                            ? COLORS.backgroundDark
                            : COLORS.background,
                        },
                        isSelected && styles.videoAppCardSelected,
                      ]}
                    >
                      <Text style={styles.videoAppIcon}>{app.icon}</Text>
                      <Text
                        style={[
                          styles.videoAppName,
                          { color: isSelected ? COLORS.primary : textSecondaryColor },
                        ]}
                        numberOfLines={1}
                      >
                        {app.name}
                      </Text>
                      {updatingField === 'preferred_video_app' &&
                        isSelected && (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.primary}
                            style={styles.videoAppLoader}
                          />
                        )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {renderRow(
            <View>
              <Text style={[styles.rowLabel, { color: textColor }]}>
                Timezone
              </Text>
              <Text style={[styles.rowSubLabel, { color: textSecondaryColor }]}>
                {currentTimezone}
              </Text>
            </View>,
            <View style={styles.rowRightInline}>
              {updatingField === 'timezone' && (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={styles.inlineLoader}
                />
              )}
              {renderChevron()}
            </View>,
            {
              onPress: () => setShowTimezoneModal(true),
              isLast: true,
              accessibilityLabel: `Timezone: ${currentTimezone}. Tap to change.`,
            }
          )}
        </View>

        {/* Subscription Section */}
        {renderSectionHeader('SUBSCRIPTION')}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          {isPremium ? (
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <View>
                <View style={styles.premiumBadge}>
                  <Text style={styles.premiumBadgeText}>
                    Premium Active {'✨'}
                  </Text>
                </View>
                {profile?.renewal_date && (
                  <Text
                    style={[
                      styles.rowSubLabel,
                      { color: textSecondaryColor, marginTop: 4 },
                    ]}
                  >
                    Renews {profile.renewal_date}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.subscriptionFreeContainer}>
              <View style={[styles.row, { borderBottomWidth: 0 }]}>
                <View>
                  <Text style={[styles.rowLabel, { color: textColor }]}>
                    Free Plan
                  </Text>
                  <Text
                    style={[
                      styles.rowSubLabel,
                      { color: textSecondaryColor, marginTop: 4 },
                    ]}
                  >
                    3 friends, 20 slots
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => setShowPaywall(true)}
                accessibilityLabel="Upgrade to Premium"
                accessibilityRole="button"
                activeOpacity={0.8}
              >
                <Text style={styles.upgradeButtonText}>
                  Upgrade to Premium
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={handleRestore}
          accessibilityLabel="Restore purchases"
          accessibilityRole="button"
          style={styles.restoreButton}
        >
          <Text style={[styles.restoreText, { color: textSecondaryColor }]}>
            Restore Purchases
          </Text>
        </TouchableOpacity>

        {/* Notifications Section */}
        {renderSectionHeader('NOTIFICATIONS')}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          {renderRow(
            <Text style={[styles.rowLabel, { color: textColor }]}>
              Call Reminders
            </Text>,
            <View style={styles.rowRightInline}>
              {updatingField === 'call_reminders' && (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={styles.inlineLoader}
                />
              )}
              <Switch
                value={callReminders}
                onValueChange={handleToggleCallReminders}
                trackColor={{
                  false: COLORS.border,
                  true: COLORS.primaryLight,
                }}
                thumbColor={callReminders ? COLORS.primary : '#f4f3f4'}
                accessibilityLabel="Toggle call reminders"
                accessibilityRole="switch"
              />
            </View>
          )}
          {renderRow(
            <Text style={[styles.rowLabel, { color: textColor }]}>
              Weekly Summary
            </Text>,
            <View style={styles.rowRightInline}>
              {updatingField === 'weekly_summary' && (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={styles.inlineLoader}
                />
              )}
              <Switch
                value={weeklySummary}
                onValueChange={handleToggleWeeklySummary}
                trackColor={{
                  false: COLORS.border,
                  true: COLORS.primaryLight,
                }}
                thumbColor={weeklySummary ? COLORS.primary : '#f4f3f4'}
                accessibilityLabel="Toggle weekly summary"
                accessibilityRole="switch"
              />
            </View>,
            { isLast: true }
          )}
        </View>

        {/* About Section */}
        {renderSectionHeader('ABOUT')}
        <View style={[styles.sectionCard, { backgroundColor: cardBg }]}>
          {renderRow(
            <Text style={[styles.rowLabel, { color: textColor }]}>
              Privacy Policy
            </Text>,
            renderChevron(),
            {
              onPress: () => Linking.openURL('https://5mcu.app/privacy'),
              accessibilityLabel: 'Open Privacy Policy',
            }
          )}
          {renderRow(
            <Text style={[styles.rowLabel, { color: textColor }]}>
              Terms of Service
            </Text>,
            renderChevron(),
            {
              onPress: () => Linking.openURL('https://5mcu.app/terms'),
              accessibilityLabel: 'Open Terms of Service',
            }
          )}
          {renderRow(
            <Text style={[styles.rowLabel, { color: textColor }]}>
              Support
            </Text>,
            renderChevron(),
            {
              onPress: () => Linking.openURL('mailto:support@5mcu.app'),
              accessibilityLabel: 'Contact support via email',
            }
          )}
          {renderRow(
            <Text style={[styles.rowLabel, { color: textColor }]}>
              Version
            </Text>,
            <Text style={[styles.versionText, { color: textSecondaryColor }]}>
              1.0.0 (1)
            </Text>,
            { isLast: true }
          )}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={handleSignOut}
          accessibilityLabel="Sign out of your account"
          accessibilityRole="button"
          style={styles.signOutButton}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Timezone Modal */}
      <Modal
        visible={showTimezoneModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTimezoneModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: bg }]}>
          <View
            style={[
              styles.modalHeader,
              { borderBottomColor: borderColor },
            ]}
          >
            <Text style={[styles.modalTitle, { color: textColor }]}>
              Select Timezone
            </Text>
            <TouchableOpacity
              onPress={() => setShowTimezoneModal(false)}
              accessibilityLabel="Close timezone selector"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={[styles.modalClose, { color: COLORS.primary }]}>
                Done
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalScrollContent}>
            {COMMON_TIMEZONES.map((tz) => {
              const isSelected = currentTimezone === tz;
              return (
                <TouchableOpacity
                  key={tz}
                  onPress={() => handleSelectTimezone(tz)}
                  accessibilityLabel={`Select timezone ${tz}${isSelected ? ', currently selected' : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.timezoneRow,
                    { borderBottomColor: borderColor },
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.timezoneText,
                      {
                        color: isSelected ? COLORS.primary : textColor,
                        fontWeight: isSelected ? '600' : '400',
                      },
                    ]}
                  >
                    {tz}
                  </Text>
                  {isSelected && (
                    <Text style={styles.checkmark}>{'✓'}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Modal>

      {/* Paywall Modal */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },

  // Profile
  profileSection: {
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  cameraIcon: {
    fontSize: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 4,
  },
  nameEditContainer: {
    width: '80%',
    marginBottom: 4,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineLoader: {
    marginLeft: 8,
  },

  // Sections
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 24,
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  // Rows
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowRight: {
    flexShrink: 0,
  },
  rowRightInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowSubLabel: {
    fontSize: 13,
    marginTop: 2,
  },
  fullWidth: {
    flex: 1,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '500',
  },

  // Video Apps
  videoAppsScroll: {
    marginTop: 10,
    marginBottom: 2,
  },
  videoAppsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 4,
  },
  videoAppCard: {
    width: 80,
    height: 90,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  videoAppCardSelected: {
    borderColor: COLORS.primary,
  },
  videoAppIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  videoAppName: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  videoAppLoader: {
    position: 'absolute',
    top: 4,
    right: 4,
  },

  // Subscription
  subscriptionFreeContainer: {
    paddingBottom: 16,
  },
  upgradeButton: {
    marginHorizontal: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  premiumBadge: {
    backgroundColor: COLORS.success + '1A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  premiumBadgeText: {
    color: COLORS.success,
    fontSize: 15,
    fontWeight: '600',
  },
  restoreButton: {
    alignItems: 'center',
    marginTop: 12,
  },
  restoreText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },

  // Version
  versionText: {
    fontSize: 14,
  },

  // Sign Out
  signOutButton: {
    alignItems: 'center',
    marginTop: 32,
    paddingVertical: 14,
  },
  signOutText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },

  // Timezone Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalClose: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalScrollContent: {
    paddingBottom: 40,
  },
  timezoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timezoneText: {
    fontSize: 16,
  },
  checkmark: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '700',
  },
});
