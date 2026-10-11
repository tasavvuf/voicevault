import { Tabs } from 'expo-router';
import { colors } from '@/constants/design';

export default function TabsLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 64, paddingTop: 6 }, tabBarLabelStyle: { fontWeight: '600', fontSize: 12 } }}>
    <Tabs.Screen name="index" options={{ title: 'Notes' }} />
    <Tabs.Screen name="search" options={{ title: 'Search' }} />
  </Tabs>;
}
