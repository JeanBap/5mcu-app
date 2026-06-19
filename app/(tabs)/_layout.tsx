import { Tabs } from 'expo-router';
import { useColorScheme, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/config';

type TabBarIconProps = {
  color: string;
  focused: boolean;
};

const TAB_CONFIG = [
  { name: 'index', title: 'Home', icon: '🏠', label: 'Home tab' },
  { name: 'schedule', title: 'Availability', icon: '📅', label: 'Availability tab' },
  { name: 'friends', title: 'Friends', icon: '👥', label: 'Friends tab' },
  { name: 'settings', title: 'Settings', icon: '⚙️', label: 'Settings tab' },
] as const;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: isDark
          ? COLORS.textSecondaryDark
          : COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: isDark ? COLORS.backgroundDark : COLORS.background,
          borderTopColor: isDark ? COLORS.borderDark : COLORS.border,
          height: 88,
          paddingBottom: 8,
        },
        headerStyle: {
          backgroundColor: isDark ? COLORS.backgroundDark : COLORS.background,
        },
        headerTintColor: isDark ? COLORS.textDark : COLORS.text,
        headerShadowVisible: false,
      }}
    >
      {TAB_CONFIG.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarAccessibilityLabel: tab.label,
            tabBarIcon: ({ color }: TabBarIconProps) => (
              <Text style={[styles.icon, { opacity: color === COLORS.primary ? 1 : 0.6 }]}>
                {tab.icon}
              </Text>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: {
    fontSize: 24,
    textAlign: 'center',
  },
});
