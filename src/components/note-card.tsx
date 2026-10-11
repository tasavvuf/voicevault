import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, shadow, space } from '@/constants/design';
import { formatDuration } from '@/audio/recorder';
import { StatusChip } from '@/components/ui';
import type { Note } from '@/types/note';

export function NoteCard({ note }: { note: Note }) {
  const subtitle = note.summary ?? (note.status === 'failed' ? note.failureReason ?? 'Upload failed. Tap to retry.' : note.status === 'ready' ? 'No summary was returned.' : 'Your note will appear here when it is ready.');
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open note ${note.title ?? 'Untitled voice note'}`} onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.topRow}><StatusChip status={note.status} /><Text style={styles.date}>{new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {formatDuration(note.durationMs)}</Text></View>
    <Text numberOfLines={1} style={styles.title}>{note.title ?? 'Untitled voice note'}</Text>
    <Text numberOfLines={2} style={styles.summary}>{subtitle}</Text>
    {!!note.tags.length && <View style={styles.tagRow}>{note.tags.slice(0, 3).map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, padding: space.lg, gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, ...shadow }, pressed: { opacity: 0.72 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }, date: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  title: { color: colors.text, fontSize: 17, fontWeight: '700' }, summary: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }, tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.primarySoft }, tagText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
});
