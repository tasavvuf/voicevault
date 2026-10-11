import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { AppIcon, Card, IconButton, Screen, SectionHeading, StatusChip } from '@/components/ui';
import { deleteNote, getNote, updateActionItems, updateNote } from '@/db/notesRepo';
import { notesApi, fromApiNote } from '@/api/client';
import { retryNote } from '@/queue/uploadQueue';
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
    if (!note?.serverId || note.status !== 'processing' || !token) return;
    const interval = setInterval(async () => {
      try {
        const remote = await notesApi.get(note.serverId!, token);
        await updateNote(note.id, fromApiNote(remote));
        const local = await getNote(id);
        setNote(local);
      } catch {
        /* retry on next poll */
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [id, note?.id, note?.serverId, note?.status, token]);

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
            <Text style={styles.title}>{note.title ?? 'Untitled voice note'}</Text>
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
  pressed: { opacity: 0.72 },
});
