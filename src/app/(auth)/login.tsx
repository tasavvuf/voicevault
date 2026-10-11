import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Card, Field, PrimaryButton, Screen } from '@/components/ui';
import { colors, space } from '@/constants/design';

export default function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { setError(''); setLoading(true); try { const { token } = await authApi.login(email.trim(), password); await signIn(token); router.replace('/(tabs)'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not sign in.'); } finally { setLoading(false); } };
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><View style={styles.content}><View style={styles.brand}><View style={styles.mark}><View style={styles.markDot} /></View><Text style={styles.eyebrow}>VOICEVAULT</Text><Text style={styles.title}>Your thoughts, organized.</Text><Text style={styles.copy}>Record once. Find every idea when you need it.</Text></View><Card style={styles.form}><Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry autoComplete="password" />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<PrimaryButton loading={loading} onPress={submit}>Continue</PrimaryButton><Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/register')} style={({ pressed }) => pressed && styles.pressed}><Text style={styles.link}>New to VoiceVault? Create an account</Text></Pressable></Card></View></KeyboardAvoidingView></Screen>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { flex: 1, justifyContent: 'center', padding: space.lg, maxWidth: 540, width: '100%', alignSelf: 'center', gap: space.xl }, brand: { gap: 10 }, mark: { width: 50, height: 50, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, markDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#FFFFFF' }, eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: -0.8 }, copy: { color: colors.muted, fontSize: 16, lineHeight: 24 }, form: { gap: space.md }, error: { color: colors.danger, fontSize: 14 }, link: { color: colors.primary, textAlign: 'center', fontWeight: '600', paddingVertical: 4 }, pressed: { opacity: 0.7 } });
