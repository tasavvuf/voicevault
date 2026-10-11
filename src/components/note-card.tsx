import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, shadow, space } from '@/constants/design';
import { formatDuration } from '@/audio/recorder';
import { StatusChip } from '@/components/ui';
import type { Note } from '@/types/note';

export function NoteCard({
  note,
  onRetry,
}: {
  note: Note;
  onRetry?: (note: Note) => void;
}) {
  const isFailed = note.status === 'failed';
  const isProcessing = note.status === 'processing';
  const isUploading = note.status === 'uploading';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open note ${note.title ?? 'Untitled voice note'}`}
      onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
      style={({ pressed }) => [
        styles.card,
        isFailed && styles.cardFailed,
        pressed && styles.pressed,
      ]}>
      <View style={styles.topRow}>
        <StatusChip status={note.status} />
        <Text style={styles.date}>
          {new Date(note.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}{' '}
          · {formatDuration(note.durationMs)}
        </Text>
      </View>

      <Text numberOfLines={1} style={styles.title}>
        {note.title ?? (isFailed ? 'Processing issue' : 'Untitled voice note')}
      </Text>

      {isFailed ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text numberOfLines={2} style={styles.errorText}>
              {note.failureReason ?? 'AI processing failed. Tap to inspect or retry.'}
            </Text>
          </View>
          {onRetry && (
            <Pressable
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation();
                onRetry(note);
              }}
              style={({ pressed }) => [styles.retryBadge, pressed && styles.pressed]}>
              <Ionicons name="refresh" size={13} color="#DC2626" />
              <Text style={styles.retryBadgeText}>Retry AI</Text>
            </Pressable>
          )}
        </View>
      ) : isProcessing ? (
        <View style={styles.processingRow}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={styles.processingText}>Gemini AI is transcribing & analyzing...</Text>
        </View>
      ) : isUploading ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.uploadingText}>Uploading audio to server...</Text>
        </View>
      ) : (
        <Text numberOfLines={2} style={styles.summary}>
          {note.summary ?? 'Ready · Tap to view summary and action items.'}
        </Text>
      )}

      {!!note.tags.length && (
        <View style={styles.tagRow}>
          {note.tags.slice(0, 3).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    padding: space.lg,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadow,
  },
  cardFailed: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFBFB',
  },
  pressed: { opacity: 0.72 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  title: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  summary: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  errorContainer: {
    gap: 8,
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    flex: 1,
  },
  retryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  retryBadgeText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.lavenderSoft,
    padding: 10,
    borderRadius: radius.md,
  },
  processingText: {
    color: '#6D28D9',
    fontSize: 13,
    fontWeight: '600',
  },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primarySoft,
    padding: 10,
    borderRadius: radius.md,
  },
  uploadingText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  tagText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
});
