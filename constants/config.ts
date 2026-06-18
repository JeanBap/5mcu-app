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

export const FREQUENCY_OPTIONS: {
  label: string;
  value: number;
  description: string;
}[] = [
  {
    label: "Once a month",
    value: 1,
    description: "A quick catch-up once per month",
  },
  {
    label: "Twice a month",
    value: 2,
    description: "Stay closer with bi-weekly calls",
  },
  {
    label: "Weekly",
    value: 4,
    description: "Keep in regular touch every week",
  },
] as const;

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
