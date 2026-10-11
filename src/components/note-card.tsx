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
  const isQueued = note.status === 'queued';

  const getStageInfo = () => {
    switch (note.stage) {
      case 'transcribing':
        return {
          icon: 'mic' as const,
          color: '#2563EB',
          bg: '#EFF6FF',
          badge: 'STAGE 2/4 · SPEECH TRANSCRIPTION',
          title: 'Gemini 3.5 Transcribe',
          desc: note.stageMessage ?? 'Transcribing audio waveform to text...',
        };
      case 'summarizing':
        return {
          icon: 'sparkles' as const,
          color: '#7C3AED',
          bg: '#F5F3FF',
          badge: 'STAGE 3/4 · AI INTELLIGENCE',
          title: 'Gemini 3.8 Flash',
          desc: note.stageMessage ?? 'Extracting title, summary & action items...',
        };
      case 'embedding':
        return {
          icon: 'layers' as const,
          color: '#059669',
          bg: '#ECFDF5',
          badge: 'STAGE 4/4 · VECTOR EMBEDDINGS',
          title: 'Gemini Embedding 2',
          desc: note.stageMessage ?? 'Generating 768-dim semantic search vectors...',
        };
      default:
        return {
          icon: 'cloud-done' as const,
          color: '#D97706',
          bg: '#FFFBEB',
          badge: 'STAGE 1/4 · CLOUD INGESTION',
          title: 'Audio Uploaded',
          desc: note.stageMessage ?? 'Queued in Gemini processing pipeline...',
        };
    }
  };

  const stageInfo = getStageInfo();

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
        {note.title ?? (isFailed ? 'Processing issue' : isQueued ? 'Audio note queued' : isUploading ? 'Uploading audio note...' : isProcessing ? 'AI processing in progress' : 'Untitled voice note')}
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
        <View style={[styles.stageBox, { backgroundColor: stageInfo.bg, borderColor: stageInfo.color + '33' }]}>
          <View style={styles.stageHeader}>
            <View style={styles.stageTitleRow}>
              <Ionicons name={stageInfo.icon} size={15} color={stageInfo.color} />
              <Text style={[styles.stageBadgeText, { color: stageInfo.color }]}>
                {stageInfo.badge}
              </Text>
            </View>
            <ActivityIndicator size="small" color={stageInfo.color} />
          </View>
          <Text style={[styles.stageHeading, { color: stageInfo.color }]}>{stageInfo.title}</Text>
          <Text numberOfLines={2} style={styles.stageDescription}>{stageInfo.desc}</Text>
          <View style={styles.liveCallPill}>
            <View style={[styles.pulseDot, { backgroundColor: stageInfo.color }]} />
            <Text style={styles.liveCallText}>Live Polling · GET /notes/:id</Text>
          </View>
        </View>
      ) : isUploading ? (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.uploadingText}>Uploading audio to server (POST /notes)...</Text>
            <Text style={styles.uploadingSubtext}>
              {note.stageMessage ?? 'Connecting to Render cloud backend...'}
            </Text>
          </View>
        </View>
      ) : isQueued ? (
        <View style={styles.queuedRow}>
          <Ionicons name="cloud-upload-outline" size={16} color="#6B7280" />
          <Text style={styles.queuedText}>Waiting in background upload queue...</Text>
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
    gap: 10,
    backgroundColor: colors.primarySoft,
    padding: 12,
    borderRadius: radius.md,
  },
  uploadingText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  uploadingSubtext: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  queuedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: radius.md,
  },
  queuedText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '500',
  },
  stageBox: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 5,
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  stageHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  stageDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  liveCallPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveCallText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
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
