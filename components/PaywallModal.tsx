import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';

import { COLORS } from '@/constants/config';
import {
  getPurchaseOfferings,
  purchasePremium,
  restorePurchases,
} from '@/lib/purchases';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  onPurchaseSuccess: () => void;
}

interface Feature {
  icon: string;
  title: string;
  description: string;
}

type ModalState = 'idle' | 'loading_offerings' | 'purchasing' | 'restoring' | 'error';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const FEATURES: Feature[] = [
  {
    icon: '✅',
    title: 'Unlimited friends',
    description: 'Free plan limited to 3 friends',
  },
  {
    icon: '✅',
    title: 'Unlimited time slots',
    description: 'Free plan limited to 20 slots',
  },
  {
    icon: '✅',
    title: 'Priority support',
    description: 'Get help when you need it',
  },
  {
    icon: '✅',
    title: 'Early access to new features',
    description: 'Be first to try what’s next',
  },
];

const FALLBACK_PRICE = '$4.99/month';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const PaywallModal: React.FC<PaywallModalProps> = React.memo(
  ({ visible, onClose, onPurchaseSuccess }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    const [state, setState] = useState<ModalState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [priceLabel, setPriceLabel] = useState<string>(FALLBACK_PRICE);

    /* ---------- animation ---------- */

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(60)).current;

    useEffect(() => {
      if (visible) {
        fadeAnim.setValue(0);
        slideAnim.setValue(60);
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [visible, fadeAnim, slideAnim]);

    /* ---------- fetch offerings ---------- */

    useEffect(() => {
      if (!visible) {
        setState('idle');
        setErrorMessage(null);
        return;
      }

      let cancelled = false;

      const loadOfferings = async () => {
        setState('loading_offerings');
        try {
          const offerings = await getPurchaseOfferings();
          if (cancelled) return;
          if (offerings?.current?.monthly?.product?.priceString) {
            setPriceLabel(
              `${offerings.current.monthly.product.priceString}/month`,
            );
          }
          setState('idle');
        } catch {
          if (cancelled) return;
          setState('idle');
          // Silently use fallback price
        }
      };

      loadOfferings();

      return () => {
        cancelled = true;
      };
    }, [visible]);

    /* ---------- actions ---------- */

    const handlePurchase = useCallback(async () => {
      setState('purchasing');
      setErrorMessage(null);
      try {
        const success = await purchasePremium();
        if (success) {
          onPurchaseSuccess();
        } else {
          setState('idle');
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Purchase failed. Please try again.';
        setErrorMessage(message);
        setState('error');
      }
    }, [onPurchaseSuccess]);

    const handleRestore = useCallback(async () => {
      setState('restoring');
      setErrorMessage(null);
      try {
        const restored = await restorePurchases();
        if (restored) {
          onPurchaseSuccess();
        } else {
          setErrorMessage('No previous purchases found.');
          setState('error');
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Restore failed. Please try again.';
        setErrorMessage(message);
        setState('error');
      }
    }, [onPurchaseSuccess]);

    const handleClose = useCallback(() => {
      if (state === 'purchasing' || state === 'restoring') return;
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 60,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onClose();
      });
    }, [state, fadeAnim, slideAnim, onClose]);

    const dismissError = useCallback(() => {
      setErrorMessage(null);
      setState('idle');
    }, []);

    /* ---------- colors ---------- */

    const cardBg = isDark ? COLORS.cardDark : COLORS.background;
    const textColor = isDark ? COLORS.textDark : COLORS.text;
    const secondaryText = isDark ? COLORS.textSecondaryDark : COLORS.textSecondary;
    const borderColor = isDark ? COLORS.borderDark : COLORS.border;

    const isProcessing = state === 'purchasing' || state === 'restoring' || state === 'loading_offerings';

    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.backdrop,
              { opacity: fadeAnim },
            ]}
          >
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={handleClose}
              activeOpacity={1}
              accessibilityRole="button"
              accessibilityLabel="Close upgrade modal"
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor,
                shadowColor: '#000000',
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Close button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={isProcessing}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text style={[styles.closeButtonText, { color: secondaryText }]}>
                {'✕'}
              </Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.crownIcon}>{'⭐'}</Text>
              <Text style={[styles.title, { color: textColor }]}>
                Upgrade to Premium
              </Text>
              <Text style={[styles.subtitle, { color: secondaryText }]}>
                Get the most out of 5MCU
              </Text>
            </View>

            {/* Features */}
            <View style={styles.features}>
              {FEATURES.map((feature) => (
                <View key={feature.title} style={styles.featureRow}>
                  <Text style={styles.featureIcon}>{feature.icon}</Text>
                  <View style={styles.featureContent}>
                    <Text style={[styles.featureTitle, { color: textColor }]}>
                      {feature.title}
                    </Text>
                    <Text style={[styles.featureDescription, { color: secondaryText }]}>
                      {feature.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Price */}
            <View style={[styles.priceContainer, { borderColor }]}>
              <Text style={[styles.priceLabel, { color: textColor }]}>
                {priceLabel}
              </Text>
            </View>

            {/* Error state */}
            {errorMessage && (
              <TouchableOpacity
                style={styles.errorContainer}
                onPress={dismissError}
                accessibilityRole="alert"
              >
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Text style={styles.errorDismiss}>Tap to dismiss</Text>
              </TouchableOpacity>
            )}

            {/* Buttons */}
            <View style={styles.buttons}>
              <TouchableOpacity
                style={[
                  styles.upgradeButton,
                  {
                    backgroundColor: isProcessing
                      ? `${COLORS.primary}80`
                      : COLORS.primary,
                  },
                ]}
                onPress={handlePurchase}
                disabled={isProcessing}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Upgrade to premium for ${priceLabel}`}
                accessibilityState={{ disabled: isProcessing }}
              >
                {state === 'purchasing' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.restoreButton}
                onPress={handleRestore}
                disabled={isProcessing}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Restore previous purchases"
                accessibilityState={{ disabled: isProcessing }}
              >
                {state === 'restoring' ? (
                  <ActivityIndicator color={COLORS.primary} size="small" />
                ) : (
                  <Text
                    style={[
                      styles.restoreButtonText,
                      {
                        color: isProcessing ? secondaryText : COLORS.primary,
                      },
                    ]}
                  >
                    Restore Purchases
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  },
);

PaywallModal.displayName = 'PaywallModal';

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  crownIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
  features: {
    gap: 16,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 1,
  },
  featureDescription: {
    fontSize: 13,
  },
  priceContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  priceLabel: {
    fontSize: 22,
    fontWeight: '800',
  },
  errorContainer: {
    backgroundColor: `${COLORS.error}15`,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  errorDismiss: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
    opacity: 0.7,
  },
  buttons: {
    gap: 12,
  },
  upgradeButton: {
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  restoreButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PaywallModal;
