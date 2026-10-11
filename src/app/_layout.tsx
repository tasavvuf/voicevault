import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { getDatabase } from '@/db/schema';
import { useAuthStore } from '@/store/auth';
import { colors } from '@/constants/design';

export default function RootLayout() {
  const [client] = useState(() => new QueryClient());
  const hydrate = useAuthStore((state) => state.hydrate);
  useEffect(() => {
    // Warm up Render backend so cold-start delay is eliminated during user recording
    fetch(`${process.env.EXPO_PUBLIC_API_URL ?? 'https://voicevault-lc8n.onrender.com'}/health`).catch(() => {});
    void Promise.all([hydrate(), getDatabase()]);
  }, [hydrate]);
  return <QueryClientProvider client={client}><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade' }} /></QueryClientProvider>;
}
