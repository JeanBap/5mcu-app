import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Platform,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { COLORS } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { signInWithEmail, signInWithGoogle, signInWithApple, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Google sign in failed.';
      setError(message);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    try {
      await signInWithApple();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Apple sign in failed.';
      setError(message);
    }
  };

  const bg = isDark ? COLORS.backgroundDark : COLORS.background;
  const textColor = isDark ? COLORS.textDark : COLORS.text;
  const secondaryText = isDark ? COLORS.textSecondaryDark : COLORS.textSecondary;
  const inputBg = isDark ? COLORS.cardDark : COLORS.card;
  const inputBorder = isDark ? COLORS.borderDark : COLORS.border;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: bg }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandingContainer}>
            <Text
              style={[styles.logo, { color: COLORS.primary }]}
              accessibilityRole="header"
            >
              5MCU
            </Text>
            <Text style={[styles.subtitle, { color: textColor }]}>
              Five Minute Catch Up
            </Text>
            <Text style={[styles.tagline, { color: secondaryText }]}>
              Stay connected in just 5 minutes
            </Text>
          </View>

          <View style={styles.formContainer}>
            {error ? (
              <View
                style={styles.errorContainer}
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
              >
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBg,
                  borderColor: inputBorder,
                  color: textColor,
                },
              ]}
              placeholder="Email"
              placeholderTextColor={secondaryText}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              returnKeyType="next"
              accessibilityLabel="Email address"
              accessibilityHint="Enter the email address associated with your account"
              editable={!isSubmitting}
            />

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: inputBg,
                  borderColor: inputBorder,
                  color: textColor,
                },
              ]}
              placeholder="Password"
              placeholderTextColor={secondaryText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              accessibilityLabel="Password"
              accessibilityHint="Enter your account password"
              editable={!isSubmitting}
            />

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
              onPress={handleSignIn}
              disabled={isSubmitting || isLoading}
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              accessibilityState={{ disabled: isSubmitting || isLoading }}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Sign In</Text>
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: inputBorder }]} />
              <Text style={[styles.dividerText, { color: secondaryText }]}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: inputBorder }]} />
            </View>

            <TouchableOpacity
              style={[
                styles.socialButton,
                {
                  backgroundColor: isDark ? COLORS.cardDark : COLORS.background,
                  borderColor: inputBorder,
                },
              ]}
              onPress={handleGoogleSignIn}
              disabled={isSubmitting || isLoading}
              accessibilityRole="button"
              accessibilityLabel="Continue with Google"
              activeOpacity={0.8}
            >
              <Text style={styles.googleIcon}>G</Text>
              <Text style={[styles.socialButtonText, { color: textColor }]}>
                Continue with Google
              </Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' ? (
              <TouchableOpacity
                style={[styles.socialButton, styles.appleButton]}
                onPress={handleAppleSignIn}
                disabled={isSubmitting || isLoading}
                accessibilityRole="button"
                accessibilityLabel="Continue with Apple"
                activeOpacity={0.8}
              >
                <Text style={styles.appleIcon}>{''}</Text>
                <Text style={[styles.socialButtonText, { color: '#FFFFFF' }]}>
                  Continue with Apple
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: secondaryText }]}>
              Don't have an account?{' '}
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/register')}
              accessibilityRole="link"
              accessibilityLabel="Sign up for a new account"
            >
              <Text style={[styles.footerLink, { color: COLORS.primary }]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {(isSubmitting || isLoading) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
            accessibilityLabel="Signing in"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  brandingContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
  },
  tagline: {
    fontSize: 15,
    marginTop: 8,
  },
  formContainer: {
    width: '100%',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  socialButton: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
    marginRight: 10,
  },
  appleButton: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  appleIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    marginRight: 10,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 15,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
