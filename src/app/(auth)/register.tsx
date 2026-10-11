import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { authApi } from '@/api/client';
import { useAuthStore } from '@/store/auth';
import { Card, Field, PrimaryButton, Screen } from '@/components/ui';
import { colors, space } from '@/constants/design';

export default function RegisterScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { setError(''); setLoading(true); try { const { token } = await authApi.register(email.trim(), password, name.trim()); await signIn(token); router.replace('/(tabs)'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create your account.'); } finally { setLoading(false); } };
  return <Screen><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}><View style={styles.content}><Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>Back to sign in</Text></Pressable><View style={styles.head}><Text style={styles.title}>Start with a thought.</Text><Text style={styles.copy}>VoiceVault turns your voice into something useful.</Text></View><Card style={styles.form}><Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" /><Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry autoComplete="new-password" />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<PrimaryButton loading={loading} onPress={submit}>Create account</PrimaryButton></Card></View></KeyboardAvoidingView></Screen>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, content: { flex: 1, justifyContent: 'center', padding: space.lg, maxWidth: 540, width: '100%', alignSelf: 'center', gap: space.xl }, back: { color: colors.primary, fontWeight: '600', fontSize: 15 }, head: { gap: space.sm }, title: { color: colors.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.7 }, copy: { color: colors.muted, fontSize: 16, lineHeight: 24 }, form: { gap: space.md }, error: { color: colors.danger, fontSize: 14 } });
