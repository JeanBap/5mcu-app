import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, APP_CONFIG, FREQUENCY_OPTIONS, frequencyLabel } from '@/constants/config';
import { useFriends } from '@/hooks/useFriends';
import { useAuth } from '@/hooks/useAuth';
import FriendCard from '@/components/FriendCard';
import PaywallModal from '@/components/PaywallModal';

interface Friend {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  frequency: number;
  status: 'active' | 'pending' | 'invited';
  next_call_date?: string;
  avatar_url?: string;
}

interface AddFriendForm {
  name: string;
  phone: string;
  email: string;
  frequency: number;
}

const INITIAL_FORM: AddFriendForm = {
  name: '',
  phone: '',
  email: '',
  frequency: 30,
};

const FREQ_OPTIONS = FREQUENCY_OPTIONS;

export default function FriendsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const {
    friends,
    fetchFriends,
    addFriend,
    updateFrequency,
    removeFriend,
    sendInvite,
    getFriendCount,
    isLoading,
  } = useFriends();

  const { profile } = useAuth();

  const [modalVisible, setModalVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [form, setForm] = useState<AddFriendForm>(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isPremium = profile?.is_premium === true;
  const friendCount = getFriendCount();
  const atFreeLimit = !isPremium && friendCount >= APP_CONFIG.maxFreeFriends;

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFriends();
    } catch (err) {
      Alert.alert('Error', 'Failed to refresh friends list.');
    } finally {
      setRefreshing(false);
    }
  }, [fetchFriends]);

  const handleFabPress = () => {
    if (atFreeLimit) {
      setPaywallVisible(true);
      return;
    }
    setForm(INITIAL_FORM);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setForm(INITIAL_FORM);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing info', 'Please enter your friend\'s name to continue.');
      return;
    }

    // TODO: Add Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) when expo-haptics is installed
    setIsSubmitting(true);
    try {
      const newFriend = await addFriend(
        form.name.trim(),
        form.phone.trim() || '',
        form.email.trim() || '',
        form.frequency,
      );

      handleCloseModal();
      await fetchFriends();

      if (newFriend?.id) {
        Alert.alert(
          'Friend Added',
          `Would you like to send an invite to ${form.name.trim()}?`,
          [
            { text: 'Not Now', style: 'cancel' },
            {
              text: 'Send Invite',
              onPress: async () => {
                try {
                  await sendInvite(newFriend.id);
                  Alert.alert('Sent', 'Invite sent successfully.');
                } catch (inviteErr) {
                  Alert.alert('Error', 'Failed to send invite. You can try again later.');
                }
              },
            },
          ],
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to add friend. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFriendPress = (friend: Friend) => {
    router.push(`/book/${friend.id}` as const);
  };

  const bg = isDark ? COLORS.backgroundDark : COLORS.background;
  const cardBg = isDark ? COLORS.cardDark : COLORS.card;
  const textColor = isDark ? COLORS.textDark : COLORS.text;
  const textSecondary = isDark ? COLORS.textSecondaryDark : COLORS.textSecondary;
  const borderColor = isDark ? COLORS.borderDark : COLORS.border;

  const renderFriendItem = ({ item }: { item: Friend }) => (
    <FriendCard
      friend={item}
      onPress={() => handleFriendPress(item)}
    />
  );

  const renderEmptyState = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>👥</Text>
        <Text style={[styles.emptyTitle, { color: textColor }]}>No friends yet</Text>
        <Text style={[styles.emptySubtitle, { color: textSecondary }]}>
          Add your first friend to start catching up!
        </Text>
        <Pressable
          style={[styles.emptyButton, { backgroundColor: COLORS.primary }]}
          onPress={handleFabPress}
          accessibilityLabel="Add your first friend"
          accessibilityRole="button"
        >
          <Text style={styles.emptyButtonText}>Add Friend</Text>
        </Pressable>
      </View>
    );
  };

  const renderFreeLimitBanner = () => {
    if (!atFreeLimit) return null;
    return (
      <View style={[styles.banner, { backgroundColor: COLORS.warning }]}>
        <Text style={styles.bannerText}>
          You&apos;re connected with {APP_CONFIG.maxFreeFriends} friends — upgrade to add more.
        </Text>
        <Pressable
          onPress={() => setPaywallVisible(true)}
          accessibilityLabel="Upgrade to premium"
          accessibilityRole="button"
        >
          <Text style={styles.bannerUpgrade}>Upgrade</Text>
        </Pressable>
      </View>
    );
  };

  const renderFrequencyPicker = () => (
    <View style={styles.frequencyGrid}>
      {FREQ_OPTIONS.map((option) => {
        const isSelected = form.frequency === option.value;
        return (
          <Pressable
            key={option.value}
            style={[
              styles.frequencyPill,
              { backgroundColor: isSelected ? COLORS.primary : cardBg },
            ]}
            onPress={() => {
              // TODO: Add Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) when expo-haptics is installed
              setForm((prev) => ({ ...prev, frequency: option.value }));
            }}
            accessibilityLabel={`Set frequency to ${option.label}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.frequencyPillText,
                { color: isSelected ? '#FFFFFF' : textSecondary },
              ]}
            >
              {option.shortLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const renderManualTab = () => (
    <View style={styles.formContainer}>
      <TextInput
        style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor }]}
        placeholder="Name *"
        placeholderTextColor={textSecondary}
        value={form.name}
        onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
        accessibilityLabel="Friend name, required"
        autoCapitalize="words"
      />
      <TextInput
        style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor }]}
        placeholder="Phone"
        placeholderTextColor={textSecondary}
        value={form.phone}
        onChangeText={(text) => setForm((prev) => ({ ...prev, phone: text }))}
        keyboardType="phone-pad"
        accessibilityLabel="Phone number"
      />
      <TextInput
        style={[styles.input, { backgroundColor: cardBg, color: textColor, borderColor }]}
        placeholder="Email"
        placeholderTextColor={textSecondary}
        value={form.email}
        onChangeText={(text) => setForm((prev) => ({ ...prev, email: text }))}
        keyboardType="email-address"
        autoCapitalize="none"
        accessibilityLabel="Email address"
      />

      <Text style={[styles.fieldLabel, { color: textSecondary }]}>Frequency</Text>
      {renderFrequencyPicker()}

      <Pressable
        style={[
          styles.submitButton,
          { backgroundColor: COLORS.primary },
          isSubmitting && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={isSubmitting}
        accessibilityLabel="Add friend"
        accessibilityRole="button"
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.submitButtonText}>Add Friend</Text>
        )}
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Friends</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{friendCount}</Text>
        </View>
      </View>

      {/* Free limit banner */}
      {renderFreeLimitBanner()}

      {/* Loading state */}
      {isLoading && !refreshing && friends.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={[styles.loadingText, { color: textSecondary }]}>
            Loading friends...
          </Text>
        </View>
      ) : (
        <FlatList
          data={friends as Friend[]}
          keyExtractor={(item) => item.id}
          renderItem={renderFriendItem}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={
            friends.length === 0 ? styles.emptyListContent : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: COLORS.primary }]}
        onPress={handleFabPress}
        accessibilityLabel="Add friend"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+</Text>
      </Pressable>

      {/* Add Friend Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: bg }]}>
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Add a Friend</Text>
            <Pressable
              onPress={handleCloseModal}
              style={styles.closeButton}
              accessibilityLabel="Close modal"
              accessibilityRole="button"
            >
              <Text style={[styles.closeButtonText, { color: textSecondary }]}>✕</Text>
            </Pressable>
          </View>

          {/* Add friend form */}
          {renderManualTab()}
        </View>
      </Modal>

      {/* Paywall Modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    paddingHorizontal: 8,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 10,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  bannerUpgrade: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 160,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyContainer: {
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 30,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '500',
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 4,
  },
  frequencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  frequencyPill: {
    width: '23%' as any,
    paddingVertical: 8,
    minHeight: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
