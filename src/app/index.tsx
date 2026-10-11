import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth';
import { colors } from '@/constants/design';

export default function Index() {
  const { token, ready } = useAuthStore();
  useEffect(() => { if (ready) router.replace(token ? '/(tabs)' : '/(auth)/login'); }, [ready, token]);
  return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
}
