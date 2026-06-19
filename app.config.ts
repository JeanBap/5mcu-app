import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  name: "5MCU",
  slug: "fivemcu",
  owner: "yannipaps-organization",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: "fivemcu",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#6366F1",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "app.fivemcu.app",
    infoPlist: {
      NSContactsUsageDescription:
        "5MCU uses your contacts to help you find friends to schedule catch-up calls with.",
      NSUserNotificationsUsageDescription:
        "5MCU sends you reminders before your scheduled catch-up calls.",
      LSApplicationQueriesSchemes: [
        "whatsapp",
        "facetime",
        "facetime-audio",
      ],
    },
    entitlements: {
      "com.apple.developer.applesignin": ["Default"],
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["C56D.1"],
        },
        {
          NSPrivacyAccessedAPIType:
            "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],
    },
  },
  android: {
    kotlinVersion: "1.9.25",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#6366F1",
    },
    package: "app.fivemcu.app",
    permissions: [
      "android.permission.READ_CONTACTS",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.SCHEDULE_EXACT_ALARM",
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-router",
      {
        origin: "https://fivemcu.app",
      },
    ],
    [
      "expo-contacts",
      {
        contactsPermission:
          "5MCU uses your contacts to help you find friends to schedule catch-up calls with.",
      },
    ],
    [
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#6366F1",
        sounds: [],
        enableBackgroundRemoteNotifications: true,
      },
    ],
    "expo-apple-authentication",
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme:
          "com.googleusercontent.apps.635074351881-1r4lkhvqgl6ru8ksmo6lfb0ale2k2hte",
      },
    ],
    "expo-secure-store",
    "expo-font",
    [
      "expo-build-properties",
      {
        android: {
          kotlinVersion: "1.9.25",
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: "e02fd761-88fc-409e-8624-cb870b95da2b",
    },
    router: {
      origin: "https://fivemcu.app",
    },
  },
});
