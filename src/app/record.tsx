import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import {
  createClientId,
  formatDuration,
  MAX_AUDIO_BYTES,
  MAX_RECORDING_MS,
} from '@/audio/recorder';
import { createLocalNote } from '@/db/notesRepo';
import { useAuthStore } from '@/store/auth';
import { processUploadQueue } from '@/queue/uploadQueue';
import { colors, radius, space } from '@/constants/design';

// 13 base heights from the original design
const BASE_FACTORS = [0.35, 0.7, 0.48, 0.95, 0.62, 0.4, 0.82, 0.55, 0.9, 0.5, 0.72, 0.38, 0.8];
const MIN_HEIGHT = 16;
const MAX_HEIGHT = 74;

export default function RecordScreen() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 150);
  const token = useAuthStore((state) => state.token);
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const duration = recorderState.durationMillis ?? 0;

  // Single animated phase driving smooth, organic undulating wave motion
  const [animPhase] = useState(() => new Animated.Value(0));

  const isRecording = Boolean(recorderState.isRecording);
  const isActive = isRecording && !paused;

  // Continuous smooth loop
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isActive) {
      loop = Animated.loop(
        Animated.timing(animPhase, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: false,
        })
      );
      loop.start();
    } else {
      Animated.timing(animPhase, {
        toValue: 0,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start();
    }
    return () => {
      loop?.stop();
    };
  }, [isActive, animPhase]);

  const start = async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Microphone access needed',
        'Allow microphone access in Settings to record a voice note.'
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPaused(false);
  };

  const stop = useCallback(async () => {
    if (!isRecording && !paused) return;
    setSaving(true);
    try {
      await recorder.stop();
      const source = recorder.uri;
      if (!source) throw new Error('The recording could not be saved.');
      const id = createClientId();
      const destination = `${FileSystem.documentDirectory}voicevault-${id}.m4a`;
      await FileSystem.copyAsync({ from: source, to: destination });
      const info = await FileSystem.getInfoAsync(destination);
      if (!info.exists || ('size' in info && (info.size ?? 0) > MAX_AUDIO_BYTES)) {
        await FileSystem.deleteAsync(destination, { idempotent: true });
        throw new Error('Keep recordings under 10 MB.');
      }
      await createLocalNote({
        id,
        localAudioUri: destination,
        durationMs: duration,
        createdAt: Date.now(),
      });
      await processUploadQueue(token);
      router.replace('/(tabs)');
    } catch (cause) {
      Alert.alert(
        'Could not save recording',
        cause instanceof Error ? cause.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }, [duration, isRecording, paused, recorder, token]);

  useEffect(() => {
    if (!isRecording || duration < MAX_RECORDING_MS) return;
    const timeout = setTimeout(() => void stop(), 0);
    return () => clearTimeout(timeout);
  }, [duration, isRecording, stop]);

  const cancel = async () => {
    if (isRecording || paused) await recorder.stop();
    router.back();
  };

  return (
    <View style={styles.page}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Clean Original Header */}
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={cancel} hitSlop={8}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New voice note</Text>
          <View style={styles.headerSpace} />
        </View>

        {/* Content with Smooth Minimal Waveform */}
        <View style={styles.content}>
          <Text style={styles.state}>
            {isRecording
              ? 'Recording'
              : paused
              ? 'Paused'
              : saving
              ? 'Saving'
              : 'Ready when you are'}
          </Text>

          <Text
            accessibilityLabel={`Duration ${formatDuration(duration)}`}
            style={styles.timer}>
            {formatDuration(duration)}
          </Text>

          {/* Smooth, Rounded, Bigger Voice Indicator Bars */}
          <View style={styles.wave} accessibilityElementsHidden>
            {BASE_FACTORS.map((baseFactor, index) => {
              // Interpolate each bar with an offset wave phase so the motion is smooth and fluid
              const phaseOffset = index / BASE_FACTORS.length;
              const barHeight = animPhase.interpolate({
                inputRange: [0, 0.25, 0.5, 0.75, 1],
                outputRange: [
                  MIN_HEIGHT + baseFactor * (MAX_HEIGHT - MIN_HEIGHT) * 0.45,
                  MIN_HEIGHT +
                    Math.sin((phaseOffset + 0.25) * Math.PI * 2) *
                      0.5 *
                      (MAX_HEIGHT - MIN_HEIGHT) +
                    (MAX_HEIGHT - MIN_HEIGHT) * 0.4,
                  MIN_HEIGHT +
                    Math.sin((phaseOffset + 0.5) * Math.PI * 2) *
                      0.5 *
                      (MAX_HEIGHT - MIN_HEIGHT) +
                    (MAX_HEIGHT - MIN_HEIGHT) * 0.4,
                  MIN_HEIGHT +
                    Math.sin((phaseOffset + 0.75) * Math.PI * 2) *
                      0.5 *
                      (MAX_HEIGHT - MIN_HEIGHT) +
                    (MAX_HEIGHT - MIN_HEIGHT) * 0.4,
                  MIN_HEIGHT + baseFactor * (MAX_HEIGHT - MIN_HEIGHT) * 0.45,
                ],
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.bar,
                    {
                      height: isActive
                        ? barHeight
                        : MIN_HEIGHT + baseFactor * (MAX_HEIGHT - MIN_HEIGHT) * 0.35,
                      backgroundColor: isActive
                        ? colors.primary
                        : paused
                        ? colors.orange
                        : colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>

          <Text style={styles.limit}>Up to 3 minutes · 10 MB maximum</Text>
        </View>

        {/* Clean Original Control Buttons (No unneeded ripples) */}
        <View style={styles.controls}>
          {!isRecording && !paused ? (
            <Pressable
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Start recording"
              onPress={start}
              style={({ pressed }) => [styles.recordControl, pressed && styles.pressed]}>
              <View style={styles.startDot} />
            </Pressable>
          ) : (
            <View style={styles.activeRow}>
              <Pressable
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={paused ? 'Resume recording' : 'Pause recording'}
                onPress={() => {
                  if (paused) {
                    recorder.record();
                    setPaused(false);
                  } else {
                    recorder.pause();
                    setPaused(true);
                  }
                }}
                style={({ pressed }) => [styles.secondaryControl, pressed && styles.pressed]}>
                <Text style={styles.controlText}>{paused ? 'Resume' : 'Pause'}</Text>
              </Pressable>

              <Pressable
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Stop and save recording"
                onPress={stop}
                style={({ pressed }) => [styles.stopControl, pressed && styles.pressed]}>
                <View style={styles.stopSquare} />
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  safe: { flex: 1, justifyContent: 'space-between' },
  header: {
    paddingHorizontal: space.lg,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancel: { color: colors.primary, fontWeight: '600', fontSize: 16, minWidth: 60 },
  headerTitle: { color: colors.text, fontWeight: '700', fontSize: 16 },
  headerSpace: { width: 60 },

  content: { alignItems: 'center', gap: space.md, paddingHorizontal: space.lg },
  state: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  timer: {
    color: colors.text,
    fontSize: 56,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    letterSpacing: -2,
  },

  // Minimal, bigger, rounded waveform bars
  wave: {
    height: 94,
    width: '100%',
    maxWidth: 340,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  bar: {
    flex: 1,
    borderRadius: radius.pill,
    minWidth: 8,
  },

  limit: { color: colors.muted, fontSize: 13 },

  // Clean original controls
  controls: {
    minHeight: 122,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  recordControl: {
    height: 78,
    width: 78,
    borderRadius: 39,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  startDot: {
    height: 40,
    width: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  secondaryControl: {
    minWidth: 80,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlText: { color: colors.text, fontWeight: '700' },
  stopControl: {
    height: 78,
    width: 78,
    borderRadius: 39,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopSquare: {
    height: 28,
    width: 28,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  pressed: { opacity: 0.72 },
});
