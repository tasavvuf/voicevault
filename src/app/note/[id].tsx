import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { AppIcon, Card, IconButton, Screen, SectionHeading, StatusChip } from '@/components/ui';
import { deleteNote, getNote, updateActionItems, updateNote } from '@/db/notesRepo';
import { notesApi, fromApiNote, subscribeApiTelemetry, getLastApiTelemetry, type ApiCallTelemetry } from '@/api/client';
import { retryNote, syncProcessingNotes } from '@/queue/uploadQueue';
import { useAuthStore } from '@/store/auth';
import { formatDuration } from '@/audio/recorder';
import { colors, radius, space } from '@/constants/design';
import type { Note } from '@/types/note';

export default function NoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [telemetry, setTelemetry] = useState<ApiCallTelemetry | null>(() => getLastApiTelemetry());
  const [elapsed, setElapsed] = useState(0);

  const player = useAudioPlayer(note?.localAudioUri ?? null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    let active = true;
    void getNote(id).then((local) => {
      if (active) {
        setNote(local);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const unsub = subscribeApiTelemetry(setTelemetry);
    return unsub;
  }, []);

  // Live timer while note is in queue/processing
  useEffect(() => {
    if (!note || (note.status !== 'processing' && note.status !== 'uploading' && note.status !== 'queued')) {
      return;
    }
    const timer = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [note?.status]);

  const pollNow = useCallback(async () => {
    if (!token) return;
    if (note?.serverId) {
      try {
        const remote = await notesApi.get(note.serverId, token);
        await updateNote(note.id, fromApiNote(remote));
        const local = await getNote(id);
        setNote(local);
      } catch {
        /* retry on next cycle */
      }
    } else {
      await syncProcessingNotes(token);
      const local = await getNote(id);
      setNote(local);
    }
  }, [id, note?.id, note?.serverId, token]);

  // Responsive 1.5s polling while note is in flight
  useEffect(() => {
    if (!note || (note.status !== 'processing' && note.status !== 'uploading' && note.status !== 'queued') || !token) return;
    const interval = setInterval(() => {
      void pollNow();
    }, 1500);
    return () => clearInterval(interval);
  }, [note?.status, pollNow, token]);

  const toggleAction = async (index: number) => {
    if (!note) return;
    const actionItems = note.actionItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, done: !item.done } : item
    );
    await updateActionItems(note.id, actionItems);
    setNote({ ...note, actionItems });
    if (note.serverId && token) {
      try {
        await notesApi.updateActionItems(note.serverId, actionItems, token);
      } catch {
        /* local state remains durable */
      }
    }
  };

  const handleRetry = async () => {
    if (!note) return;
    setRetrying(true);
    try {
      await retryNote(note, token);
      const updated = await getNote(id);
      setNote(updated);
    } finally {
      setRetrying(false);
    }
  };

  const remove = () =>
    Alert.alert('Delete voice note?', 'This removes the local note and its server copy.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (note?.serverId && token) {
            try {
              await notesApi.remove(note.serverId, token);
            } catch {
              /* local delete proceeds */
            }
          }
          await deleteNote(id);
          router.replace('/(tabs)');
        },
      },
    ]);

  if (loading)
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );

  if (!note)
    return (
      <Screen>
        <SafeAreaView style={styles.missing}>
          <Text style={styles.missingTitle}>This note is unavailable.</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </Pressable>
        </SafeAreaView>
      </Screen>
    );

  const playbackProgress =
    playerStatus.duration > 0 ? Math.min(playerStatus.currentTime / playerStatus.duration, 1) : 0;

  const isInFlight = note.status === 'processing' || note.status === 'uploading' || note.status === 'queued';
  const isUploadDone = note.status === 'processing' || note.status === 'ready' || note.status === 'failed';
  const isUploading = note.status === 'uploading';
  const isTranscribeDone = note.stage === 'summarizing' || note.stage === 'embedding' || note.stage === 'ready' || note.status === 'ready' || Boolean(note.transcript);
  const isTranscribing = (note.status === 'processing' && !isTranscribeDone) || note.stage === 'transcribing' || note.stage === 'uploaded';
  const isSummarizeDone = note.stage === 'embedding' || note.stage === 'ready' || note.status === 'ready' || Boolean(note.summary);
  const isSummarizing = note.status === 'processing' && note.stage === 'summarizing' && !isSummarizeDone;
  const isEmbeddingDone = note.stage === 'ready' || note.status === 'ready';
  const isEmbedding = note.status === 'processing' && note.stage === 'embedding' && !isEmbeddingDone;

  const formatElapsed = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const activeApiCallText = telemetry
    ? `${telemetry.method} ${telemetry.endpoint} (${telemetry.status === 'pending' ? 'calling...' : telemetry.statusCode ? `HTTP ${telemetry.statusCode}` : telemetry.status})`
    : note.serverId
    ? `GET /notes/${note.serverId} (Polling 1.5s)`
    : 'POST /notes (Pending upload)';

  return (
    <Screen>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <IconButton label="Go back" onPress={() => router.back()}>
            <AppIcon name="back" />
          </IconButton>
          <IconButton label="Delete note" onPress={remove}>
            <AppIcon name="trash" color={colors.danger} />
          </IconButton>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Note Metadata */}
          <View style={styles.noteHead}>
            <StatusChip status={note.status} />
            <Text style={styles.title}>{note.title ?? (isInFlight ? 'Processing with Gemini AI...' : 'Untitled voice note')}</Text>
            <Text style={styles.meta}>
              {new Date(note.createdAt).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}{' '}
              · {formatDuration(note.durationMs)}
            </Text>
          </View>

          {/* Audio Player Card */}
          <Card style={styles.playerCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={playerStatus.playing ? 'Pause audio' : 'Play audio'}
              onPress={() => (playerStatus.playing ? player.pause() : player.play())}
              style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
              <AppIcon name={playerStatus.playing ? 'pause' : 'play'} color="#FFFFFF" size={24} />
            </Pressable>
            <View style={styles.progressWrap}>
              <View style={styles.track}>
                <View style={[styles.progress, { width: `${playbackProgress * 100}%` }]} />
              </View>
              <View style={styles.playerTimes}>
                <Text style={styles.time}>{formatDuration(playerStatus.currentTime * 1000)}</Text>
                <Text style={styles.time}>{formatDuration(note.durationMs)}</Text>
              </View>
            </View>
          </Card>

          {/* Live AI Processing Stepper & Real-Time API Monitor */}
          {isInFlight && (
            <Card style={styles.pipelineCard}>
              <View style={styles.pipelineHead}>
                <View style={styles.pipelineTitleRow}>
                  <Ionicons name="sparkles" size={18} color="#7C3AED" />
                  <Text style={styles.pipelineTitle}>Live AI Processing Pipeline</Text>
                </View>
                <View style={styles.liveApiBadge}>
                  <View style={styles.liveGreenDot} />
                  <Text style={styles.liveApiBadgeText}>LIVE API</Text>
                </View>
              </View>

              <Text style={styles.pipelineMessage}>
                {note.stageMessage ?? 'Processing voice note through Google Gemini AI...'}
              </Text>

              {/* 4 Steps Stepper */}
              <View style={styles.stepperContainer}>
                {/* Step 1: Upload */}
                <View style={styles.stepItem}>
                  <View style={[styles.stepIconWrap, isUploadDone ? styles.stepDone : isUploading ? styles.stepActivePrimary : styles.stepPending]}>
                    <Ionicons name={isUploadDone ? 'checkmark' : 'cloud-upload'} size={14} color={isUploadDone ? '#FFFFFF' : isUploading ? colors.primary : '#9CA3AF'} />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepHeading, isUploadDone && styles.stepHeadingDone]}>
                      1. Audio Upload {isUploadDone ? '· Complete' : isUploading ? '· In Progress' : '· Pending'}
                    </Text>
                    <Text style={styles.stepSubtext}>POST /notes · {formatDuration(note.durationMs)} audio stream</Text>
                  </View>
                </View>

                {/* Step 2: Gemini 3.5 Transcribe */}
                <View style={styles.stepItem}>
                  <View style={[styles.stepIconWrap, isTranscribeDone ? styles.stepDone : isTranscribing ? styles.stepActiveBlue : styles.stepPending]}>
                    <Ionicons name={isTranscribeDone ? 'checkmark' : 'mic'} size={14} color={isTranscribeDone ? '#FFFFFF' : isTranscribing ? '#2563EB' : '#9CA3AF'} />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepHeading, isTranscribeDone && styles.stepHeadingDone]}>
                      2. Speech Transcription {isTranscribeDone ? '· Complete' : isTranscribing ? '· Transcribing...' : '· Pending'}
                    </Text>
                    <Text style={styles.stepSubtext}>Gemini 3.5 Transcribe · Speech to text</Text>
                  </View>
                </View>

                {/* Step 3: Gemini 3.8 Summarization & Tasks */}
                <View style={styles.stepItem}>
                  <View style={[styles.stepIconWrap, isSummarizeDone ? styles.stepDone : isSummarizing ? styles.stepActivePurple : styles.stepPending]}>
                    <Ionicons name={isSummarizeDone ? 'checkmark' : 'sparkles'} size={14} color={isSummarizeDone ? '#FFFFFF' : isSummarizing ? '#7C3AED' : '#9CA3AF'} />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepHeading, isSummarizeDone && styles.stepHeadingDone]}>
                      3. Insights & Action Items {isSummarizeDone ? '· Complete' : isSummarizing ? '· Summarizing...' : '· Pending'}
                    </Text>
                    <Text style={styles.stepSubtext}>Gemini 3.8 Flash · Title, summary, tags, action items</Text>
                  </View>
                </View>

                {/* Step 4: Gemini Embedding Indexing */}
                <View style={styles.stepItem}>
                  <View style={[styles.stepIconWrap, isEmbeddingDone ? styles.stepDone : isEmbedding ? styles.stepActiveGreen : styles.stepPending]}>
                    <Ionicons name={isEmbeddingDone ? 'checkmark' : 'layers'} size={14} color={isEmbeddingDone ? '#FFFFFF' : isEmbedding ? '#059669' : '#9CA3AF'} />
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[styles.stepHeading, isEmbeddingDone && styles.stepHeadingDone]}>
                      4. Semantic Vector Index {isEmbeddingDone ? '· Complete' : isEmbedding ? '· Indexing...' : '· Pending'}
                    </Text>
                    <Text style={styles.stepSubtext}>Gemini Embedding 2 · 768-dim similarity index</Text>
                  </View>
                </View>
              </View>

              {/* Real-Time API Monitor Box */}
              <View style={styles.telemetryBox}>
                <View style={styles.telemetryRow}>
                  <Text style={styles.telemetryLabel}>Cloud Host:</Text>
                  <Text style={styles.telemetryValue}>voicevault-lc8n.onrender.com</Text>
                </View>
                <View style={styles.telemetryRow}>
                  <Text style={styles.telemetryLabel}>Live API Call:</Text>
                  <Text style={styles.telemetryValue} numberOfLines={1}>{activeApiCallText}</Text>
                </View>
                <View style={styles.telemetryRow}>
                  <Text style={styles.telemetryLabel}>Elapsed Timer:</Text>
                  <Text style={styles.telemetryValueTime}>{formatElapsed(elapsed)}</Text>
                </View>
                {elapsed >= 18 && (
                  <View style={styles.coldStartBox}>
                    <Ionicons name="information-circle-outline" size={14} color="#B45309" />
                    <Text style={styles.coldStartNotice}>
                      Render free-tier instances sleep when inactive and may take 30-50s to cold-boot on initial call.
                    </Text>
                  </View>
                )}
              </View>

              {/* Refresh Status Action Button */}
              <Pressable
                onPress={() => void pollNow()}
                style={({ pressed }) => [styles.pollNowBtn, pressed && styles.pressed]}>
                <Ionicons name="sync-outline" size={15} color={colors.primary} />
                <Text style={styles.pollNowBtnText}>Poll Live Status Now</Text>
              </Pressable>
            </Card>
          )}

          {/* AI Failure & Error Display Card */}
          {note.status === 'failed' && (
            <Card style={styles.failure}>
              <View style={styles.failureHead}>
                <AppIcon name="alert" color="#B91C1C" size={20} />
                <Text style={styles.failureTitle}>AI Pipeline Issue</Text>
              </View>
              <Text style={styles.failureText}>
                {note.failureReason ??
                  'The Gemini AI pipeline failed to process this audio file.'}
              </Text>
              <Pressable
                disabled={retrying}
                accessibilityRole="button"
                onPress={() => void handleRetry()}
                style={({ pressed }) => [styles.retryDetailButton, pressed && styles.pressed]}>
                {retrying ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <View style={styles.retryButtonInner}>
                    <AppIcon name="refresh" color="#FFFFFF" size={16} />
                    <Text style={styles.retryDetailButtonText}>Retry AI Processing</Text>
                  </View>
                )}
              </Pressable>
            </Card>
          )}

          {/* AI Summary */}
          {note.summary && (
            <View style={styles.section}>
              <SectionHeading title="Summary" />
              <Card>
                <Text style={styles.body}>{note.summary}</Text>
              </Card>
            </View>
          )}

          {/* AI Tags */}
          {note.tags.length > 0 && (
            <View style={styles.section}>
              <SectionHeading title="Tags" />
              <View style={styles.tags}>
                {note.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* AI Action Items */}
          {note.actionItems.length > 0 && (
            <View style={styles.section}>
              <SectionHeading title="Action items" />
              <Card style={styles.actionCard}>
                {note.actionItems.map((item, index) => (
                  <Pressable
                    key={`${item.text}-${index}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: item.done }}
                    onPress={() => void toggleAction(index)}
                    style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
                    <View style={[styles.check, item.done && styles.checked]}>
                      {item.done && <AppIcon name="check" color="#FFFFFF" size={14} />}
                    </View>
                    <Text style={[styles.actionText, item.done && styles.done]}>{item.text}</Text>
                  </Pressable>
                ))}
              </Card>
            </View>
          )}

          {/* AI Transcript */}
          <View style={styles.section}>
            <SectionHeading title="Transcript" />
            {note.transcript ? (
              <Card>
                <Text style={styles.transcript}>{note.transcript}</Text>
              </Card>
            ) : (
              <Card>
                <Text style={styles.pending}>
                  {note.status === 'ready'
                    ? 'No transcript was returned for this note.'
                    : note.status === 'failed'
                    ? 'Transcript generation failed.'
                    : 'The transcript will appear here once AI processing is complete.'}
                </Text>
              </Card>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  missing: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: space.md },
  missingTitle: { color: colors.text, fontWeight: '700', fontSize: 18 },
  backLink: { color: colors.primary, fontWeight: '700' },
  header: {
    paddingHorizontal: space.lg,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scroll: { paddingHorizontal: space.lg, paddingBottom: 40, gap: space.xl },
  noteHead: { gap: 10 },
  title: { color: colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', letterSpacing: -0.6 },
  meta: { color: colors.muted, fontSize: 13 },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  playButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressWrap: { flex: 1, gap: 7 },
  track: { height: 5, borderRadius: radius.pill, backgroundColor: colors.border, overflow: 'hidden' },
  progress: { height: '100%', backgroundColor: colors.primary },
  playerTimes: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  section: { gap: space.md },
  body: { color: colors.text, fontSize: 16, lineHeight: 25 },
  transcript: { color: colors.text, fontSize: 15, lineHeight: 24 },
  pending: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  tagText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  actionCard: { paddingVertical: 6 },
  action: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  check: {
    height: 24,
    width: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.success, borderColor: colors.success },
  actionText: { color: colors.text, fontSize: 15, flex: 1, lineHeight: 21 },
  done: { textDecorationLine: 'line-through', color: colors.muted },

  failure: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    gap: 10,
    borderWidth: 1,
  },
  failureHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  failureTitle: { color: '#B91C1C', fontWeight: '800', fontSize: 15 },
  failureText: { color: '#B91C1C', lineHeight: 20, fontSize: 14 },
  retryDetailButton: {
    backgroundColor: '#DC2626',
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  retryButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retryDetailButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  pipelineCard: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    gap: 12,
  },
  pipelineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pipelineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pipelineTitle: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 15,
  },
  liveApiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 5,
  },
  liveGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveApiBadgeText: {
    color: '#047857',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pipelineMessage: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  stepperContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepDone: {
    backgroundColor: '#10B981',
  },
  stepActivePrimary: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  stepActiveBlue: {
    backgroundColor: '#DBEAFE',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  stepActivePurple: {
    backgroundColor: '#EDE9FE',
    borderWidth: 1.5,
    borderColor: '#7C3AED',
  },
  stepActiveGreen: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1.5,
    borderColor: '#059669',
  },
  stepPending: {
    backgroundColor: '#F3F4F6',
  },
  stepContent: {
    flex: 1,
  },
  stepHeading: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  stepHeadingDone: {
    color: '#059669',
  },
  stepSubtext: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 1,
  },
  telemetryBox: {
    backgroundColor: '#1E293B',
    borderRadius: radius.md,
    padding: 12,
    gap: 6,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
  },
  telemetryValue: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
  },
  telemetryValueTime: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.select({ ios: 'Courier', default: 'monospace' }),
  },
  coldStartBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#451A03',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  coldStartNotice: {
    color: '#FCD34D',
    fontSize: 10,
    flex: 1,
    lineHeight: 14,
  },
  pollNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignSelf: 'stretch',
  },
  pollNowBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  pressed: { opacity: 0.72 },
});
