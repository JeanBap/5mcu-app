import * as Contacts from 'expo-contacts';
import { Platform } from 'react-native';

/**
 * Represents a phone contact with the fields relevant to the app.
 */
export interface PhoneContact {
  /** Device-specific contact identifier */
  id: string;
  /** Full display name */
  name: string;
  /** Primary phone number */
  phone: string;
  /** Primary email address, if available */
  email?: string;
  /** URI to the contact's photo, if available */
  imageUri?: string;
}

/**
 * Request permission to access the device's contacts.
 *
 * @returns true if permission was granted, false otherwise
 */
export async function requestContactsPermission(): Promise<boolean> {
  try {
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error(
      'Failed to request contacts permission:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Fetch all phone contacts that have at least one phone number.
 * Results are sorted alphabetically by name.
 *
 * @returns Array of PhoneContact objects, or empty array if permission is denied
 *          or an error occurs
 */
export async function getPhoneContacts(): Promise<PhoneContact[]> {
  try {
    const hasPermission = await requestContactsPermission();
    if (!hasPermission) {
      console.warn('Contacts permission not granted');
      return [];
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Emails,
        Contacts.Fields.Image,
      ],
    });

    if (!data || data.length === 0) {
      return [];
    }

    const phoneContacts: PhoneContact[] = data
      .filter(
        (contact) =>
          contact.phoneNumbers &&
          contact.phoneNumbers.length > 0 &&
          (contact.firstName || contact.lastName || contact.name)
      )
      .map((contact) => {
        const name =
          contact.name ||
          [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
          'Unknown';

        const primaryPhone = contact.phoneNumbers![0].number || '';
        const primaryEmail =
          contact.emails && contact.emails.length > 0
            ? contact.emails[0].email
            : undefined;
        const imageUri = contact.image?.uri || undefined;

        return {
          id: contact.id,
          name,
          phone: primaryPhone,
          email: primaryEmail || undefined,
          imageUri,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return phoneContacts;
  } catch (error) {
    console.error(
      'Failed to fetch phone contacts:',
      error instanceof Error ? error.message : error
    );
    return [];
  }
}

/**
 * Filter a list of contacts by a search query. Matches against the
 * contact name using case-insensitive substring matching.
 *
 * @param query    - Search string to match against contact names
 * @param contacts - The full list of contacts to search within
 * @returns Filtered array of matching contacts
 */
export function searchContacts(
  query: string,
  contacts: PhoneContact[]
): PhoneContact[] {
  if (!query || query.trim().length === 0) {
    return contacts;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return contacts.filter((contact) =>
    contact.name.toLowerCase().includes(normalizedQuery)
  );
}

/**
 * Clean a phone number string by stripping all non-digit characters
 * except a leading plus sign.
 *
 * @param phone - Raw phone number string (e.g. "+1 (555) 123-4567")
 * @returns Cleaned phone number (e.g. "+15551234567")
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';

  const hasPlus = phone.startsWith('+');
  const digitsOnly = phone.replace(/[^\d]/g, '');

  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}
