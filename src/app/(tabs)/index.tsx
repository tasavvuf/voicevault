import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { listNotes } from '@/db/notesRepo';
import { processUploadQueue, retryNote, syncProcessingNotes } from '@/queue/uploadQueue';
import { useAuthStore } from '@/store/auth';
import { AppIcon, Card, Screen } from '@/components/ui';
import { NoteCard } from '@/components/note-card';
import { colors, radius, space } from '@/constants/design';
import type { Note } from '@/types/note';

export default function NotesScreen() {
  const token = useAuthStore((state) => state.token);
  const [retrying, setRetrying] = useState(false);

  const {
    data = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['notes'],
    queryFn: listNotes,
  });

  const processingNotes = data.filter(
    (n) => n.status === 'processing' || n.status === 'uploading' || n.status === 'queued'
  );
  const failedNotes = data.filter((n) => n.status === 'failed');

  const sync = useCallback(async () => {
    await processUploadQueue(token);
    await syncProcessingNotes(token);
    await refetch();
  }, [refetch, token]);

  // Network listener
  useEffect(() => {
    void sync();
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void sync();
    });
    return unsubscribe;
  }, [sync]);

  // Real-time polling queue when notes are in-flight
  useEffect(() => {
    if (processingNotes.length === 0) return;

    const interval = setInterval(async () => {
      await processUploadQueue(token);
      const changed = await syncProcessingNotes(token);
      if (changed) {
        await refetch();
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [processingNotes.length, refetch, token]);

  const handleRetrySingle = async (note: Note) => {
    await retryNote(note, token);
    await refetch();
  };

  const handleRetryAllFailed = async () => {
    setRetrying(true);
    try {
      for (const note of failedNotes) {
        await retryNote(note, token);
      }
      await refetch();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Screen>
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>VOICEVAULT</Text>
            <Text style={styles.title}>Your notes</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search notes"
            onPress={() => router.push('/(tabs)/search')}
            style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}>
            <AppIcon name="search" size={20} />
          </Pressable>
        </View>

        {/* Real-time In-Flight Queue Status Banner */}
        {processingNotes.length > 0 && (
          <View style={styles.queueBanner}>
            <ActivityIndicator size="small" color="#7C3AED" />
            <Text style={styles.queueBannerText}>
              {processingNotes.length} note
              {processingNotes.length > 1 ? 's' : ''} in AI processing queue...
            </Text>
          </View>
        )}

        {/* Real-time AI Pipeline Failure Banner */}
        {failedNotes.length > 0 && (
          <View style={styles.errorBanner}>
            <View style={styles.errorBannerLeft}>
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text style={styles.errorBannerText}>
                {failedNotes.length} note
                {failedNotes.length > 1 ? 's' : ''} encountered AI issues
              </Text>
            </View>
            <Pressable
              disabled={retrying}
              accessibilityRole="button"
              onPress={() => void handleRetryAllFailed()}
              style={({ pressed }) => [styles.retryAllButton, pressed && styles.pressed]}>
              {retrying ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.retryAllText}>Retry All</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Notes List */}
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={data}
            keyExtractor={(note) => note.id}
            renderItem={({ item }) => (
              <NoteCard note={item} onRetry={handleRetrySingle} />
            )}
            contentContainerStyle={data.length ? styles.list : styles.emptyList}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={sync}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <Card style={styles.empty}>
                <View style={styles.emptyMark}>
                  <Ionicons name="mic-outline" size={26} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No voice notes yet</Text>
                <Text style={styles.emptyCopy}>
                  Capture a thought and it will be safely saved locally before AI processes it.
                </Text>
              </Card>
            }
          />
        )}
      </SafeAreaView>

      {/* Floating Action Record Button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Record a new voice note"
        onPress={() => router.push('/record')}
        style={({ pressed }) => [styles.recordButton, pressed && styles.pressed]}>
        <View style={styles.recordInner}>
          <Ionicons name="mic" size={16} color="#FFFFFF" />
        </View>
        <Text style={styles.recordLabel}>Record</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: { opacity: 0.72 },

  // Realtime Queue Banners
  queueBanner: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.lavenderSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  queueBannerText: {
    color: '#6D28D9',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBanner: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  errorBannerText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '600',
  },
  retryAllButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  retryAllText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: 120 },
  emptyList: { flexGrow: 1, padding: space.lg, justifyContent: 'center', paddingBottom: 120 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: space.xl },
  emptyMark: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  emptyCopy: { color: colors.muted, textAlign: 'center', lineHeight: 21, maxWidth: 260 },
  recordButton: {
    position: 'absolute',
    right: space.lg,
    bottom: 20,
    height: 56,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  recordInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordLabel: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
