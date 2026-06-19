import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  useColorScheme,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FREQUENCY_OPTIONS } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { supabase } from '@/lib/supabase';

interface InviteData {
  id: string;
  invite_code: string;
  from_user_id: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface InviterProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface FriendRecord {
  id: string;
  frequency: number;
}

type ScreenState = 'loading' | 'error' | 'unauthenticated' | 'valid' | 'accepted';

const HOW_IT_WORKS_STEPS = [
  { icon: 'calendar-outline' as const, text: 'Set your available times' },
  { icon: 'git-compare-outline' as const, text: 'We match schedules automatically' },
  { icon: 'notifications-outline' as const, text: 'Get a reminder 1 minute before' },
  { icon: 'videocam-outline' as const, text: 'Enjoy a quick 5-minute catch-up!' },
];

export default function AcceptInviteScreen() {
  const { id: inviteCode } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { session, user } = useAuth();
  const { acceptInvite } = useFriends();

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [inviter, setInviter] = useState<InviterProfile | null>(null);
  const [friendRecord, setFriendRecord] = useState<FriendRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('This invite is invalid or has expired.');
  const [accepting, setAccepting] = useState(false);

  const colors = {
    bg: isDark ? COLORS.backgroundDark : COLORS.background,
    card: isDark ? COLORS.cardDark : COLORS.card,
    text: isDark ? COLORS.textDark : COLORS.text,
    textSecondary: isDark ? COLORS.textSecondaryDark : COLORS.textSecondary,
    border: isDark ? COLORS.borderDark : COLORS.border,
  };

  const fetchInviteData = useCallback(async () => {
    if (!inviteCode) {
      setErrorMessage('No invite code provided.');
      setScreenState('error');
      return;
    }

    try {
      setScreenState('loading');

      const { data: inviteData, error: inviteError } = await supabase
        .from('fmcu_invites')
        .select('*')
        .eq('invite_code', inviteCode)
        .eq('status', 'pending')
        .single();

      if (inviteError || !inviteData) {
        setErrorMessage('This invite is invalid or has expired.');
        setScreenState('error');
        return;
      }

      const now = new Date();
      if (inviteData.expires_at && new Date(inviteData.expires_at) < now) {
        setErrorMessage('This invite has expired.');
        setScreenState('error');
        return;
      }

      setInvite(inviteData as InviteData);

      const { data: profileData, error: profileError } = await supabase
        .from('fmcu_profiles')
        .select('id, full_name, avatar_url')
        .eq('id', inviteData.from_user_id)
        .single();

      if (profileError || !profileData) {
        setErrorMessage('Could not load inviter information.');
        setScreenState('error');
        return;
      }

      setInviter(profileData as InviterProfile);

      const { data: friendData } = await supabase
        .from('fmcu_friends')
        .select('id, frequency')
        .eq('invite_id', inviteData.id)
        .single();

      if (friendData) {
        setFriendRecord(friendData as FriendRecord);
      }

      if (!session) {
        setScreenState('unauthenticated');
      } else {
        setScreenState('valid');
      }
    } catch (err) {
      setErrorMessage('Something went wrong. Please try again.');
      setScreenState('error');
    }
  }, [inviteCode, session]);

  useEffect(() => {
    fetchInviteData();
  }, [fetchInviteData]);

  useEffect(() => {
    if (session && invite && inviter && screenState === 'unauthenticated') {
      setScreenState('valid');
    }
  }, [session, invite, inviter, screenState]);

  const getFrequencyLabel = (frequency: number): string => {
    const option = FREQUENCY_OPTIONS.find((opt) => opt.value === frequency);
    return option ? option.label : `${frequency}x`;
  };

  const handleAccept = async () => {
    if (!inviteCode || accepting) return;

    try {
      setAccepting(true);
      await acceptInvite(inviteCode);
      setScreenState('accepted');

      setTimeout(() => {
        router.replace('/(tabs)/');
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to accept invite.';
      Alert.alert('Error', message);
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Invite',
      'Are you sure you want to decline this invite?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: () => {
            router.replace('/(tabs)/');
          },
        },
      ]
    );
  };

  const navigateToLogin = () => {
    router.push({ pathname: '/auth/login', params: { returnTo: `/invite/${inviteCode}` } });
  };

  const navigateToRegister = () => {
    router.push({ pathname: '/auth/register', params: { returnTo: `/invite/${inviteCode}` } });
  };

  if (screenState === 'loading') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text
            style={[styles.loadingText, { color: colors.textSecondary }]}
            accessibilityLabel="Loading invite details"
          >
            Loading invite...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'error') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <View style={[styles.errorIconContainer, { backgroundColor: isDark ? '#3B1C1C' : '#FEE2E2' }]}>
            <Ionicons name="alert-circle" size={48} color={COLORS.error} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>
            Invite Not Found
          </Text>
          <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>
            {errorMessage}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
            onPress={() => router.replace('/(tabs)/')}
            accessibilityLabel="Go to home screen"
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Go Home</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'accepted') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.centered}>
          <View style={[styles.successIconContainer, { backgroundColor: isDark ? '#064E3B' : '#D1FAE5' }]}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.success} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>
            Invite Accepted!
          </Text>
          <Text style={[styles.successMessage, { color: colors.textSecondary }]}>
            You and {inviter?.full_name} are now connected. Redirecting...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (screenState === 'unauthenticated') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.unauthContent}>
            <View style={[styles.appIconContainer, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
              <Ionicons name="videocam" size={40} color={COLORS.primary} />
            </View>

            <Text style={[styles.unauthTitle, { color: colors.text }]}>
              {inviter?.full_name} invited you to 5MCU!
            </Text>

            <Text style={[styles.unauthSubtitle, { color: colors.textSecondary }]}>
              Sign in or create an account to accept this invite and start having 5-minute catch-ups.
            </Text>

            <Pressable
              style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
              onPress={navigateToLogin}
              accessibilityLabel="Sign in to your account"
              accessibilityRole="button"
            >
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, { borderColor: COLORS.primary }]}
              onPress={navigateToRegister}
              accessibilityLabel="Create a new account"
              accessibilityRole="button"
            >
              <Ionicons name="person-add-outline" size={20} color={COLORS.primary} style={styles.buttonIcon} />
              <Text style={[styles.secondaryButtonText, { color: COLORS.primary }]}>
                Create Account
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const frequencyLabel = friendRecord
    ? getFrequencyLabel(friendRecord.frequency)
    : 'regularly';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={[styles.appIconContainer, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
            <Ionicons name="videocam" size={40} color={COLORS.primary} />
          </View>

          <Text style={[styles.inviteTitle, { color: colors.text }]}>
            {inviter?.full_name} invited you to 5MCU!
          </Text>

          <Text style={[styles.inviteSubtitle, { color: colors.textSecondary }]}>
            They want to catch up with you {frequencyLabel} per month for 5-minute video calls.
          </Text>
        </View>

        <View style={[styles.howItWorksCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.howItWorksTitle, { color: colors.text }]}>
            How it works
          </Text>

          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <View key={index} style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: isDark ? '#312E81' : '#EEF2FF' }]}>
                <Ionicons name={step.icon} size={20} color={COLORS.primary} />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>
                  Step {index + 1}
                </Text>
                <Text style={[styles.stepText, { color: colors.text }]}>
                  {step.text}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.inviterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.inviterRow}>
            <View style={[styles.avatar, { backgroundColor: COLORS.primary }]}>
              <Text style={styles.avatarText}>
                {inviter?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={styles.inviterInfo}>
              <Text style={[styles.inviterName, { color: colors.text }]}>
                {inviter?.full_name}
              </Text>
              <Text style={[styles.frequencyText, { color: colors.textSecondary }]}>
                {frequencyLabel} per month
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionSection}>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: COLORS.primary },
              accepting && styles.buttonDisabled,
            ]}
            onPress={handleAccept}
            disabled={accepting}
            accessibilityLabel="Accept invite from this friend"
            accessibilityRole="button"
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={styles.buttonIcon} />
                <Text style={styles.primaryButtonText}>Accept Invite</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={styles.declineButton}
            onPress={handleDecline}
            accessibilityLabel="Decline this invite"
            accessibilityRole="button"
          >
            <Text style={[styles.declineText, { color: colors.textSecondary }]}>
              Decline
            </Text>
          </Pressable>
        </View>
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorIconContainer: {
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
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  unauthContent: {
    alignItems: 'center',
    paddingTop: 60,
  },
  appIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  unauthTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  unauthSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 32,
    marginBottom: 24,
  },
  inviteTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  inviteSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  howItWorksCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  howItWorksTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  stepText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  inviterCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 32,
  },
  inviterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  inviterInfo: {
    flex: 1,
  },
  inviterName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  frequencyText: {
    fontSize: 14,
  },
  actionSection: {
    alignItems: 'center',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 24,
    width: '100%',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 24,
    width: '100%',
    borderWidth: 2,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  declineButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  declineText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
