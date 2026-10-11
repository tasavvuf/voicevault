import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type TextInputProps, TextInput, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, radius, shadow, space } from '@/constants/design';
import type { NoteStatus } from '@/types/note';

export function Screen({ children }: PropsWithChildren) { return <View style={styles.screen}>{children}</View>; }

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) { return <View style={[styles.card, style]}>{children}</View>; }

export function PrimaryButton({ children, loading, style, ...props }: PropsWithChildren<Omit<PressableProps, 'style'> & { loading?: boolean; style?: ViewStyle }>) {
  return <Pressable {...props} disabled={props.disabled || loading} accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, (pressed || props.disabled) && styles.pressed, style]}>
    {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryButtonText}>{children}</Text>}
  </Pressable>;
}

export function IconButton({ label, children, ...props }: PropsWithChildren<PressableProps & { label: string }>) {
  return <Pressable {...props} accessibilityLabel={label} accessibilityRole="button" hitSlop={8} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>{children}</Pressable>;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#94A3B8" style={styles.input} {...props} /></View>;
}

const statusStyle: Record<NoteStatus, { label: string; text: string; background: string }> = {
  queued: { label: 'Queued', text: '#92400E', background: colors.orangeSoft },
  uploading: { label: 'Uploading', text: '#1D4ED8', background: colors.primarySoft },
  processing: { label: 'Processing', text: '#6D28D9', background: colors.lavenderSoft },
  ready: { label: 'Ready', text: '#047857', background: colors.successSoft },
  failed: { label: 'Needs retry', text: '#B91C1C', background: colors.dangerSoft },
};

export function StatusChip({ status }: { status: NoteStatus }) {
  const item = statusStyle[status];
  return <View accessibilityLabel={`Status: ${item.label}`} style={[styles.chip, { backgroundColor: item.background }]}><Text style={[styles.chipText, { color: item.text }]}>{item.label}</Text></View>;
}

export function SectionHeading({ title, action }: { title: string; action?: ReactNode }) { return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action}</View>; }

const symbols = {
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  back: { ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  pause: { ios: 'pause.fill', android: 'pause', web: 'pause' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
} as const;

export function AppIcon({ name, color = colors.primary, size = 22 }: { name: keyof typeof symbols; color?: string; size?: number }) {
  return <SymbolView name={symbols[name] as never} tintColor={color} size={size} weight="semibold" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.border, ...shadow },
  primaryButton: { minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  primaryButtonText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  iconButton: { minWidth: 44, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  field: { gap: space.sm }, fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, color: colors.text, fontSize: 16, backgroundColor: colors.surface },
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 }, chipText: { fontSize: 12, fontWeight: '700' },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
});
