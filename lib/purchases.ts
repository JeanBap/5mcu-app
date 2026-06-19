import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  PurchasesError,
} from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';

/** The RevenueCat entitlement identifier that gates premium features. */
const ENTITLEMENT_ID = 'premium';

/** RevenueCat API keys loaded from environment variables. */
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY || '';

/**
 * Sync the premium status to the user's Supabase profile.
 * Fails silently so purchase flows are not blocked by network issues.
 */
async function syncPremiumToSupabase(isPremium: boolean): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('fmcu_profiles')
      .update({ is_premium: isPremium })
      .eq('id', user.id);

    if (error) {
      console.error('Failed to sync premium status to Supabase:', error.message);
    }
  } catch (error) {
    console.error(
      'Unexpected error syncing premium status:',
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Check whether a CustomerInfo object has an active premium entitlement.
 */
function hasPremiumEntitlement(customerInfo: CustomerInfo): boolean {
  return (
    typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined'
  );
}

/**
 * Initialize the RevenueCat SDK with the correct platform API key
 * and associate it with the current user.
 *
 * Call this once during app startup after the user is authenticated.
 *
 * @param userId - The authenticated user's ID (typically from Supabase auth)
 */
export async function initPurchases(userId: string): Promise<void> {
  try {
    const apiKey =
      Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

    if (!apiKey) {
      console.warn(
        `RevenueCat API key not configured for ${Platform.OS}. ` +
        `Set EXPO_PUBLIC_REVENUECAT_${Platform.OS === 'ios' ? 'IOS' : 'ANDROID'}_KEY in your environment.`
      );
      return;
    }

    Purchases.configure({ apiKey });
    await Purchases.logIn(userId);
  } catch (error) {
    console.error(
      'Failed to initialize RevenueCat:',
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Check whether the current user has an active premium subscription.
 * Also syncs the status to the Supabase profiles table.
 *
 * @returns true if the user has an active premium entitlement
 */
export async function checkPremiumStatus(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const isPremium = hasPremiumEntitlement(customerInfo);

    await syncPremiumToSupabase(isPremium);

    return isPremium;
  } catch (error) {
    console.error(
      'Failed to check premium status:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Purchase the premium subscription. Presents the native purchase flow
 * to the user and verifies the entitlement afterwards.
 *
 * @returns true if the purchase was successful, false if the user cancelled
 *          or an error occurred
 */
export async function purchasePremium(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();

    if (
      !offerings.current ||
      !offerings.current.availablePackages ||
      offerings.current.availablePackages.length === 0
    ) {
      console.error('No offerings available for purchase');
      return false;
    }

    const defaultPackage = offerings.current.availablePackages[0];
    const { customerInfo } = await Purchases.purchasePackage(defaultPackage);

    const isPremium = hasPremiumEntitlement(customerInfo);
    await syncPremiumToSupabase(isPremium);

    return isPremium;
  } catch (error) {
    // RevenueCat throws a specific error when the user cancels
    if (error instanceof Error) {
      const purchaseError = error as PurchasesError;
      if (purchaseError.userCancelled) {
        return false;
      }
    }

    console.error(
      'Failed to purchase premium:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Restore previous purchases (e.g. after reinstalling or switching devices).
 * Checks for an active premium entitlement and syncs to Supabase.
 *
 * @returns true if premium was restored successfully
 */
export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const isPremium = hasPremiumEntitlement(customerInfo);

    await syncPremiumToSupabase(isPremium);

    return isPremium;
  } catch (error) {
    console.error(
      'Failed to restore purchases:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Fetch the current purchase offerings from RevenueCat for display
 * in the paywall UI.
 *
 * @returns The offerings object, or null if unavailable
 */
export async function getPurchaseOfferings(): Promise<PurchasesOfferings | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings;
  } catch (error) {
    console.error(
      'Failed to get purchase offerings:',
      error instanceof Error ? error.message : error
    );
    return null;
  }
}
