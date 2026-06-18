import { Linking, Platform } from 'react-native';
import { APP_CONFIG } from '../constants/config';

/**
 * Generate a deterministic Jitsi Meet room URL from a booking ID.
 * The room name is prefixed with the app name to avoid collisions.
 *
 * @param bookingId - The booking identifier used as the room name
 * @returns A full Jitsi Meet URL
 */
export function generateJitsiUrl(bookingId: string): string {
  return `https://meet.jit.si/5mcu-${bookingId}`;
}

/**
 * Build the platform-specific deep link URL for a video calling app.
 *
 * @param app   - Which video app to link to
 * @param phone - Phone number (required for whatsapp and facetime)
 * @param url   - Meeting URL (used for jitsi and zoom)
 * @returns The deep link URL string
 * @throws Error if facetime is requested on Android or required params are missing
 */
export function getDeepLinkUrl(
  app: 'whatsapp' | 'facetime' | 'jitsi' | 'zoom',
  phone?: string,
  url?: string
): string {
  switch (app) {
    case 'whatsapp': {
      if (!phone) {
        throw new Error('Phone number is required for WhatsApp calls');
      }
      const cleanPhone = phone.replace(/[^\d]/g, '');
      return `whatsapp://send?phone=${cleanPhone}`;
    }

    case 'facetime': {
      if (Platform.OS === 'android') {
        throw new Error('FaceTime is not available on Android devices');
      }
      if (!phone) {
        throw new Error('Phone number or email is required for FaceTime calls');
      }
      return `facetime://${phone}`;
    }

    case 'jitsi': {
      if (url) return url;
      // Generate a random room if no URL provided
      const roomId = Math.random().toString(36).substring(2, 10);
      return generateJitsiUrl(roomId);
    }

    case 'zoom': {
      if (url) {
        // If it looks like a conference number, build the deep link
        if (/^\d+$/.test(url)) {
          return `zoomus://zoom.us/join?confno=${url}`;
        }
        // If it's already a full URL, convert to deep link
        const confMatch = url.match(/\/j\/(\d+)/);
        if (confMatch) {
          return `zoomus://zoom.us/join?confno=${confMatch[1]}`;
        }
        // Fallback: use the URL as-is for the deep link
        return `zoomus://zoom.us/join?confno=${url}`;
      }
      throw new Error('Meeting URL or conference number is required for Zoom');
    }

    default: {
      const _exhaustive: never = app;
      throw new Error(`Unsupported video app: ${_exhaustive}`);
    }
  }
}

/**
 * Get the web fallback URL for a video calling app.
 * Used when the native app is not installed.
 */
function getFallbackWebUrl(
  app: 'whatsapp' | 'facetime' | 'jitsi' | 'zoom',
  phone?: string,
  url?: string
): string | null {
  switch (app) {
    case 'whatsapp': {
      if (!phone) return null;
      const cleanPhone = phone.replace(/[^\d]/g, '');
      return `https://wa.me/${cleanPhone}`;
    }

    case 'facetime':
      // No web fallback for FaceTime
      return null;

    case 'jitsi':
      // Jitsi URLs are already web-accessible
      return url || null;

    case 'zoom': {
      if (!url) return null;
      if (/^\d+$/.test(url)) {
        return `https://zoom.us/j/${url}`;
      }
      // If it's already an HTTPS URL, return as-is
      if (url.startsWith('https://')) return url;
      const confMatch = url.match(/\/j\/(\d+)/);
      if (confMatch) {
        return `https://zoom.us/j/${confMatch[1]}`;
      }
      return `https://zoom.us/j/${url}`;
    }

    default:
      return null;
  }
}

/**
 * Open a video call in the specified app. Attempts the native deep link first,
 * then falls back to the web version if the app is not installed.
 *
 * @param app   - Which video app to open
 * @param phone - Phone number (for whatsapp/facetime)
 * @param url   - Meeting URL (for jitsi/zoom)
 * @returns true if the call was successfully opened
 * @throws Error if the call cannot be opened by any method
 */
export async function openVideoCall(
  app: 'whatsapp' | 'facetime' | 'jitsi' | 'zoom',
  phone?: string,
  url?: string
): Promise<boolean> {
  try {
    const deepLinkUrl = getDeepLinkUrl(app, phone, url);

    // Try the native deep link first
    const canOpen = await Linking.canOpenURL(deepLinkUrl);
    if (canOpen) {
      await Linking.openURL(deepLinkUrl);
      return true;
    }

    // Try the web fallback
    const fallbackUrl = getFallbackWebUrl(app, phone, url);
    if (fallbackUrl) {
      const canOpenFallback = await Linking.canOpenURL(fallbackUrl);
      if (canOpenFallback) {
        await Linking.openURL(fallbackUrl);
        return true;
      }

      // Last resort: try opening the fallback URL directly
      // (some platforms report canOpenURL=false for https but can still open them)
      try {
        await Linking.openURL(fallbackUrl);
        return true;
      } catch {
        // Fall through to error
      }
    }

    const appNames: Record<string, string> = {
      whatsapp: 'WhatsApp',
      facetime: 'FaceTime',
      jitsi: 'Jitsi Meet',
      zoom: 'Zoom',
    };

    throw new Error(
      `Unable to open ${appNames[app]}. Please make sure the app is installed on your device.`
    );
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unable to open')) {
      throw error;
    }
    throw new Error(
      `Failed to open video call: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get the call URL for a booking. For Jitsi calls, generates a deterministic
 * URL from the booking ID. For other apps, returns the appropriate deep link.
 *
 * @param bookingId - The booking identifier
 * @param app       - Which video app to use
 * @param phone     - Phone number (for whatsapp/facetime)
 * @returns The URL to use for the call
 */
export function getCallUrl(
  bookingId: string,
  app: 'whatsapp' | 'facetime' | 'jitsi' | 'zoom',
  phone?: string
): string {
  if (app === 'jitsi') {
    return generateJitsiUrl(bookingId);
  }

  return getDeepLinkUrl(app, phone);
}
