/**
 * 5MCU App Configuration Constants
 */

export const COLORS = {
  primary: "#6366F1",
  primaryLight: "#818CF8",
  primaryDark: "#4F46E5",
  background: "#FFFFFF",
  backgroundDark: "#111827",
  card: "#F3F4F6",
  cardDark: "#1F2937",
  text: "#111827",
  textDark: "#F9FAFB",
  textSecondary: "#6B7280",
  textSecondaryDark: "#9CA3AF",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  border: "#E5E7EB",
  borderDark: "#374151",
} as const;

export const APP_CONFIG = {
  maxFreeFriends: 3,
  maxFreeSlots: 20,
  slotDurationMinutes: 5,
  callBufferMinutes: 1,
  appName: "5MCU",
  supportEmail: "support@fivemcu.app",
  privacyPolicyUrl: "https://fivemcu.app/privacy",
  termsUrl: "https://fivemcu.app/terms",
} as const;

/** Frequency stored as days between catch-ups */
export const FREQUENCY_OPTIONS: {
  label: string;
  shortLabel: string;
  value: number;
  description: string;
}[] = [
  {
    label: "Weekly",
    shortLabel: "Weekly",
    value: 7,
    description: "Every week",
  },
  {
    label: "Every 2 weeks",
    shortLabel: "2 wks",
    value: 14,
    description: "Twice a month",
  },
  {
    label: "Every 3 weeks",
    shortLabel: "3 wks",
    value: 21,
    description: "About 3 weeks apart",
  },
  {
    label: "Monthly",
    shortLabel: "Monthly",
    value: 30,
    description: "Once a month",
  },
  {
    label: "Every 2 months",
    shortLabel: "2 mo",
    value: 60,
    description: "Every couple of months",
  },
  {
    label: "Every 3 months",
    shortLabel: "3 mo",
    value: 90,
    description: "Quarterly",
  },
  {
    label: "Every 6 months",
    shortLabel: "6 mo",
    value: 180,
    description: "Twice a year",
  },
  {
    label: "Annually",
    shortLabel: "Yearly",
    value: 365,
    description: "Once a year",
  },
] as const;

/** Helper: convert frequency_days to a human-readable label */
export function frequencyLabel(days: number): string {
  const opt = FREQUENCY_OPTIONS.find((o) => o.value === days);
  return opt?.label ?? `Every ${days} days`;
}

export const VIDEO_APPS: {
  id: string;
  name: string;
  icon: string;
  scheme: string;
}[] = [
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: "whatsapp",
    scheme: "whatsapp://",
  },
  {
    id: "facetime",
    name: "FaceTime",
    icon: "facetime",
    scheme: "facetime://",
  },
  {
    id: "jitsi",
    name: "Jitsi Meet",
    icon: "jitsi",
    scheme: "org.jitsi.meet://",
  },
  {
    id: "zoom",
    name: "Zoom",
    icon: "zoom",
    scheme: "zoomus://",
  },
] as const;

export type ColorKey = keyof typeof COLORS;
export type VideoAppId = (typeof VIDEO_APPS)[number]["id"];
