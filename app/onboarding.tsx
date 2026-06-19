import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Platform,
  StyleSheet,
  useColorScheme,
  ListRenderItemInfo,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS, FREQUENCY_OPTIONS } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import SlotPicker from '@/components/SlotPicker';
import {
  requestContactsPermission,
  getPhoneContacts,
  PhoneContact,
} from '@/lib/contacts';

type FrequencyDays = (typeof FREQUENCY_OPTIONS)[number]['value'];

interface VideoApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  iosOnly?: boolean;
}

const VIDEO_APPS: VideoApp[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    icon: '📱',
    description: 'Video call via WhatsApp',
  },
  {
    id: 'facetime',
    name: 'FaceTime',
    icon: '📞',
    description: 'Apple FaceTime call',
    iosOnly: true,
  },
  {
    id: 'jitsi',
    name: 'Jitsi Meet',
    icon: '🎥',
    description: 'Free, open-source video',
  },
  {
    id: 'zoom',
    name: 'Zoom',
    icon: '💻',
    description: 'Zoom video meeting',
  },
];

const FREQUENCY_OPTIONS: { value: FrequencyOption; label: string }[] = [
  { value: 1, label: '1x' },
  { value: 2, label: '2x' },
  { value: 4, label: '4x' },
];

const TOTAL_STEPS = 3;

export default function OnboardingScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { profile } = useAuth();

  const [currentStep, setCurrentStep] = useState<0 | 1 | 2>(0);

  // Step 0 state
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);

  // Step 1 state
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [contactSearch, setContactSearch] = useState('');
  const [selectedContact, setSelectedContact] = useState<PhoneContact | null>(null);
  const [frequency, setFrequency] = useState<number>(30);
  const [contactsLoaded, setContactsLoaded] = useState(false);

  // Step 2 state
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  const bg = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.textDark : COLORS.text;
  const secondaryText = isDark ? COLORS.textSecondaryDark : COLORS.textSecondary;
  const cardBg = isDark ? COLORS.cardDark : COLORS.card;
  const borderColor = isDark ? COLORS.borderDark : COLORS.border;

  const goNext = () => {
    if (currentStep < 2) {
      setCurrentStep((currentStep + 1) as 0 | 1 | 2);
    } else {
      finishOnboarding();
    }
  };

  const handleSkip = () => {
    if (currentStep < 2) {
      setCurrentStep((currentStep + 1) as 0 | 1 | 2);
    } else {
      finishOnboarding();
    }
  };

  const finishOnboarding = () => {
    router.replace('/(tabs)');
  };

  const handleMorningSlot = () => {
    setSelectedSlots((prev) =>
      prev.includes('08:00') ? prev.filter((s) => s !== '08:00') : [...prev, '08:00'],
    );
  };

  const handleEveningSlot = () => {
    setSelectedSlots((prev) =>
      prev.includes('18:00') ? prev.filter((s) => s !== '18:00') : [...prev, '18:00'],
    );
  };

  const loadContacts = useCallback(async () => {
    if (contactsLoaded) return;
    const granted = await requestContactsPermission();
    if (granted) {
      const fetchedContacts = await getPhoneContacts();
      setContacts(fetchedContacts);
    }
    setContactsLoaded(true);
  }, [contactsLoaded]);

  const filteredContacts = contacts.filter((c) => {
    if (!contactSearch.trim()) return true;
    const query = contactSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(query) ||
      (c.phone && c.phone.toLowerCase().includes(query))
    );
  });

  const handleStepOneMount = useCallback(() => {
    loadContacts();
  }, [loadContacts]);

  if (currentStep === 1 && !contactsLoaded) {
    handleStepOneMount();
  }

  const availableApps = VIDEO_APPS.filter(
    (app) => !app.iosOnly || Platform.OS === 'ios',
  );

  const renderContactItem = useCallback(
    ({ item }: ListRenderItemInfo<PhoneContact>) => {
      const isSelected = selectedContact?.phone === item.phone;
      return (
        <TouchableOpacity
          style={[
            styles.contactItem,
            { borderColor },
            isSelected && {
              borderColor: COLORS.primary,
              backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
            },
          ]}
          onPress={() => setSelectedContact(item)}
          accessibilityRole="button"
          accessibilityLabel={`Select ${item.name}`}
          accessibilityState={{ selected: isSelected }}
          activeOpacity={0.7}
        >
          <View style={[styles.contactAvatar, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={styles.contactAvatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={[styles.contactName, { color: textColor }]}>{item.name}</Text>
            {item.phone ? (
              <Text style={[styles.contactPhone, { color: secondaryText }]}>
                {item.phone}
              </Text>
            ) : null}
          </View>
          {isSelected ? (
            <Text style={[styles.checkmark, { color: COLORS.primary }]}>{'✓'}</Text>
          ) : null}
        </TouchableOpacity>
      );
    },
    [selectedContact, isDark, textColor, secondaryText, borderColor],
  );

  const renderProgressDots = () => (
    <View style={styles.progressContainer} accessibilityLabel={`Step ${currentStep + 1} of ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.progressDot,
            {
              backgroundColor:
                index === currentStep
                  ? COLORS.primary
                  : isDark
                    ? COLORS.borderDark
                    : COLORS.border,
            },
            index === currentStep && styles.progressDotActive,
          ]}
        />
      ))}
    </View>
  );

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      <Text
        style={[styles.stepTitle, { color: textColor }]}
        accessibilityRole="header"
      >
        Set Your Availability
      </Text>
      <Text style={[styles.stepSubtitle, { color: secondaryText }]}>
        When are you free for a 5-minute catch up?
      </Text>

      <View style={styles.quickSlotRow}>
        <TouchableOpacity
          style={[
            styles.quickSlotButton,
            { borderColor },
            selectedSlots.includes('08:00') && {
              backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
              borderColor: COLORS.primary,
            },
          ]}
          onPress={handleMorningSlot}
          accessibilityRole="button"
          accessibilityLabel="Morning slot, 8 to 9 AM"
          accessibilityState={{ selected: selectedSlots.includes('08:00') }}
          activeOpacity={0.7}
        >
          <Text style={styles.quickSlotEmoji}>{'🌅'}</Text>
          <Text style={[styles.quickSlotLabel, { color: textColor }]}>Morning</Text>
          <Text style={[styles.quickSlotTime, { color: secondaryText }]}>8-9 AM</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.quickSlotButton,
            { borderColor },
            selectedSlots.includes('18:00') && {
              backgroundColor: isDark ? '#1E1B4B' : '#EEF2FF',
              borderColor: COLORS.primary,
            },
          ]}
          onPress={handleEveningSlot}
          accessibilityRole="button"
          accessibilityLabel="Evening slot, 6 to 7 PM"
          accessibilityState={{ selected: selectedSlots.includes('18:00') }}
          activeOpacity={0.7}
        >
          <Text style={styles.quickSlotEmoji}>{'🌆'}</Text>
          <Text style={[styles.quickSlotLabel, { color: textColor }]}>Evening</Text>
          <Text style={[styles.quickSlotTime, { color: secondaryText }]}>6-7 PM</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.slotPickerContainer}>
        <SlotPicker
          date={new Date()}
          selectedSlots={selectedSlots}
          onSlotsChange={setSelectedSlots}
        />
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text
        style={[styles.stepTitle, { color: textColor }]}
        accessibilityRole="header"
      >
        Add Your First Friend
      </Text>
      <Text style={[styles.stepSubtitle, { color: secondaryText }]}>
        Choose someone you want to catch up with regularly
      </Text>

      <TextInput
        style={[
          styles.searchInput,
          {
            backgroundColor: cardBg,
            borderColor,
            color: textColor,
          },
        ]}
        placeholder="Search contacts..."
        placeholderTextColor={secondaryText}
        value={contactSearch}
        onChangeText={setContactSearch}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel="Search contacts"
        accessibilityHint="Type a name or phone number to filter your contacts"
      />

      {selectedContact ? (
        <View
          style={[styles.selectedContactCard, { backgroundColor: cardBg, borderColor }]}
          accessibilityLabel={`Selected contact: ${selectedContact.name}`}
        >
          <View style={styles.selectedContactRow}>
            <View style={[styles.contactAvatar, { backgroundColor: COLORS.primaryLight }]}>
              <Text style={styles.contactAvatarText}>
                {selectedContact.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.contactInfo}>
              <Text style={[styles.contactName, { color: textColor }]}>
                {selectedContact.name}
              </Text>
              {selectedContact.phone ? (
                <Text style={[styles.contactPhone, { color: secondaryText }]}>
                  {selectedContact.phone}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedContact(null)}
              accessibilityRole="button"
              accessibilityLabel="Remove selected contact"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.removeButton, { color: secondaryText }]}>{'✕'}</Text>
            </TouchableOpacity>
          </View>

          <Text
            style={[styles.frequencyLabel, { color: secondaryText }]}
          >
            How often do you want to catch up?
          </Text>
          <View style={styles.frequencyGrid}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.frequencyButton,
                  { borderColor },
                  frequency === opt.value && {
                    backgroundColor: COLORS.primary,
                    borderColor: COLORS.primary,
                  },
                ]}
                onPress={() => setFrequency(opt.value)}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected: frequency === opt.value }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.frequencyButtonText,
                    { color: frequency === opt.value ? '#FFFFFF' : textColor },
                  ]}
                >
                  {opt.shortLabel}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <FlatList
        data={filteredContacts}
        keyExtractor={(item, index) => `${item.phone ?? ''}-${index}`}
        renderItem={renderContactItem}
        style={styles.contactList}
        contentContainerStyle={styles.contactListContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: secondaryText }]}>
              {contactsLoaded
                ? 'No contacts found. You can add friends later.'
                : 'Loading contacts...'}
            </Text>
          </View>
        }
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text
        style={[styles.stepTitle, { color: textColor }]}
        accessibilityRole="header"
      >
        Choose Your Video App
      </Text>
      <Text style={[styles.stepSubtitle, { color: secondaryText }]}>
        How would you like to make your catch-up calls?
      </Text>

      <View style={styles.appGrid}>
        {availableApps.map((app) => {
          const isSelected = selectedApp === app.id;
          return (
            <TouchableOpacity
              key={app.id}
              style={[
                styles.appCard,
                {
                  backgroundColor: cardBg,
                  borderColor: isSelected ? COLORS.primary : borderColor,
                },
                isSelected && styles.appCardSelected,
              ]}
              onPress={() => setSelectedApp(app.id)}
              accessibilityRole="button"
              accessibilityLabel={`${app.name}: ${app.description}`}
              accessibilityState={{ selected: isSelected }}
              activeOpacity={0.7}
            >
              {isSelected ? (
                <View style={[styles.appCheckmark, { backgroundColor: COLORS.primary }]}>
                  <Text style={styles.appCheckmarkText}>{'✓'}</Text>
                </View>
              ) : null}
              <Text style={styles.appIcon}>{app.icon}</Text>
              <Text style={[styles.appName, { color: textColor }]}>{app.name}</Text>
              <Text style={[styles.appDescription, { color: secondaryText }]}>
                {app.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      {renderProgressDots()}

      <View style={styles.stepsContainer}>
        {currentStep === 0 && renderStep0()}
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.nextButton, { backgroundColor: COLORS.primary }]}
          onPress={goNext}
          accessibilityRole="button"
          accessibilityLabel={currentStep === 2 ? 'Get started' : 'Next step'}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentStep === 2 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip this step"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.skipText, { color: secondaryText }]}>Skip</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  progressDotActive: {
    width: 24,
    borderRadius: 4,
  },
  stepsContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stepContent: {
    flex: 1,
    paddingTop: 16,
  },
  stepTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  quickSlotRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickSlotButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickSlotEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  quickSlotLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  quickSlotTime: {
    fontSize: 13,
  },
  slotPickerContainer: {
    flex: 1,
  },
  searchInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  selectedContactCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  selectedContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactList: {
    flex: 1,
  },
  contactListContent: {
    paddingBottom: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  contactAvatarText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '500',
  },
  contactPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  removeButton: {
    fontSize: 18,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  frequencyLabel: {
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  frequencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    width: '23%' as any,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
  },
  appGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  appCard: {
    width: '47%',
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    position: 'relative',
  },
  appCardSelected: {
    borderWidth: 2,
  },
  appCheckmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appCheckmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  appIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  appDescription: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  bottomBar: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  nextButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
